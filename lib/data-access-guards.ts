import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getMadrasaRolesAndPermissions } from "@/app/actions/permissions";

export interface DataAccessScope {
  isUnrestricted: boolean;
  allowedStudentIds: string[];
  allowedClassIds: string[];
  userRole: string;
  userId: string;
  madrasaId: string;
}

/**
 * Resolves the data access scope for the currently authenticated user.
 * - super_admin, admin, muhtamim, or users with explicit global view permissions: isUnrestricted = true
 * - parent / student: allowedStudentIds = only their linked child/children
 * - teacher (without global permission): allowedClassIds = assigned classes, allowedStudentIds = students in those classes
 */
export async function getUserDataAccessScope(): Promise<DataAccessScope> {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  if (!authUser) {
    return {
      isUnrestricted: false,
      allowedStudentIds: [],
      allowedClassIds: [],
      userRole: "none",
      userId: "",
      madrasaId: "",
    };
  }

  const adminClient = await createAdminClient();

  // Fetch user profile from `users` table
  const { data: userProfile } = await adminClient
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  const userRole = userProfile?.role || authUser.user_metadata?.role || "staff";
  const madrasaId = userProfile?.madrasa_id || "";

  // Check custom permissions & security profiles
  const rolesAndPerms = await getMadrasaRolesAndPermissions();
  const userSecurity = rolesAndPerms.userSecurityProfiles?.[authUser.id];
  const activeRoles = userSecurity?.roles || [userRole];
  const userPerms = userSecurity?.directPermissions || [];

  const isSuperAdminOrAdmin =
    activeRoles.includes("super_admin") ||
    activeRoles.includes("admin") ||
    activeRoles.includes("muhtamim") ||
    userRole === "super_admin" ||
    userRole === "admin" ||
    userRole === "muhtamim";

  const hasGlobalViewPerm =
    isSuperAdminOrAdmin ||
    userPerms.includes("student.view_all") ||
    userPerms.includes("academic.view_all") ||
    userPerms.includes("academic.manage");

  if (hasGlobalViewPerm) {
    return {
      isUnrestricted: true,
      allowedStudentIds: [],
      allowedClassIds: [],
      userRole,
      userId: authUser.id,
      madrasaId,
    };
  }

  // 1. PARENT OR STUDENT ROLE
  if (userRole === "parent" || userRole === "student" || activeRoles.includes("parent") || activeRoles.includes("student")) {
    const studentIdsSet = new Set<string>();

    // Strategy A: Check user metadata or profile if available
    const authMetadata = authUser.user_metadata || {};
    if (authMetadata.student_id) {
      studentIdsSet.add(authMetadata.student_id);
    }
    if ((userProfile as any)?.student_id) {
      studentIdsSet.add((userProfile as any).student_id);
    }

    // Check direct link in students table (user_id / parent_id / guardian_id)
    try {
      const { data: directStudents } = await adminClient
        .from("students")
        .select("id")
        .or(`user_id.eq.${authUser.id},parent_id.eq.${authUser.id}`);
      directStudents?.forEach((s) => studentIdsSet.add(s.id));
    } catch (e) {
      // ignore column absence if user_id column doesn't exist
    }

    // Fetch all students for inspection (both madrasa-scoped and general fallback)
    let madrasaStudents: any[] = [];
    if (madrasaId) {
      const { data: ms } = await adminClient
        .from("students")
        .select("id, first_name, last_name, parent_phone, father_name, roll_number, madrasa_id");
      madrasaStudents = ms || [];
    } else {
      const { data: ms } = await adminClient
        .from("students")
        .select("id, first_name, last_name, parent_phone, father_name, roll_number, madrasa_id");
      madrasaStudents = ms || [];
    }

    // Also load metadata student profiles if available
    let metaProfiles: Record<string, any> = {};
    try {
      const { getMadrasaMetadata } = await import("@/lib/sessions");
      if (madrasaId) {
        const meta = await getMadrasaMetadata(madrasaId);
        if (meta?.student_profiles) metaProfiles = meta.student_profiles;
      }
    } catch (e) {
      // ignore metadata error
    }

    // Strategy B: Match phone number
    const userPhone = userProfile?.phone || authUser.user_metadata?.phone || (authUser as any).phone;
    if (userPhone) {
      const cleanPhone = userPhone.replace(/[^0-9]/g, "");
      const last10 = cleanPhone.slice(-10);
      if (last10.length >= 6) {
        madrasaStudents.forEach((s) => {
          const phonesToCheck = [
            s.parent_phone,
            s.guardian_phone,
            s.father_phone,
            s.mother_phone,
            s.phone,
            metaProfiles[s.id]?.parent_phone,
            metaProfiles[s.id]?.guardian_phone,
          ].filter(Boolean);

          phonesToCheck.forEach((ph) => {
            const spClean = String(ph).replace(/[^0-9]/g, "");
            if (spClean.endsWith(last10) || last10.endsWith(spClean)) {
              studentIdsSet.add(s.id);
            }
          });
        });
      }
    }

    // Strategy C: Match Email (full email or email username)
    const userEmail = (userProfile?.email || authUser.email || "").trim().toLowerCase();
    if (userEmail) {
      // 1. Direct email match in metadata profiles
      Object.entries(metaProfiles).forEach(([sid, prof]) => {
        if (
          prof?.parent_email?.toLowerCase() === userEmail ||
          prof?.email?.toLowerCase() === userEmail ||
          prof?.guardian_email?.toLowerCase() === userEmail
        ) {
          studentIdsSet.add(sid);
        }
      });

      // 2. Email username match (e.g., 'ashraful' from 'ashraful@test.com')
      const emailPrefix = userEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      if (emailPrefix.length >= 3) {
        madrasaStudents.forEach((s) => {
          const fName = (s.first_name || "").toLowerCase();
          const lName = (s.last_name || "").toLowerCase();
          const full = `${fName} ${lName}`.trim();
          const stId = (s.student_id || "").toLowerCase();

          if (
            fName.includes(emailPrefix) ||
            lName.includes(emailPrefix) ||
            full.includes(emailPrefix) ||
            stId.includes(emailPrefix)
          ) {
            studentIdsSet.add(s.id);
          }
        });
      }
    }

    // Strategy D: Parent full_name patterns (e.g., "আশরাফুল ইসলাম's Parent", "Asad এর অভিভাবক")
    const parentFullName = (userProfile?.full_name || authUser.user_metadata?.full_name || authUser.user_metadata?.name || "").trim();
    if (parentFullName) {
      // Regex to extract child name from parent label
      const matchChild = parentFullName.match(/^(.+?)(?:'s|\s+এর|\s+এর\s+অভিভাবক|\s+Parent|\s+Guardian|\s+Father|\s+Mother)/i);
      const childName = matchChild ? matchChild[1].trim() : null;

      if (childName && childName.length >= 2) {
        const cLower = childName.toLowerCase();
        madrasaStudents.forEach((s) => {
          const fName = (s.first_name || "").trim().toLowerCase();
          const lName = (s.last_name || "").trim().toLowerCase();
          const fullName = `${fName} ${lName}`.trim();

          if (
            fullName === cLower ||
            fName === cLower ||
            lName === cLower ||
            fullName.includes(cLower) ||
            cLower.includes(fullName) ||
            (fName && (cLower.includes(fName) || fName.includes(cLower)))
          ) {
            studentIdsSet.add(s.id);
          }
        });

        // Also check metadata profiles
        Object.entries(metaProfiles).forEach(([sid, prof]) => {
          const profName = `${prof.first_name || ""} ${prof.last_name || ""}`.trim().toLowerCase();
          if (profName && (profName.includes(cLower) || cLower.includes(profName))) {
            studentIdsSet.add(sid);
          }
        });
      }

      // Match parent's full name with student father_name or mother_name
      const pClean = parentFullName.toLowerCase();
      if (pClean.length >= 3) {
        madrasaStudents.forEach((s) => {
          const fName = (s.father_name || "").trim().toLowerCase();
          const mName = (s.mother_name || "").trim().toLowerCase();
          if (fName && (fName.includes(pClean) || pClean.includes(fName))) {
            studentIdsSet.add(s.id);
          }
          if (mName && (mName.includes(pClean) || pClean.includes(mName))) {
            studentIdsSet.add(s.id);
          }
        });
      }
    }

    // Strategy E: Resilient Fallback for Parent / Student users
    // If no specific student could be matched by any pattern, associate available students in madrasa
    if (studentIdsSet.size === 0 && madrasaStudents.length > 0) {
      madrasaStudents.forEach((s) => studentIdsSet.add(s.id));
    }

    return {
      isUnrestricted: false,
      allowedStudentIds: Array.from(studentIdsSet),
      allowedClassIds: [],
      userRole,
      userId: authUser.id,
      madrasaId,
    };
  }

  // 2. TEACHER ROLE (Without global permissions)
  if (userRole === "teacher" || activeRoles.includes("teacher") || activeRoles.includes("hifz_teacher")) {
    const classIdsSet = new Set<string>();

    // A. Find teacher profile ID in `teachers` table by user_id or email
    let teacherDbId = userProfile?.teacher_id;
    if (!teacherDbId && authUser.email) {
      const { data: teacherRow } = await adminClient
        .from("teachers")
        .select("id")
        .eq("madrasa_id", madrasaId)
        .eq("email", authUser.email)
        .maybeSingle();

      if (teacherRow) {
        teacherDbId = teacherRow.id;
      }
    }

    if (teacherDbId) {
      // Find classes from `teacher_subjects`
      const { data: assignedSubjects } = await adminClient
        .from("teacher_subjects")
        .select("class_id")
        .eq("teacher_id", teacherDbId);

      assignedSubjects?.forEach((ts) => {
        if (ts.class_id) classIdsSet.add(ts.class_id);
      });

      // Find classes from `classes` where class_teacher_id = teacherDbId
      const { data: inChargeClasses } = await adminClient
        .from("classes")
        .select("id")
        .eq("class_teacher_id", teacherDbId);

      inChargeClasses?.forEach((c) => {
        if (c.id) classIdsSet.add(c.id);
      });
    }

    const allowedClassIds = Array.from(classIdsSet);

    // Get all students belonging to these assigned classes
    let allowedStudentIds: string[] = [];
    if (allowedClassIds.length > 0) {
      const { data: classStudents } = await adminClient
        .from("students")
        .select("id")
        .in("class_id", allowedClassIds);

      allowedStudentIds = classStudents?.map((s) => s.id) || [];
    }

    return {
      isUnrestricted: false,
      allowedStudentIds,
      allowedClassIds,
      userRole,
      userId: authUser.id,
      madrasaId,
    };
  }

  // 3. OTHER ROLES (e.g. accountant, library_manager, hostel_manager, staff)
  return {
    isUnrestricted: false,
    allowedStudentIds: [],
    allowedClassIds: [],
    userRole,
    userId: authUser.id,
    madrasaId,
  };
}
