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
    .replace(/ড়/g, "ড়")
    .replace(/ঢ়/g, "ঢ়")
    .replace(/ূ/g, "ু")
    .replace(/ী/g, "ি")
    .replace(/\([^)]*\)/g, " ")
    .replace(
      /^(হযরত\s+|আলহাজ্ব\s+|মাওলানা\s+|হাফেজ\s+|হাফিয\s+|মুফতি\s+|মুফতী\s+|ক্বারী\s+|ক্বারি\s+|কারী\s+|কারি\s+|মৌলভী\s+|মৌলভি\s+|উস্তাদ\s+|ওস্তাদ\s+|জনাব\s+|মোঃ\s*|মো\.\s*|মোহাম্মদ\s+|মুহাম্মদ\s+|মুহাম্মাদ\s+|ড\.\s+|প্রফেসর\s+)+/gi,
      "",
    )
    .replace(/(\s+সাহেব|\s+হুজুর|\s+দা\.বা\.|\s+রহ\.)+$/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function extractTeacherCandidateNames(record: any): string[] {
  if (!record) return [];
  const rawNames = [
    record?.personal?.full_name_bn,
    [record?.personal?.first_name, record?.personal?.last_name]
      .filter(Boolean)
      .join(" "),
    record?.full_name_bn,
    record?.full_name,
    record?.name,
    [record?.first_name, record?.last_name].filter(Boolean).join(" "),
  ];
  const out = new Set<string>();
  for (const raw of rawNames) {
    const n = normalizeBengaliTeacherName(raw);
    if (n) out.add(n);
  }
  return Array.from(out);
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
  const hasSharedName = (a: any, b: any) => {
    const aNames = extractTeacherCandidateNames(a);
    if (!aNames.length) return false;
    const bNames = new Set(extractTeacherCandidateNames(b));
    return aNames.some((n) => bNames.has(n));
  };

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
      if (emailMatches.length > 1) {
        if (!linkedId) return empty;
      } else {
        ts = emailMatches;
      }
    }
    const phone = normalizePhoneKey(s.contact?.phone || s.phone);
    if (!ts.length && phone.length===10) {
      const phoneMatches = teachers.filter(
        (r) => normalizePhoneKey(r.phone) === phone,
      );
      if (phoneMatches.length === 1) ts = phoneMatches;
      else if (phoneMatches.length && linkedId && phoneMatches.every(t => hasSharedName(s,t)) &&
        new Set([s,...phoneMatches].map(r=>r.auth_user_id).filter(Boolean)).size <= 1) ts = phoneMatches;
    }
    if (!authUserId && !ts.length && extractTeacherCandidateNames(s).length > 0) {
      const nameMatches = teachers.filter((r) => hasSharedName(s, r));
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
      if (emailMatches.length > 1) {
        if (!linkedId) return empty;
      } else {
        ss = emailMatches;
      }
    }
    const phone = normalizePhoneKey(t.phone);
    if (!ss.length && phone.length===10) {
      const phoneMatches = staffMembers.filter(
        (r) => normalizePhoneKey(r.contact?.phone || r.phone) === phone,
      );
      if (phoneMatches.length === 1) ss = phoneMatches;
    }
    if (!authUserId && !ss.length && extractTeacherCandidateNames(t).length > 0) {
      const nameMatches = staffMembers.filter((r) => hasSharedName(t, r));
      if (nameMatches.length === 1) ss = nameMatches;
    }
  }

  // Never bridge two distinct logins, even if their roster names/phones match.
  if(new Set([authUserId,...ts.map(t=>t.auth_user_id),...ss.map(s=>s.auth_user_id)].filter(Boolean)).size>1)return empty;

  // Match a duplicate by its verified account or BOTH full phone and name.
  if (ts.length >= 1) {
    const primary = ts[0];
    const pPhone = normalizePhoneKey(primary.phone);
    const extraTeachers = teachers.filter(r => r.id === primary.id || (
      (!r.auth_user_id || r.auth_user_id === (primary.auth_user_id || ss[0]?.auth_user_id || authUserId)) &&
      ((primary.auth_user_id && r.auth_user_id === primary.auth_user_id) ||
       (pPhone.length===10 && normalizePhoneKey(r.phone) === pPhone && hasSharedName(primary,r)))
    ));
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
