import { createAdminClient } from "@/lib/supabase/server";
import { getMadrasaMetadata } from "@/lib/sessions";
import {
  parseStudentIdentifier,
  formatStudentIdWithPrefix,
  extractMadrasaPrefix,
} from "@/lib/madrasa-prefix";
import { getAllMadrasasWithPrefixes } from "@/lib/madrasa-prefix-server";

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
 * Resolves the numeric 6-digit portion of student ID (e.g., 480001).
 * Uses deterministic sequence index (480001..489999) to avoid cross-class roll collisions.
 */
export function resolveCanonicalStudentNumericCode(student: any, fallbackIndex = 1): string {
  if (!student) return `480${String(fallbackIndex).padStart(3, "0")}`;

  // 1. Explicit numeric student_id or admission_no or registration_no
  const explicit = student.student_id || student.admission_no || student.custom_id || student.registration_no;
  if (explicit && typeof explicit === "string" && !explicit.includes("-") && explicit.length < 15) {
    const cleanExplicit = banglaToEnglishDigits(explicit).replace(/\D/g, "");
    if (cleanExplicit.length >= 5 && cleanExplicit.startsWith("48")) {
      return cleanExplicit;
    }
  }

  // 2. Deterministic 6-digit sequence: 480001 to 489999
  const idx = typeof fallbackIndex === "number" && fallbackIndex > 0 ? fallbackIndex : 1;
  return `480${String(idx).padStart(3, "0")}`;
}

/**
 * Resolves a full canonical student ID with Madrasa Prefix (e.g., AHM480001 or AHH480001).
 */
export function resolveCanonicalStudentCode(
  student: any,
  fallbackIndex = 1,
  madrasaPrefix?: string
): string {
  const numCode = resolveCanonicalStudentNumericCode(student, fallbackIndex);
  const prefix = (madrasaPrefix || (student?.madrasas ? extractMadrasaPrefix(student.madrasas) : "") || "AHM")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return `${prefix}${numCode}`;
}

export interface ResolvedStudentTarget {
  student: any;
  canonicalStudentId: string; // e.g. "AHM480001"
  numericStudentId: string;   // e.g. "480001"
  portalEmail: string;        // e.g. "student_ahm480001@qawmi.app"
  legacyPortalEmail: string;  // e.g. "student_480001@qawmi.app"
  madrasaId: string;
  madrasaPrefix: string;
  madrasaName: string;
}

/**
 * Searches for a student by any identifier with multi-tenant prefix support:
 * - 6-digit sequential ID (e.g., "480001", "480034", "৪৮০০০১")
 * - Prefixed ID without hyphen (e.g., "AHM480001", "AHH480001", "ahm480001")
 * - Prefixed ID with hyphen (e.g., "AHM-480001", "AHH-480001")
 * - Parent phone number (e.g., "01600989555", "+8801600989555")
 * - Student internal email (e.g., "student_480001@qawmi.app", "student_ahm480001@qawmi.app")
 */
