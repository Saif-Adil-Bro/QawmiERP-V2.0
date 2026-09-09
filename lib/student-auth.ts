import { createAdminClient } from "@/lib/supabase/server";
import { getMadrasaMetadata } from "@/lib/sessions";

/**
 * Converts Bengali digits (০-৯) to English ASCII digits (0-9).
 */
export function banglaToEnglishDigits(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return "";
  const bnToEn: Record<string, string> = {
    "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
    "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
  };
  return String(str).replace(/[০-৯]/g, (d) => bnToEn[d] || d);
}

/**
 * Resolves a 6-digit canonical student ID code (e.g., 480001).
 * Matches roll numbers (e.g., 1 -> 480001, 12 -> 480012) or custom student IDs.
 */
export function resolveCanonicalStudentCode(student: any, fallbackIndex = 1): string {
  if (!student) return `480${String(fallbackIndex).padStart(3, "0")}`;

  // 1. Explicit numeric student_id or admission_no or registration_no
  const explicit = student.student_id || student.admission_no || student.custom_id || student.registration_no;
  if (explicit && typeof explicit === "string" && !explicit.includes("-") && explicit.length < 15) {
    const cleanExplicit = banglaToEnglishDigits(explicit).replace(/\D/g, "");
    if (cleanExplicit.length >= 5) {
      return cleanExplicit;
    }
  }

  // 2. Derive from roll number (e.g., Roll 1 -> 480001, Roll 15 -> 480015)
  const rollStr = banglaToEnglishDigits(student.roll_number || "").replace(/\D/g, "");
  if (rollStr) {
    const rollNum = parseInt(rollStr, 10);
    if (!isNaN(rollNum) && rollNum > 0) {
      if (rollNum >= 480000 && rollNum <= 489999) {
        return String(rollNum);
      }
      return `480${String(rollNum).padStart(3, "0")}`;
    }
  }

  // 3. Fallback counter
  const idx = typeof fallbackIndex === "number" && fallbackIndex > 0 ? fallbackIndex : 1;
  return `480${String(idx).padStart(3, "0")}`;
}

export interface ResolvedStudentTarget {
  student: any;
  canonicalStudentId: string;
  portalEmail: string;
  madrasaId: string;
}

/**
 * Searches for a student by any identifier:
 * - 6-digit student ID (e.g., "480001", "480015", "৪৮০০০১")
 * - Prefixed ID (e.g., "QM-480001", "STU-480001", "ID-480001")
 * - Roll number (e.g., "1", "01", "১", "12", "১২")
 * - Parent phone number (e.g., "01600989555", "+8801600989555")
 * - Student internal email (e.g., "student_480001@qawmi.app")
 */
