import { createAdminClient } from "@/lib/supabase/server";
import { getMadrasaMetadata } from "@/lib/sessions";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

export interface TeacherIdentityResolution {
  teacherId: string;
  teacherName: string;
  designation: string;
  candidateIds: string[];
  matchedTeacher: any | null;
  matchedStaff: any | null;
}

function normalizePhoneDigits(val: unknown): string {
  const digits = String(val || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function normalizeEmail(val: unknown): string {
  return String(val || "").trim().toLowerCase();
}

function normalizeName(val: unknown): string {
  return String(val || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getStaffFullName(staff: any): string {
  if (!staff) return "";
  const fullBn = String(staff?.personal?.full_name_bn || "").trim();
  const combined = `${staff?.personal?.first_name || ""} ${staff?.personal?.last_name || ""}`.trim();
  return fullBn || combined;
}

function getTeacherRowFullName(t: any): string {
  if (!t) return "";
  return `${t.first_name || ""} ${t.last_name || ""}`.trim();
}

function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Require meaningful length (>= 4 chars) before partial containment match
  if (na.length >= 4 && nb.length >= 4) {
    return na.includes(nb) || nb.includes(na);
  }
  return false;
}

/**
 * Resolves all candidate IDs (SQL `teachers.id`, `staff_members.id`, `staff_members.legacy_id`)
 * for a specific staff or teacher ID (e.g. when an Admin views a staff profile).
 * Never mixes the calling Admin's own auth email/ID into the target teacher's identity.
 */
export async function resolveTeacherCandidateIdsByStaffId(params: {
  adminClient: AdminClient;
  madrasaId: string;
  staffOrTeacherId: string;
  madrasaMeta?: any;
}): Promise<{
  candidateIds: string[];
  matchedTeacher: any | null;
  matchedStaff: any | null;
}> {
  const { adminClient, madrasaId, staffOrTeacherId } = params;
  const targetId = String(staffOrTeacherId || "").trim();
  const candidateIds = new Set<string>();
  if (!targetId) {
    return { candidateIds: [], matchedTeacher: null, matchedStaff: null };
  }
  candidateIds.add(targetId);

  const meta = params.madrasaMeta ?? (madrasaId ? await getMadrasaMetadata(madrasaId) : {});
  const staffMembers: any[] = Array.isArray(meta?.staff_members) ? meta.staff_members : [];

  const matchedStaff =
    staffMembers.find((s: any) => s?.id === targetId || s?.legacy_id === targetId) || null;
  if (matchedStaff?.id) candidateIds.add(String(matchedStaff.id));
  if (matchedStaff?.legacy_id) candidateIds.add(String(matchedStaff.legacy_id));

  const { data: dbTeachers } = await adminClient
    .from("teachers")
    .select("id, first_name, last_name, designation, phone, email, auth_user_id")
    .eq("madrasa_id", madrasaId);

  const teachersList: any[] = Array.isArray(dbTeachers) ? dbTeachers : [];
  const exactTeacher = teachersList.find((t: any) => t.id === targetId) || null;

  const targetEmails = new Set<string>();
  const targetPhones = new Set<string>();
  const targetNames: string[] = [];

  if (matchedStaff?.contact?.email) targetEmails.add(normalizeEmail(matchedStaff.contact.email));
  if (exactTeacher?.email) targetEmails.add(normalizeEmail(exactTeacher.email));

  const staffPhone = normalizePhoneDigits(matchedStaff?.contact?.phone);
  if (staffPhone.length >= 6) targetPhones.add(staffPhone);
  const teacherPhone = normalizePhoneDigits(exactTeacher?.phone);
  if (teacherPhone.length >= 6) targetPhones.add(teacherPhone);

  if (matchedStaff) {
    const sFull = getStaffFullName(matchedStaff);
    if (sFull) targetNames.push(sFull);
    const sFirst = String(matchedStaff?.personal?.first_name || "").trim();
    if (sFirst && sFirst.length >= 3) targetNames.push(sFirst);
  }
  if (exactTeacher) {
    const tFull = getTeacherRowFullName(exactTeacher);
    if (tFull) targetNames.push(tFull);
  }

  let primaryTeacher: any | null = exactTeacher;

  for (const t of teachersList) {
    const tEmail = normalizeEmail(t.email);
    const tPhone = normalizePhoneDigits(t.phone);
    const tFull = getTeacherRowFullName(t);

    const isMatch =
      candidateIds.has(String(t.id)) ||
      (tEmail && targetEmails.has(tEmail)) ||
      (tPhone.length >= 6 && targetPhones.has(tPhone)) ||
      targetNames.some((n) => namesMatch(n, tFull));

    if (isMatch) {
      candidateIds.add(String(t.id));
      if (!primaryTeacher) primaryTeacher = t;
    }
  }

  // Also check if any other staff entry points to the matched teacher ID / email / phone
  for (const s of staffMembers) {
    const sEmail = normalizeEmail(s?.contact?.email);
    const sPhone = normalizePhoneDigits(s?.contact?.phone);
    const sFull = getStaffFullName(s);
    if (
      candidateIds.has(String(s?.id || "")) ||
      candidateIds.has(String(s?.legacy_id || "")) ||
      (sEmail && targetEmails.has(sEmail)) ||
      (sPhone.length >= 6 && targetPhones.has(sPhone)) ||
      targetNames.some((n) => namesMatch(n, sFull))
    ) {
      if (s?.id) candidateIds.add(String(s.id));
      if (s?.legacy_id) candidateIds.add(String(s.legacy_id));
    }
  }

  return {
    candidateIds: Array.from(candidateIds),
    matchedTeacher: primaryTeacher,
    matchedStaff,
  };
}

/**
 * Unified teacher identity resolver for the logged-in Teacher Portal / Mobile API user.
 * Checks:
 *  1) Auth `user_metadata.teacher_id` (set by User Management on account creation)
 *  2) SQL `teachers.auth_user_id === user.id`
 *  3) Case-insensitive email across `user.email`, `users.email`, `teachers.email`, `staff_members`
 *  4) Normalized phone across `user`, `users`, `teachers`, `staff_members`
 *  5) Name fallback across `users.full_name` / `user_metadata.full_name`
 * Safe against PostgREST multi-row errors (uses array queries instead of `.maybeSingle()`).
 */
export async function resolveTeacherIdentityForAuthUser(params: {
  adminClient: AdminClient;
  madrasaId: string;
  user: {
    id: string;
    email?: string | null;
    phone?: string | null;
    user_metadata?: Record<string, any> | null;
  };
  userData?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    teacher_id?: string | null;
  } | null;
  madrasaMeta?: any;
}): Promise<TeacherIdentityResolution> {
  const { adminClient, madrasaId, user, userData } = params;

  const metaTeacherId = String(
    userData?.teacher_id || user?.user_metadata?.teacher_id || ""
  ).trim();
  const authUserId = String(user?.id || "").trim();

  const candidateIds = new Set<string>();
  if (metaTeacherId) candidateIds.add(metaTeacherId);

  const emailSignals = new Set<string>();
  for (const e of [user?.email, userData?.email]) {
    const norm = normalizeEmail(e);
    if (norm) emailSignals.add(norm);
  }

  const phoneSignals = new Set<string>();
  for (const p of [user?.phone, user?.user_metadata?.phone, userData?.phone]) {
    const norm = normalizePhoneDigits(p);
    if (norm.length >= 6) phoneSignals.add(norm);
  }

  const nameSignals: string[] = [];
  for (const n of [userData?.full_name, user?.user_metadata?.full_name]) {
    const trimmed = String(n || "").trim();
    if (trimmed) nameSignals.push(trimmed);
  }

  const [teachersRes, meta] = await Promise.all([
    madrasaId
      ? adminClient
          .from("teachers")
          .select("id, first_name, last_name, designation, email, phone, auth_user_id")
          .eq("madrasa_id", madrasaId)
      : Promise.resolve({ data: [] as any[] }),
    params.madrasaMeta !== undefined
      ? Promise.resolve(params.madrasaMeta)
      : madrasaId
      ? getMadrasaMetadata(madrasaId)
      : Promise.resolve(null),
  ]);

  const teachersList: any[] = Array.isArray(teachersRes?.data) ? teachersRes.data : [];
  const staffMembers: any[] = Array.isArray(meta?.staff_members) ? meta.staff_members : [];

  // Pass 1: Strong matches (metaTeacherId, auth_user_id, email, phone) in teachers & staff_members
  let matchedTeacher: any | null =
    teachersList.find((t) => metaTeacherId && String(t.id) === metaTeacherId) ||
    teachersList.find((t) => authUserId && String(t.auth_user_id || "") === authUserId) ||
    teachersList.find((t) => t.email && emailSignals.has(normalizeEmail(t.email))) ||
    teachersList.find((t) => {
      const tp = normalizePhoneDigits(t.phone);
      return tp.length >= 6 && phoneSignals.has(tp);
    }) ||
    null;

  let matchedStaff: any | null =
    staffMembers.find(
      (s) => metaTeacherId && (s?.id === metaTeacherId || s?.legacy_id === metaTeacherId)
    ) ||
    staffMembers.find((s) => authUserId && s?.auth_user_id === authUserId) ||
    staffMembers.find((s) => s?.contact?.email && emailSignals.has(normalizeEmail(s.contact.email))) ||
    staffMembers.find((s) => {
      const sp = normalizePhoneDigits(s?.contact?.phone);
      return sp.length >= 6 && phoneSignals.has(sp);
    }) ||
    null;

  // Pass 2: Name-based fallback if strong match missed
  if (!matchedTeacher) {
    matchedTeacher =
      teachersList.find((t) => {
        const full = getTeacherRowFullName(t);
        return (
          nameSignals.some((n) => namesMatch(n, full)) ||
          (t.first_name &&
            String(t.first_name).trim().length >= 3 &&
            nameSignals.some((n) => normalizeName(n).includes(normalizeName(t.first_name))))
        );
      }) || null;
  }

  if (!matchedStaff) {
    matchedStaff =
      staffMembers.find((s) => {
        const full = getStaffFullName(s);
        const first = String(s?.personal?.first_name || "").trim();
        return (
          nameSignals.some((n) => namesMatch(n, full)) ||
          (first.length >= 3 &&
            nameSignals.some((n) => normalizeName(n).includes(normalizeName(first))))
        );
      }) || null;
  }

  // Pass 3: Expand candidateIds using both resolved teacher & staff cross-references
  const seedId =
    matchedTeacher?.id ||
    matchedStaff?.id ||
    metaTeacherId ||
    "";

  if (seedId && madrasaId) {
    const cross = await resolveTeacherCandidateIdsByStaffId({
      adminClient,
      madrasaId,
      staffOrTeacherId: String(seedId),
      madrasaMeta: meta,
    });
    cross.candidateIds.forEach((id) => candidateIds.add(id));
    if (!matchedTeacher && cross.matchedTeacher) matchedTeacher = cross.matchedTeacher;
    if (!matchedStaff && cross.matchedStaff) matchedStaff = cross.matchedStaff;
  }

  // Also add any additional matching teacher rows (e.g. duplicate profiles sharing auth_user_id/email)
  for (const t of teachersList) {
    const tEmail = normalizeEmail(t.email);
    const tPhone = normalizePhoneDigits(t.phone);
    if (
      (metaTeacherId && String(t.id) === metaTeacherId) ||
      (authUserId && String(t.auth_user_id || "") === authUserId) ||
      (tEmail && emailSignals.has(tEmail)) ||
      (tPhone.length >= 6 && phoneSignals.has(tPhone))
    ) {
      candidateIds.add(String(t.id));
    }
  }

  if (matchedStaff?.id) candidateIds.add(String(matchedStaff.id));
  if (matchedStaff?.legacy_id) candidateIds.add(String(matchedStaff.legacy_id));
  if (matchedTeacher?.id) candidateIds.add(String(matchedTeacher.id));

  const fallbackName = String(userData?.full_name || user?.user_metadata?.full_name || "").trim();
  const teacherName =
    getTeacherRowFullName(matchedTeacher) ||
    getStaffFullName(matchedStaff) ||
    fallbackName ||
    "মুহতারাম উস্তাদ";

  const designation =
    matchedTeacher?.designation ||
    matchedStaff?.employment?.designation ||
    "মুদাররিস";

  const primaryTeacherId = String(
    matchedTeacher?.id || matchedStaff?.id || metaTeacherId || ""
  ).trim();

  return {
    teacherId: primaryTeacherId,
    teacherName,
    designation,
    candidateIds: Array.from(candidateIds),
    matchedTeacher,
    matchedStaff,
  };
}