export async function findStudentByIdentifier(identifier: string): Promise<ResolvedStudentTarget | null> {
  if (!identifier) return null;

  const raw = identifier.trim();
  const enStr = banglaToEnglishDigits(raw);

  // Check if it's already a portal email format
  const portalEmailMatch = enStr.match(/^student_([0-9a-zA-Z_-]+)@qawmi\.app$/i);
  const targetCodeFromEmail = portalEmailMatch ? portalEmailMatch[1] : null;

  const adminClient = await createAdminClient();

  // Load all madrasas with their prefixes
  const madrasasWithPrefixes = await getAllMadrasasWithPrefixes();
  const madrasaMap = new Map<string, { id: string; name: string; prefix: string }>();
  const prefixToMadrasaMap = new Map<string, { id: string; name: string; prefix: string }>();

  madrasasWithPrefixes.forEach((m) => {
    madrasaMap.set(m.id, m);
    if (m.prefix) {
      prefixToMadrasaMap.set(m.prefix.toUpperCase(), m);
    }
  });

  // Parse input to see if user entered an explicit prefix (e.g. AHM480001 or AHH480001)
  const parsed = parseStudentIdentifier(targetCodeFromEmail || enStr);
  const explicitPrefix = parsed.prefix;

  // If explicit prefix matches a specific madrasa
  let targetMadrasaId: string | null = null;
  let targetMadrasaInfo: { id: string; name: string; prefix: string } | null = null;

  if (explicitPrefix && prefixToMadrasaMap.has(explicitPrefix)) {
    targetMadrasaInfo = prefixToMadrasaMap.get(explicitPrefix)!;
    targetMadrasaId = targetMadrasaInfo.id;
  }

  // Query all students deterministically sorted
  let studentQuery = adminClient
    .from("students")
    .select("*, classes(id, name)")
    .order("created_at", { ascending: true });

  if (targetMadrasaId) {
    studentQuery = studentQuery.eq("madrasa_id", targetMadrasaId);
  }

  const { data: matchedStudents, error } = await studentQuery;

  if (error || !matchedStudents || matchedStudents.length === 0) {
    return null;
  }

  return searchStudentsList(matchedStudents, parsed, raw, enStr, targetCodeFromEmail, madrasaMap);
}

/**
 * Helper to match student in a candidate list
 */
function searchStudentsList(
  matchedStudents: any[],
  parsed: { prefix: string | null; numericCode: string; originalInput: string },
  raw: string,
  enStr: string,
  targetCodeFromEmail: string | null,
  madrasaMap: Map<string, { id: string; name: string; prefix: string }>
): ResolvedStudentTarget | null {
  const normDigits = (val: any) => banglaToEnglishDigits(val).replace(/\D/g, "");

  let found: any = null;
  let foundIndex = 1;

  // Check 1: Direct match by sequential 6-digit code (e.g., 480001 -> index 1)
  if (parsed.numericCode && parsed.numericCode.startsWith("48") && parsed.numericCode.length >= 5) {
    const seqNum = parseInt(parsed.numericCode.slice(2), 10);
    if (!isNaN(seqNum) && seqNum >= 1 && seqNum <= matchedStudents.length) {
      found = matchedStudents[seqNum - 1];
      foundIndex = seqNum;
    }
  }

  // Check 2: Match by plain sequence number (e.g., "1" to "34")
  if (!found && parsed.numericCode && /^[0-9]+$/.test(parsed.numericCode)) {
    const directNum = parseInt(parsed.numericCode, 10);
    if (directNum >= 1 && directNum <= matchedStudents.length) {
      found = matchedStudents[directNum - 1];
      foundIndex = directNum;
    }
  }

  // Check 2: Match by target code in portal email (e.g., "student_ahm480005@qawmi.app" or "student_ahm-480005@qawmi.app")
  if (!found && targetCodeFromEmail) {
    const cleanEmailCode = targetCodeFromEmail.toLowerCase().replace(/[^a-z0-9]/g, "");
    matchedStudents.forEach((s, idx) => {
      if (found) return;
      const num = `480${String(idx + 1).padStart(3, "0")}`;
      const pre = ((s.madrasa_id && madrasaMap.get(s.madrasa_id)?.prefix) || "ahm").toLowerCase();
      if (
        cleanEmailCode === `${pre}${num}` ||
        cleanEmailCode === num ||
        cleanEmailCode === `${pre}-${num}` ||
        cleanEmailCode.endsWith(num)
      ) {
        found = s;
        foundIndex = idx + 1;
      }
    });
  }

  // Check 3: Match by Parent Phone number
  if (!found && enStr.length >= 10 && /^\+?[0-9]+$/.test(enStr)) {
    const cleanPhone = enStr.replace(/\D/g, "").slice(-10);
    matchedStudents.forEach((s, idx) => {
      if (found) return;
      const pPhone = normDigits(s.parent_phone || s.phone || "").slice(-10);
      if (pPhone && pPhone === cleanPhone) {
        found = s;
        foundIndex = idx + 1;
      }
    });
  }

  // Check 4: Match by Roll number if single student or first match
  if (!found && /^[0-9]+$/.test(enStr) && enStr.length <= 4) {
    const targetRoll = parseInt(enStr, 10);
    const rollMatch = matchedStudents.find((s) => parseInt(normDigits(s.roll_number || ""), 10) === targetRoll);
    if (rollMatch) {
      foundIndex = matchedStudents.indexOf(rollMatch) + 1;
      found = rollMatch;
    }
  }

  if (!found) return null;

  const madrasaInfo =
    (found.madrasa_id && madrasaMap.get(found.madrasa_id)) || {
      id: found.madrasa_id || "",
      name: "মাদরাসা",
      prefix: "AHM",
    };

  const canonicalStudentId = resolveCanonicalStudentCode(found, foundIndex, madrasaInfo.prefix);
  const numCode = resolveCanonicalStudentNumericCode(found, foundIndex);
  const canonicalEmail = `student_${canonicalStudentId.toLowerCase()}@qawmi.app`;
  const legacyEmail = `student_${numCode}@qawmi.app`.toLowerCase();

  return {
    student: found,
    canonicalStudentId,
    numericStudentId: numCode,
    portalEmail: canonicalEmail,
    legacyPortalEmail: legacyEmail,
    madrasaId: found.madrasa_id || madrasaInfo.id || "",
    madrasaPrefix: madrasaInfo.prefix,
    madrasaName: madrasaInfo.name,
  };
}

