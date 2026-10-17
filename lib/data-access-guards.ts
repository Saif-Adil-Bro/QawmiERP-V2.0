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
  let madrasaId = userProfile?.madrasa_id || "";

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

    // ⛔ CR-3 ফিক্স: আগে এখানে madrasa_id ফিল্টার কখনো প্রয়োগ করা হতো না —
    // `if (madrasaId)` ও `else` দুটো শাখাতেই একই unfiltered query ছিল, তাই
    // লাইভ ডেটাবেজের *সব মাদ্রাসার* শিক্ষার্থী মেমোরিতে লোড হতো এবং ফোন/ইমেইল/নামের
    // আংশিক মিলে অন্য মাদ্রাসার শিক্ষার্থীও অভিভাবকের সাথে যুক্ত হয়ে যেত।
    // এখন কঠোরভাবে নিজের মাদ্রাসার শিক্ষার্থীই পড়া হয়; madrasaId না থাকলে কিছুই নয়।
    const madrasaStudents: any[] = [];
    if (madrasaId) {
      const { data: ms } = await adminClient
        .from("students")
        .select("id, first_name, last_name, parent_phone, father_name, roll_number, madrasa_id")
        .eq("madrasa_id", madrasaId);
      madrasaStudents.push(...(ms || []));
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

          // CR-3 ফিক্স: আগে `includes` (আংশিক মিল) ব্যবহার হতো — ফলে ইমেইল
          // `rahim@...` হলে "Ibrahim", "Rahimuddin" নামের অন্য শিক্ষার্থীরাও যুক্ত হয়ে
          // যেতেন। এখন কেবল হুবহু মিল (পূর্ণ নাম বা শিক্ষার্থী আইডি) গ্রহণ করা হয়।
          const fullCompact = full.replace(/\s+/g, "");
          if (
            fullCompact === emailPrefix ||
            fName === emailPrefix ||
            stId === emailPrefix
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

          // CR-3 ফিক্স: আংশিক (substring) মিল সরানো হলো — আগে "আশরাফুল" নামের অভিভাবক
          // "আশরাফুল হক"-এর পাশাপাশি "মোঃ আশরাফ"-এর ডেটাও দেখতে পেতেন।
          if (fullName === cLower || fName === cLower || fullName.replace(/\s+/g, "") === cLower.replace(/\s+/g, "")) {
            studentIdsSet.add(s.id);
          }
        });

        // Also check metadata profiles
        Object.entries(metaProfiles).forEach(([sid, prof]) => {
          const profName = `${prof.first_name || ""} ${prof.last_name || ""}`.trim().toLowerCase();
          // CR-3 ফিক্স: শুধুমাত্র হুবহু পূর্ণ-নাম মিল
          if (profName && profName === cLower) {
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
          // CR-3 ফিক্স: আংশিক মিল বাদ — কেবল হুবহু অভিভাবকের নাম মিললেই অ্যাক্সেস
          if (fName && fName === pClean) {
            studentIdsSet.add(s.id);
          }
          if (mName && mName === pClean) {
            studentIdsSet.add(s.id);
          }
        });
      }
    }

    // ⛔ CR-3 ফিক্স (Strategy E অপসারণ): আগে কোনো শিক্ষার্থী ম্যাচ না হলে "resilient fallback"
    // হিসেবে ওই মাদ্রাসার *সব* শিক্ষার্থীর id অ্যাক্সেস-লিস্টে ঢুকিয়ে দেওয়া হতো — অর্থাৎ
    // সঠিকভাবে লিংক না থাকা যেকোনো অভিভাবক পুরো মাদ্রাসার ছাত্রদের ডেটা পেয়ে যেতেন।
    // এখন ম্যাচ না পেলে কোনো অ্যাক্সেস দেওয়া হয় না (খালি লিস্ট), এবং ম্যাচ শুধুমাত্র
    // নির্ভরযোগ্য সূত্র থেকেই করা হয় (নিচের ফোন/ইমেইল/নাম-ভিত্তিক অনুমান কঠোরভাবে scoped)।
    if (studentIdsSet.size === 0) {
      console.warn(
        `[access-guard] No linked student matched for user ${authUser.id} (madrasa ${madrasaId}). ` +
          "Access denied until a parent/guardian link is configured."
      );
    }

    // Auto-heal madrasa_id and phone in users table if matched students belong to a madrasa
    if (studentIdsSet.size > 0) {
      const matched = madrasaStudents.find((s) => studentIdsSet.has(s.id));
      if (matched) {
        let needsUserUpdate = false;
        const updatePayload: Record<string, any> = {};

        if (matched.madrasa_id && matched.madrasa_id !== madrasaId) {
          madrasaId = matched.madrasa_id;
          updatePayload.madrasa_id = matched.madrasa_id;
          needsUserUpdate = true;
        }

        if (matched.parent_phone && !userProfile?.phone) {
          updatePayload.phone = matched.parent_phone;
          needsUserUpdate = true;
        }

        if (needsUserUpdate) {
          try {
            await adminClient.from("users").update(updatePayload).eq("id", authUser.id);
          } catch (updateErr) {
            console.warn("Auto-sync user profile error in guards:", updateErr);
          }
        }
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

    // Check metadata class_teachers assignments
    if (madrasaId) {
      try {
        const { getMadrasaMetadata } = await import("@/lib/sessions");
        const meta = await getMadrasaMetadata(madrasaId) as any;
        const classTeachers = meta?.class_teachers || {};
        for (const [clsId, ct] of Object.entries<any>(classTeachers)) {
          if (ct?.teacher_id && (ct.teacher_id === teacherDbId || (userProfile?.teacher_id && ct.teacher_id === userProfile.teacher_id))) {
            classIdsSet.add(clsId);
          }
        }
      } catch (e) {
        console.warn("Could not check metadata class teachers for guard:", e);
      }
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
