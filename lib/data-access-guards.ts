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

    // Strategy A: Direct student_id in `users` table
    if (userProfile?.student_id) {
      studentIdsSet.add(userProfile.student_id);
    }

    // Strategy B: Match email in `students`
    if (authUser.email) {
      const { data: matchedByEmail } = await adminClient
        .from("students")
        .select("id")
        .eq("madrasa_id", madrasaId)
        .eq("email", authUser.email);

      if (matchedByEmail) {
        matchedByEmail.forEach((s) => studentIdsSet.add(s.id));
      }
    }

    // Strategy C: Match phone number (parent_phone)
    const userPhone = userProfile?.phone || authUser.user_metadata?.phone;
    if (userPhone) {
      const cleanPhone = userPhone.replace(/[^0-9]/g, "");
      const last10 = cleanPhone.slice(-10);
      if (last10.length >= 6) {
        const { data: allMadrasaStudents } = await adminClient
          .from("students")
          .select("id, parent_phone")
          .eq("madrasa_id", madrasaId);

        allMadrasaStudents?.forEach((s) => {
          if (s.parent_phone) {
            const spClean = s.parent_phone.replace(/[^0-9]/g, "");
            if (spClean.endsWith(last10) || last10.endsWith(spClean)) {
              studentIdsSet.add(s.id);
            }
          }
        });
      }
    }

    // Strategy D: If parent name is like "Asad's Parent", extract child name and match student first/last name
    if (studentIdsSet.size === 0 && userProfile?.full_name) {
      const parentName = userProfile.full_name.trim();
      const matchChild = parentName.match(/^(.+?)(?:'s|\s+এর|\s+এর\s+অভিভাবক|\s+Parent)/i);
      const childName = matchChild ? matchChild[1].trim() : null;

      if (childName && childName.length >= 2) {
        const { data: matchedByName } = await adminClient
          .from("students")
          .select("id, first_name, last_name")
          .eq("madrasa_id", madrasaId);

        matchedByName?.forEach((s) => {
          const fName = (s.first_name || "").trim();
          const lName = (s.last_name || "").trim();
          const fullName = `${fName} ${lName}`.trim();

          if (
            fullName.toLowerCase() === childName.toLowerCase() ||
            (fName && fName.toLowerCase() === childName.toLowerCase()) ||
            (lName && lName.toLowerCase() === childName.toLowerCase()) ||
            (fullName && fullName.toLowerCase().startsWith(childName.toLowerCase()))
          ) {
            studentIdsSet.add(s.id);
          }
        });
      }
    }

    // Fallback: If no student matches for parent, check if any student has father_name matching parent full_name
    if (studentIdsSet.size === 0 && userProfile?.full_name) {
      const parentFullName = userProfile.full_name.trim().toLowerCase();
      if (parentFullName.length >= 3) {
        const { data: matchedByFather } = await adminClient
          .from("students")
          .select("id, father_name")
          .eq("madrasa_id", madrasaId);

        matchedByFather?.forEach((s) => {
          if (s.father_name && s.father_name.trim()) {
            const fNameClean = s.father_name.trim().toLowerCase();
            if (fNameClean.includes(parentFullName) || parentFullName.includes(fNameClean)) {
              studentIdsSet.add(s.id);
            }
          }
        });
      }
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