/**
 * Ensures a Supabase Auth user and users record exists for the given student.
 * Note: public.users schema only has: id, madrasa_id, role, full_name, phone, email, created_at.
 * Default password is "123456".
 */
export async function ensureStudentGuardianAuthUser(
  student: any,
  canonicalStudentId: string,
  defaultPassword = "123456",
  explicitMadrasaId?: string
): Promise<{ authUserId: string; email: string; canonicalEmail: string; isNew: boolean }> {
  const adminClient = await createAdminClient();
  const cleanIdNoHyphen = canonicalStudentId.replace(/[^A-Za-z0-9]/g, "");
  const canonicalEmail = `student_${cleanIdNoHyphen.toLowerCase()}@qawmi.app`;
  const altHyphenEmail = `student_${canonicalStudentId.toLowerCase()}@qawmi.app`;
  
  const studentFullName = `${student.first_name || ""} ${student.last_name || ""}`.trim();
  const guardianFullName = studentFullName ? `${studentFullName} (অভিভাবক)` : `শিক্ষার্থী ${cleanIdNoHyphen} (অভিভাবক)`;
  const madrasaId = student.madrasa_id || explicitMadrasaId || "";

  // 1. Check if public.users already has an account with this canonical or hyphenated email
  const { data: existingUserRow } = await adminClient
    .from("users")
    .select("id, email, full_name, role, madrasa_id")
    .or(`email.eq.${canonicalEmail},email.eq.${altHyphenEmail}`)
    .maybeSingle();

  // If existing record found in public.users: sync & update
  if (existingUserRow?.id) {
    try {
      await adminClient.auth.admin.updateUserById(existingUserRow.id, {
        email: canonicalEmail,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: {
          role: "parent",
          full_name: guardianFullName,
          phone: student.parent_phone || "",
          student_id: student.id,
          student_id_code: cleanIdNoHyphen,
          student_name: studentFullName,
          roll_number: student.roll_number || "",
          class_name: student.class_name || student.classes?.name || "",
          madrasa_id: madrasaId,
        },
      });
    } catch (authErr) {
      // ignore
    }

    await adminClient
      .from("users")
      .update({
        madrasa_id: madrasaId || null,
        full_name: guardianFullName,
        email: canonicalEmail,
        phone: student.parent_phone || null,
        role: "parent",
      })
      .eq("id", existingUserRow.id);

    return {
      authUserId: existingUserRow.id,
      email: canonicalEmail,
      canonicalEmail,
      isNew: false,
    };
  }

  // 2. Otherwise, create or find Supabase Auth User
  let authUserId = "";
  try {
    const { data: newAuthData, error: createAuthError } = await adminClient.auth.admin.createUser({
      email: canonicalEmail,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: {
        role: "parent",
        full_name: guardianFullName,
        phone: student.parent_phone || "",
        student_id: student.id,
        student_id_code: cleanIdNoHyphen,
        student_name: studentFullName,
        roll_number: student.roll_number || "",
        class_name: student.class_name || student.classes?.name || "",
        madrasa_id: madrasaId,
        is_default_password: true,
        default_password_hint: "123456",
      },
    });

    if (createAuthError) {
      // If email already registered in Supabase Auth, fetch existing Auth User
      if (
        createAuthError.message?.toLowerCase().includes("already registered") ||
        createAuthError.message?.toLowerCase().includes("exists")
      ) {
        const { data: userList } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
        const existingAuth = userList?.users?.find(
          (u) =>
            u.email?.toLowerCase() === canonicalEmail.toLowerCase() ||
            u.email?.toLowerCase() === altHyphenEmail.toLowerCase()
        );
        if (existingAuth) {
          authUserId = existingAuth.id;
          try {
            await adminClient.auth.admin.updateUserById(existingAuth.id, {
              email: canonicalEmail,
              password: defaultPassword,
              email_confirm: true,
              user_metadata: {
                role: "parent",
                full_name: guardianFullName,
                phone: student.parent_phone || "",
                student_id: student.id,
                student_id_code: cleanIdNoHyphen,
                student_name: studentFullName,
                roll_number: student.roll_number || "",
                class_name: student.class_name || student.classes?.name || "",
                madrasa_id: madrasaId,
              },
            });
          } catch {}
        }
      } else {
        throw new Error(createAuthError.message);
      }
    } else if (newAuthData?.user) {
      authUserId = newAuthData.user.id;
    }
  } catch (err: any) {
    console.error("Auth user create/update failed for student", student.id, err);
  }

  if (authUserId) {
    // 3. Upsert into public.users table (ONLY valid columns)
    const { error: upsertError } = await adminClient.from("users").upsert({
      id: authUserId,
      madrasa_id: madrasaId || null,
      full_name: guardianFullName,
      email: canonicalEmail,
      phone: student.parent_phone || null,
      role: "parent",
    });

    if (upsertError) {
      console.error("DB users table upsert failed:", upsertError);
    }

    return {
      authUserId,
      email: canonicalEmail,
      canonicalEmail,
      isNew: true,
    };
  }

  throw new Error(`শিক্ষার্থী ${studentFullName} এর জন্য লগইন তৈরি করা যায়নি`);
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
 * Ensures every single student (1 to 34) has a unique student ID (e.g. AHM480001 to AHM480034)
 * and active parent account in both Supabase Auth and public.users table.
 */
export async function syncAllStudentsDefaultLogins(madrasaId?: string): Promise<SyncStudentLoginsResult> {
  const adminClient = await createAdminClient();

  // Load madrasa prefixes
  const madrasasWithPrefixes = await getAllMadrasasWithPrefixes();
  const madrasaPrefixMap = new Map<string, string>();
  madrasasWithPrefixes.forEach((m) => {
    madrasaPrefixMap.set(m.id, m.prefix);
  });

  let query = adminClient
    .from("students")
    .select("*, classes(id, name)")
    .order("created_at", { ascending: true });

  if (madrasaId) {
    query = query.or(`madrasa_id.eq.${madrasaId},madrasa_id.is.null`);
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
    const prefix = (
      (s.madrasa_id && madrasaPrefixMap.get(s.madrasa_id)) ||
      (madrasaId && madrasaPrefixMap.get(madrasaId)) ||
      "AHM"
    )
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    // Deterministic 1-to-N sequential code: AHM480001 to AHM480034
    const seqNum = idx + 1;
    const numCode = `480${String(seqNum).padStart(3, "0")}`;
    const code = `${prefix}${numCode}`;

    try {
      const res = await ensureStudentGuardianAuthUser(s, code, "123456", madrasaId || s.madrasa_id);
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
    total: results.length,
    created: createdCount,
    existing: existingCount,
    students: results,
  };
}