export async function findStudentByIdentifier(identifier: string): Promise<ResolvedStudentTarget | null> {
  if (!identifier) return null;

  const raw = identifier.trim();
  const enStr = banglaToEnglishDigits(raw);

  // Check if it's already a portal email format
  const portalEmailMatch = enStr.match(/^student_([0-9a-zA-Z_-]+)@qawmi\.app$/i);
  const targetCodeFromEmail = portalEmailMatch ? portalEmailMatch[1] : null;

  // Clean candidate code by stripping known prefixes
  const cleanId = enStr.replace(/^(QM-|STU-|ID-|CERT-)/i, "").trim();
  const digitsOnly = cleanId.replace(/\D/g, "");

  const adminClient = await createAdminClient();

  // Load all students for accurate matching
  const { data: allStudents, error } = await adminClient
    .from("students")
    .select("*, classes(id, name)")
    .order("roll_number", { ascending: true });

  if (error || !allStudents || allStudents.length === 0) {
    return null;
  }

  // Strategy 1: Match by portal email target code (e.g., student_480001@qawmi.app -> 480001)
  if (targetCodeFromEmail) {
    for (let idx = 0; idx < allStudents.length; idx++) {
      const s = allStudents[idx];
      const code = resolveCanonicalStudentCode(s, idx + 1);
      if (code.toLowerCase() === targetCodeFromEmail.toLowerCase()) {
        return {
          student: s,
          canonicalStudentId: code,
          portalEmail: `student_${code}@qawmi.app`,
          madrasaId: s.madrasa_id || "",
        };
      }
    }
  }

  // Strategy 2: Direct match by 6-digit student ID (e.g., 480001)
  if (digitsOnly.length >= 4) {
    for (let idx = 0; idx < allStudents.length; idx++) {
      const s = allStudents[idx];
      const code = resolveCanonicalStudentCode(s, idx + 1);
      if (code === digitsOnly || (code.endsWith(digitsOnly) && digitsOnly.length >= 4)) {
        return {
          student: s,
          canonicalStudentId: code,
          portalEmail: `student_${code}@qawmi.app`,
          madrasaId: s.madrasa_id || "",
        };
      }
    }
  }

  // Strategy 3: Match by roll number (e.g. Roll 1 -> 480001)
  if (digitsOnly.length >= 1 && digitsOnly.length <= 3) {
    const targetRoll = parseInt(digitsOnly, 10);
    for (let idx = 0; idx < allStudents.length; idx++) {
      const s = allStudents[idx];
      const sRollStr = banglaToEnglishDigits(s.roll_number || "").replace(/\D/g, "");
      const sRollNum = parseInt(sRollStr, 10);
      if (sRollNum === targetRoll) {
        const code = resolveCanonicalStudentCode(s, idx + 1);
        return {
          student: s,
          canonicalStudentId: code,
          portalEmail: `student_${code}@qawmi.app`,
          madrasaId: s.madrasa_id || "",
        };
      }
    }
  }

  // Strategy 4: Match by parent phone number (last 10 digits)
  if (digitsOnly.length >= 6) {
    const last10 = digitsOnly.slice(-10);
    for (let idx = 0; idx < allStudents.length; idx++) {
      const s = allStudents[idx];
      const phoneClean = (s.parent_phone || "").replace(/\D/g, "");
      if (phoneClean.endsWith(last10) || last10.endsWith(phoneClean)) {
        const code = resolveCanonicalStudentCode(s, idx + 1);
        return {
          student: s,
          canonicalStudentId: code,
          portalEmail: `student_${code}@qawmi.app`,
          madrasaId: s.madrasa_id || "",
        };
      }
    }
  }

  // Strategy 5: Check madrasa metadata profiles
  try {
    const madrasaId = allStudents[0]?.madrasa_id;
    if (madrasaId) {
      const meta = await getMadrasaMetadata(madrasaId);
      if (meta?.student_profiles) {
        for (const [sId, prof] of Object.entries(meta.student_profiles as Record<string, any>)) {
          const profCode = prof?.student_id || prof?.student_id_code;
          if (profCode && (profCode === digitsOnly || profCode === raw)) {
            const studentObj = allStudents.find((s) => s.id === sId);
            if (studentObj) {
              const code = profCode;
              return {
                student: studentObj,
                canonicalStudentId: code,
                portalEmail: `student_${code}@qawmi.app`,
                madrasaId,
              };
            }
          }
        }
      }
    }
  } catch (metaErr) {
    console.warn("Metadata check error:", metaErr);
  }

  return null;
}

/**
 * Ensures a Supabase Auth user and users record exists for the given student.
 * Default password is "123456".
 */
