// Input rows must already be scoped to the verified tenant. Staff previews pass
// only an explicit target, never the viewing administrator's email or auth ID.
type Target = {
  linkedId?: string | null;
  authUserId?: string;
  verifiedEmail?: string | null;
};
const norm = (v: unknown) =>
  typeof v === "string" ? v.trim().toLowerCase() : "";
const staffIdMatches = (s: any, id: string) =>
  s.id === id || s.legacy_id === id;

/** Canonical SQL profile and its staff/legacy aliases, not a fuzzy directory search. */
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
      ts = teachers.filter((t) => norm(t.email) === email);
      ss = staffMembers.filter((s) => norm(s.contact?.email) === email);
    }
  }
  const staffFullName = (s: any) =>
    norm(
      s?.personal?.full_name_bn ||
        [s?.personal?.first_name, s?.personal?.last_name].filter(Boolean).join(" "),
    );
  const teacherFullName = (t: any) =>
    norm([t?.first_name, t?.last_name].filter(Boolean).join(" "));

  if (!ts.length && ss.length === 1) {
    const s = ss[0];
    ts = teachers.filter((t) => staffIdMatches(s, t.id));
    if (!ts.length && s.auth_user_id)
      ts = teachers.filter((t) => t.auth_user_id === s.auth_user_id);
    const email = norm(s.contact?.email);
    if (
      !ts.length &&
      email &&
      staffMembers.filter((r) => norm(r.contact?.email) === email).length === 1
    )
      ts = teachers.filter((r) => norm(r.email) === email);
    const phone = norm(s.contact?.phone);
    if (
      !ts.length &&
      phone &&
      staffMembers.filter((r) => norm(r.contact?.phone) === phone).length === 1
    )
      ts = teachers.filter((r) => norm(r.phone) === phone);
    const sName = staffFullName(s);
    if (
      !ts.length &&
      sName &&
      staffMembers.filter((r) => staffFullName(r) === sName).length === 1
    )
      ts = teachers.filter((r) => teacherFullName(r) === sName);
  }
  if (!ss.length && ts.length === 1) {
    const t = ts[0];
    ss = staffMembers.filter((s) => staffIdMatches(s, t.id));
    if (!ss.length && t.auth_user_id)
      ss = staffMembers.filter((s) => s.auth_user_id === t.auth_user_id);
    const email = norm(t.email);
    if (
      !ss.length &&
      email &&
      teachers.filter((r) => norm(r.email) === email).length === 1
    )
      ss = staffMembers.filter((r) => norm(r.contact?.email) === email);
    const phone = norm(t.phone);
    if (
      !ss.length &&
      phone &&
      teachers.filter((r) => norm(r.phone) === phone).length === 1
    )
      ss = staffMembers.filter((r) => norm(r.contact?.phone) === phone);
    const tName = teacherFullName(t);
    if (
      !ss.length &&
      tName &&
      teachers.filter((r) => teacherFullName(r) === tName).length === 1
    )
      ss = staffMembers.filter((r) => staffFullName(r) === tName);
  }
  // Do not pick arbitrarily among duplicates or borrow an already-bound profile.
  const bindings = new Set(
    [
      authUserId,
      ...ts.map((t) => t.auth_user_id),
      ...ss.map((s) => s.auth_user_id),
    ].filter(Boolean),
  );
  if (ts.length > 1 || ss.length > 1 || (!linkedId && bindings.size > 1)) return empty;
  const teacher = ts[0] ?? null,
    staff = ss[0] ?? null;
  return {
    teacher,
    staff,
    keys: [
      ...new Set<string>(
        [teacher?.id, staff?.id, staff?.legacy_id].filter(Boolean),
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
