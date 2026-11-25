// Input rows must already be scoped to the verified tenant. Staff previews pass
// only an explicit target, never the viewing administrator's email or auth ID.
type Target = {
  linkedId?: string | null;
  authUserId?: string;
  verifiedEmail?: string | null;
};
const norm = (v: unknown) =>
  typeof v === "string" ? v.trim().toLowerCase() : "";

const BANGLA_DIGITS: Record<string, string> = {
  "০": "0",
  "১": "1",
  "২": "2",
  "৩": "3",
  "৪": "4",
  "৫": "5",
  "৬": "6",
  "৭": "7",
  "৮": "8",
  "৯": "9",
};

export function normalizePhoneKey(v: unknown): string {
  if (typeof v !== "string") return "";
  const ascii = v.replace(/[০-৯]/g, (d) => BANGLA_DIGITS[d] || d);
  const digits = ascii.replace(/\D/g, "");
  if (!digits) return "";
  const stripped = digits.startsWith("880")
    ? digits.slice(2)
    : digits.startsWith("88") && digits.length > 11
      ? digits.slice(2)
      : digits;
  return stripped.length >= 10 ? stripped.slice(-10) : stripped;
}

export function normalizeBengaliTeacherName(v: unknown): string {
  if (typeof v !== "string") return "";
  return v
    .normalize("NFC")
    .replace(/য়/g, "য়")
    .replace(/ূ/g, "ু")
    .replace(/ী/g, "ি")
    .replace(/^(হযরত\s+|আলহাজ্ব\s+|মাওলানা\s+|হাফেজ\s+|হাফিয\s+|মুফতি\s+|মুফতী\s+|ক্বারী\s+|কারী\s+|উস্তাদ\s+|ওস্তাদ\s+|জনাব\s+|ড\.\s+|প্রফেসর\s+)+/gi, "")
    .replace(/(\s+সাহেব|\s+হুজুর|\s+দা\.বা\.|\s+রহ\.)+$/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const staffIdMatches = (s: any, id: string) =>
  Boolean(id) && (s.id === id || s.legacy_id === id || s.teacher_id === id);

/** Canonical SQL profile and its staff/legacy aliases, tolerant of duplicate rows and honorifics. */
export function resolveTeacherIdentity(
  teachers: any[],
  staffMembers: any[],
  target: Target,
) {
  const { linkedId, authUserId } = target;
  const empty = {
    teacher: null as any,
    staff: null as any,
    keys: [] as string[],
  };
  let ts: any[] = [],
    ss: any[] = [];
  if (linkedId) {
    ts = teachers.filter((t) => t.id === linkedId);
    ss = staffMembers.filter((s) => staffIdMatches(s, linkedId));
  } else if (authUserId) {
    ts = teachers.filter((t) => t.auth_user_id === authUserId);
    ss = staffMembers.filter((s) => s.auth_user_id === authUserId);
    const email = norm(target.verifiedEmail);
    if (!ts.length && !ss.length && email) {
      const emailTs = teachers.filter((t) => norm(t.email) === email);
      const emailSs = staffMembers.filter(
        (s) => norm(s.contact?.email || s.email) === email,
      );
      if (emailTs.length > 1 || emailSs.length > 1) return empty;
      if (emailTs.some((t) => t.auth_user_id && t.auth_user_id !== authUserId))
        return empty;
      if (emailSs.some((s) => s.auth_user_id && s.auth_user_id !== authUserId))
        return empty;
      ts = emailTs;
      ss = emailSs;
    }
  }
  const staffFullName = (s: any) =>
    normalizeBengaliTeacherName(
      s?.personal?.full_name_bn ||
        [s?.personal?.first_name, s?.personal?.last_name]
          .filter(Boolean)
          .join(" ") ||
        s?.name ||
        [s?.first_name, s?.last_name].filter(Boolean).join(" "),
    );
  const teacherFullName = (t: any) =>
    normalizeBengaliTeacherName(
      [t?.first_name, t?.last_name].filter(Boolean).join(" ") || t?.name,
    );

  if (!ts.length && ss.length >= 1) {
    const s = ss[0];
    ts = teachers.filter(
      (t) => staffIdMatches(s, t.id) || (s.teacher_id && t.id === s.teacher_id),
    );
    if (!ts.length && s.auth_user_id)
      ts = teachers.filter((t) => t.auth_user_id === s.auth_user_id);
    const email = norm(s.contact?.email || s.email);
    if (!ts.length && email) {
      const emailMatches = teachers.filter((r) => norm(r.email) === email);
      if (emailMatches.length > 1) return empty;
      ts = emailMatches;
    }
    const phone = normalizePhoneKey(s.contact?.phone || s.phone);
    if (!ts.length && phone) {
      const phoneMatches = teachers.filter(
        (r) => normalizePhoneKey(r.phone) === phone,
      );
      if (phoneMatches.length === 1) ts = phoneMatches;
    }
    const sName = staffFullName(s);
    if (!ts.length && sName) {
      const nameMatches = teachers.filter((r) => teacherFullName(r) === sName);
      if (nameMatches.length === 1) ts = nameMatches;
    }
  }
  if (!ss.length && ts.length >= 1) {
    const t = ts[0];
    ss = staffMembers.filter((s) => staffIdMatches(s, t.id));
    if (!ss.length && t.auth_user_id)
      ss = staffMembers.filter((s) => s.auth_user_id === t.auth_user_id);
    const email = norm(t.email);
    if (!ss.length && email) {
      const emailMatches = staffMembers.filter(
        (r) => norm(r.contact?.email || r.email) === email,
      );
      if (emailMatches.length > 1) return empty;
      ss = emailMatches;
    }
    const phone = normalizePhoneKey(t.phone);
    if (!ss.length && phone) {
      const phoneMatches = staffMembers.filter(
        (r) => normalizePhoneKey(r.contact?.phone || r.phone) === phone,
      );
      if (phoneMatches.length === 1) ss = phoneMatches;
    }
    const tName = teacherFullName(t);
    if (!ss.length && tName) {
      const nameMatches = staffMembers.filter((r) => staffFullName(r) === tName);
      if (nameMatches.length === 1) ss = nameMatches;
    }
  }

  // Reject conflicting auth_user_id bindings between linked teacher and staff records
  if (ts.length >= 1 && ss.length >= 1) {
    const tAuth = ts[0]?.auth_user_id;
    const sAuth = ss[0]?.auth_user_id;
    if (tAuth && sAuth && tAuth !== sAuth) {
      return empty;
    }
  }

  // Also collect any sibling duplicate teacher rows sharing the same normalized name or phone (only when no conflicting auth_user_id)
  if (ts.length >= 1) {
    const primary = ts[0];
    const pPhone = normalizePhoneKey(primary.phone);
    const pName = teacherFullName(primary);
    const extraTeachers = teachers.filter(
      (r) =>
        (!r.auth_user_id ||
          !primary.auth_user_id ||
          r.auth_user_id === primary.auth_user_id) &&
        ((pPhone && normalizePhoneKey(r.phone) === pPhone) ||
          (pName && teacherFullName(r) === pName)),
    );
    for (const et of extraTeachers) {
      if (!ts.some((x) => x.id === et.id)) ts.push(et);
    }
  }

  if (!ts.length && !ss.length) return empty;
  const teacher = ts[0] ?? null,
    staff = ss[0] ?? null;
  return {
    teacher,
    staff,
    keys: [
      ...new Set<string>(
        [
          ...ts.map((t) => t?.id),
          ...ss.map((s) => s?.id),
          ...ss.map((s) => s?.legacy_id),
          ...ss.map((s) => s?.teacher_id),
        ].filter(Boolean),
      ),
    ],
  };
}

export function teacherDisplay(teacher: any, staff: any, fallback: string) {
  const name = (r: any) =>
    [r?.first_name, r?.last_name].filter(Boolean).join(" ");
  return {
    name:
      name(teacher) ||
      staff?.personal?.full_name_bn ||
      name(staff?.personal) ||
      fallback,
    designation:
      teacher?.designation || staff?.employment?.designation || "মুদাররিস",
  };
}