export async function ensureStudentGuardianAuthUser(
  student: any,
  canonicalStudentId: string,
  defaultPassword = "123456"
): Promise<{ authUserId: string; email: string; isNew: boolean }> {
  const adminClient = await createAdminClient();
  const canonicalEmail = `student_${canonicalStudentId}@qawmi.app`.toLowerCase();

  const studentFullName = `${student.first_name || ""} ${student.last_name || ""}`.trim();
  const guardianFullName = studentFullName ? `${studentFullName} (অভিভাবক)` : `শিক্ষার্থী ${canonicalStudentId} (অভিভাবক)`;
  const madrasaId = student.madrasa_id || "";

  // 1. Check if user already exists in public.users table with this canonical email
  const { data: existingUserRow } = await adminClient
    .from("users")
    .select("id, email, role")
    .eq("email", canonicalEmail)
    .maybeSingle();

  if (existingUserRow?.id) {
    return {
      authUserId: existingUserRow.id,
      email: canonicalEmail,
      isNew: false,
    };
  }

  // 2. Check in Supabase Auth user list
  try {
    const { data: authList } = await adminClient.auth.admin.listUsers();
    const existingAuthUser = authList?.users?.find(
      (u) => u.email?.toLowerCase() === canonicalEmail
    );

    if (existingAuthUser) {
      // Make sure users table has this user
      await adminClient.from("users").upsert({
        id: existingAuthUser.id,
        madrasa_id: madrasaId || null,
        full_name: guardianFullName,
        email: canonicalEmail,
        phone: student.parent_phone || null,
        role: "parent",
      });

      return {
        authUserId: existingAuthUser.id,
        email: canonicalEmail,
        isNew: false,
      };
    }
  } catch (listErr) {
    console.warn("Auth list users error:", listErr);
  }

  // 3. Create fresh Supabase Auth user with default password (123456)
  const { data: newAuthData, error: createAuthError } = await adminClient.auth.admin.createUser({
    email: canonicalEmail,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: {
      role: "parent",
      full_name: guardianFullName,
      phone: student.parent_phone || "",
      student_id: student.id,
      student_id_code: canonicalStudentId,
      madrasa_id: madrasaId,
      is_default_password: true,
      default_password_hint: "123456",
    },
  });

  if (createAuthError) {
    console.error("Failed to create default guardian auth user:", createAuthError);
    throw new Error(`অভিভাবক অ্যাকাউন্ট তৈরিতে সমস্যা: ${createAuthError.message}`);
  }

  const newUserId = newAuthData.user.id;

  // 4. Upsert into public.users table
  await adminClient.from("users").upsert({
    id: newUserId,
    madrasa_id: madrasaId || null,
    full_name: guardianFullName,
    email: canonicalEmail,
    phone: student.parent_phone || null,
    role: "parent",
  });

  // 5. Update student parent_id if null
  if (!student.parent_id) {
    try {
      await adminClient
        .from("students")
        .update({ parent_id: newUserId })
        .eq("id", student.id);
    } catch (updateErr) {
      // optional column
    }
  }

  return {
    authUserId: newUserId,
    email: canonicalEmail,
    isNew: true,
  };
}

export type SyncStudentLoginsResult =
  | {
      success: true;
      total: number;
      created: number;
      existing: number;
      students: Array<{ id: string; name: string; studentId: string; email: string; isNew: boolean }>;
    }
  | {
      success: false;
      error: string;
    };

/**
 * Bulk syncs all students' default guardian logins in the madrasa.
 * Ensures every student ID (e.g. 480001, 480002) has its default password (123456) ready.
 */
export async function syncAllStudentsDefaultLogins(madrasaId?: string): Promise<SyncStudentLoginsResult> {
  const adminClient = await createAdminClient();

  let query = adminClient.from("students").select("*, classes(id, name)").order("roll_number", { ascending: true });
  if (madrasaId) {
    query = query.eq("madrasa_id", madrasaId);
  }

  const { data: students, error } = await query;
  if (error || !students) {
    return { success: false, error: error?.message || "শিক্ষার্থী ডাটা পাওয়া যায়নি।" };
  }

  let createdCount = 0;
  let existingCount = 0;
  const results: Array<{ id: string; name: string; studentId: string; email: string; isNew: boolean }> = [];

  for (let idx = 0; idx < students.length; idx++) {
    const s = students[idx];
    const code = resolveCanonicalStudentCode(s, idx + 1);
    try {
      const res = await ensureStudentGuardianAuthUser(s, code, "123456");
      if (res.isNew) createdCount++;
      else existingCount++;

      results.push({
        id: s.id,
        name: `${s.first_name} ${s.last_name || ""}`.trim(),
        studentId: code,
        email: res.email,
        isNew: res.isNew,
      });
    } catch (e: any) {
      console.warn(`Sync failed for student ${s.id} (${code}):`, e);
    }
  }

  return {
    success: true,
    total: students.length,
    created: createdCount,
    existing: existingCount,
    students: results,
  };
}
