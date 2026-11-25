import { SessionUnavailableError } from "../current-app-session";
import {
  canViewUnmaskedField,
  maskStudentSensitiveFields,
} from "../pii-masking";
import {
  extractTeacherCandidateNames,
  normalizeBengaliTeacherName,
  normalizePhoneKey,
  resolveTeacherIdentity,
  teacherDisplay,
} from "../teacher-identity";
import { cache } from "react";
import { getWebAppSession, createAdminClient } from "@/lib/supabase/server";
import {
  loadServerPermissions,
  type ServerPermissionContext,
} from "@/lib/permissions-server";
import { getMadrasaMetadata, hydrateStudentWithMetadata } from "@/lib/sessions";
import { linkedIds, selected, studentRoles, teacherRoles } from "./rules";
import { rows, routines } from "./queries";

export type Identity = {
  db: any;
  user: any;
  userRow: any;
  tenant: string;
  perms: ServerPermissionContext;
};
export function hasRole(identity: Identity, roles: string[]) {
  return [
    identity.userRow.role,
    identity.perms.profile.primaryRole,
    ...identity.perms.roles,
  ].some((r) => roles.includes(String(r).toLowerCase()));
}
const resolveWebIdentity = cache(async (): Promise<Identity | null> => {
  const verified = await getWebAppSession();
  if (!verified) return null;
  const { user, session } = verified;
  const db = await createAdminClient();
  const { data: userRow, error } = await db
    .from("users")
    .select("*")
    .eq("id", user.id)
    .eq("madrasa_id", session.madrasa_id)
    .maybeSingle();
  if (error) throw new SessionUnavailableError();
  const tenant = userRow?.madrasa_id;
  const perms = tenant && (await loadServerPermissions(user.id, tenant));
  if (tenant && !perms) throw new SessionUnavailableError();
  if (!perms || perms.status !== "ACTIVE") return null;
  return { db, user, userRow, tenant, perms };
});
// Snapshots distinguish a temporary lookup failure from revocation: do not clear
// an owner's last good offline copy on a 5xx. Other callers simply get no identity.
export async function webIdentity(
  reportUnavailable = false,
): Promise<Identity | null> {
  try {
    return await resolveWebIdentity();
  } catch (error) {
    if (reportUnavailable) throw error;
    return null;
  }
}
export async function linkedStudents(i: Identity, requested?: string | null) {
  let ids = hasRole(i, studentRoles)
    ? linkedIds(i.userRow, i.perms.profile)
    : [];
  if (!ids.length && hasRole(i, studentRoles)) {
    const metaStudentId = i.user?.user_metadata?.student_id;
    if (typeof metaStudentId === "string" && metaStudentId.trim()) {
      ids = [metaStudentId.trim()];
    } else {
      try {
        const { findStudentByIdentifier } = await import("@/lib/student-auth");
        const emailToResolve = String(i.userRow?.email || i.user?.email || "").trim();
        if (emailToResolve) {
          const resolved = await findStudentByIdentifier(emailToResolve);
          if (resolved?.student?.id && (!resolved.madrasaId || resolved.madrasaId === i.tenant)) {
            ids = [resolved.student.id];
          }
        }
        if (!ids.length && i.userRow?.full_name) {
          const targetName = String(i.userRow.full_name).replace(/\s*\(অভিভাবক\)\s*$/, "").trim();
          const allTenantStudents = await rows(() =>
            i.db
              .from("students")
              .select("id, first_name, last_name")
              .eq("madrasa_id", i.tenant)
          );
          const byName = allTenantStudents.find(
            (s: any) => `${s.first_name || ""} ${s.last_name || ""}`.trim() === targetName
          );
          if (byName?.id) {
            ids = [byName.id];
          }
        }
        if (ids.length === 1 && i.userRow?.id && !i.userRow.student_id) {
          await i.db
            .from("users")
            .update({ student_id: ids[0] })
            .eq("id", i.userRow.id)
            .eq("madrasa_id", i.tenant);
          i.userRow.student_id = ids[0];
        }
      } catch {
        // non-fatal fallback
      }
    }
  }
  if (!ids.length && hasRole(i, ["super_admin", "admin", "muhtamim"])) {
    const previewRows = await rows(() =>
      i.db
        .from("students")
        .select("id")
        .eq("madrasa_id", i.tenant)
        .order("roll_number")
        .limit(25),
    );
    ids = previewRows.map((r: any) => r.id).filter(Boolean);
  }
  const meta = await getMadrasaMetadata(i.tenant, true);
  const students = !ids.length
    ? []
    : (
        await rows(() =>
          i.db
            .from("students")
            .select("*, classes(*)")
            .eq("madrasa_id", i.tenant)
            .in("id", ids)
            .order("roll_number"),
        )
      ).map((s) => hydrateStudentWithMetadata(s, meta));
  return { students, child: selected(students, requested), meta };
}

export type TeacherStaffHint = {
  legacyId?: string | null;
  teacherId?: string | null;
  email?: string | null;
  phone?: string | null;
  fullNameBn?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

const ANY_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUnmaskedValue = (v: unknown): string => {
  if (typeof v !== "string") return "";
  const trimmed = v.trim();
  if (!trimmed || trimmed.includes("*")) return "";
  return trimmed;
};

// Authenticated identity and administrator-maintained links only. A name, partial phone, or
// user_editable_metadata value is not a teacher assignment. Validate class IDs against the tenant.
export async function teacherScope(
  i: Identity,
  staffId?: string,
  staffHint?: TeacherStaffHint,
) {
  const { tenant, db } = i;
  const meta = await getMadrasaMetadata(tenant, true);
  const [teachers, tenantUsers] = await Promise.all([
    rows(() => db.from("teachers").select("*").eq("madrasa_id", tenant)),
    rows(() =>
      db
        .from("users")
        .select("id, email, full_name, phone, teacher_id, role")
        .eq("madrasa_id", tenant),
    ),
  ]);
  const staffMembers = Array.isArray(meta.staff_members) ? meta.staff_members : [];
  let { teacher, staff, keys } = resolveTeacherIdentity(
    teachers,
    staffMembers,
    staffId
      ? { linkedId: staffId }
      : {
          linkedId: i.userRow.teacher_id,
          authUserId: i.user.id,
          verifiedEmail: i.user.email_confirmed_at ? i.user.email : null,
        },
  );

  // PB-06 Bridge: When admin inspects a staff profile via staffId, bridge across metadata staff_members,
  // tenant users (email/phone/auth_user_id/normalized Bengali or English name -> user.teacher_id),
  // and SQL teachers (including duplicate rows sharing verified phone/name/email without conflicting auth).
  const matchedUserNames: string[] = [];
  if (staffId) {
    const keySet = new Set<string>(keys);
    keySet.add(staffId);
    if (staffHint?.legacyId) keySet.add(staffHint.legacyId);
    if (staffHint?.teacherId) keySet.add(staffHint.teacherId);

    if (!staff) {
      staff =
        staffMembers.find(
          (s: any) =>
            s.id === staffId ||
            s.legacy_id === staffId ||
            s.teacher_id === staffId ||
            (staffHint?.legacyId &&
              (s.id === staffHint.legacyId || s.legacy_id === staffHint.legacyId)),
        ) || null;
    }
    if (staff) {
      if (staff.id) keySet.add(staff.id);
      if (staff.legacy_id) keySet.add(staff.legacy_id);
      if (staff.teacher_id) keySet.add(staff.teacher_id);
    }

    const hintRecord = staffHint
      ? {
          full_name_bn: staffHint.fullNameBn,
          first_name: staffHint.firstName,
          last_name: staffHint.lastName,
        }
      : null;

    const candidateEmails = new Set<string>(
      [
        isUnmaskedValue(staff?.contact?.email),
        isUnmaskedValue(staff?.email),
        isUnmaskedValue(teacher?.email),
        isUnmaskedValue(staffHint?.email),
      ]
        .filter(Boolean)
        .map((e) => e.toLowerCase()),
    );
    const candidatePhones = new Set<string>(
      [
        isUnmaskedValue(staff?.contact?.phone),
        isUnmaskedValue(staff?.phone),
        isUnmaskedValue(teacher?.phone),
        isUnmaskedValue(staffHint?.phone),
      ]
        .map((p) => normalizePhoneKey(p))
        .filter(Boolean),
    );
    const candidateNames = new Set<string>([
      ...extractTeacherCandidateNames(staff),
      ...extractTeacherCandidateNames(teacher),
      ...extractTeacherCandidateNames(hintRecord),
    ]);

    const knownAuthIds = new Set<string>(
      [staff?.auth_user_id, teacher?.auth_user_id].filter(Boolean),
    );

    const matchedUsers = tenantUsers.filter((u: any) => {
      if (keySet.has(u.id) || (u.teacher_id && keySet.has(u.teacher_id))) {
        return true;
      }
      if (knownAuthIds.has(u.id)) return true;
      const uEmail = String(u.email || "").trim().toLowerCase();
      if (uEmail && candidateEmails.has(uEmail)) return true;
      const uPhone = normalizePhoneKey(u.phone);
      if (uPhone && candidatePhones.has(uPhone)) return true;
      const uName = normalizeBengaliTeacherName(u.full_name);
      if (uName && candidateNames.has(uName)) return true;
      return false;
    });

    for (const u of matchedUsers) {
      if (u.teacher_id) keySet.add(u.teacher_id);
      if (u.id) knownAuthIds.add(u.id);
      const uEmail = String(u.email || "").trim().toLowerCase();
      if (uEmail) candidateEmails.add(uEmail);
      const uPhone = normalizePhoneKey(u.phone);
      if (uPhone) candidatePhones.add(uPhone);
      if (u.full_name) {
        matchedUserNames.push(String(u.full_name).trim());
        const uNorm = normalizeBengaliTeacherName(u.full_name);
        if (uNorm) candidateNames.add(uNorm);
      }
    }

    const matchedTeachers = teachers.filter((t: any) => {
      if (keySet.has(t.id)) return true;
      if (t.auth_user_id && knownAuthIds.has(t.auth_user_id)) return true;
      // Do not bridge into a SQL teacher explicitly bound to a different auth account
      if (
        knownAuthIds.size > 0 &&
        t.auth_user_id &&
        !knownAuthIds.has(t.auth_user_id)
      ) {
        return false;
      }
      const tEmail = String(t.email || "").trim().toLowerCase();
      if (tEmail && candidateEmails.has(tEmail)) return true;
      const tPhone = normalizePhoneKey(t.phone);
      if (tPhone && candidatePhones.has(tPhone)) return true;
      const tNames = extractTeacherCandidateNames(t);
      if (tNames.some((n) => candidateNames.has(n))) return true;
      return false;
    });

    for (const mt of matchedTeachers) {
      if (mt.id) keySet.add(mt.id);
    }
    if (!teacher && matchedTeachers.length > 0) {
      teacher = matchedTeachers[0];
    }

    // Also include sibling staff records matching the same teacher ID / phone / normalized name
    // so meta.class_teachers keyed by an older or duplicate staff ID still resolves.
    for (const sm of staffMembers) {
      const smMatch =
        keySet.has(sm.id) ||
        (sm.legacy_id && keySet.has(sm.legacy_id)) ||
        (sm.teacher_id && keySet.has(sm.teacher_id)) ||
        (candidatePhones.size > 0 &&
          candidatePhones.has(normalizePhoneKey(sm.contact?.phone || sm.phone))) ||
        extractTeacherCandidateNames(sm).some((n) => candidateNames.has(n));
      if (smMatch) {
        if (sm.id) keySet.add(sm.id);
        if (sm.legacy_id) keySet.add(sm.legacy_id);
        if (sm.teacher_id) keySet.add(sm.teacher_id);
      }
    }

    keys = Array.from(keySet);
  }

  const teacherUuidKeys = Array.from(
    new Set(
      [teacher?.id, ...keys].filter((k) => k && ANY_UUID_RE.test(String(k))),
    ),
  );
  const [allClasses, rawAssignments, direct] = await Promise.all([
    rows(() => {
      const q = db.from("classes").select("*");
      try {
        return q.or(`madrasa_id.eq.${tenant},madrasa_id.is.null`).order("name");
      } catch {
        return db.from("classes").select("*").eq("madrasa_id", tenant).order("name");
      }
    }),
    teacherUuidKeys.length > 0
      ? rows(() => {
          const q = db
            .from("teacher_subjects")
            .select("*, subjects(id,name,code), classes(id,name)")
            .in("teacher_id", teacherUuidKeys);
          try {
            return q.or(`madrasa_id.eq.${tenant},madrasa_id.is.null`);
          } catch {
            return db
              .from("teacher_subjects")
              .select("*, subjects(id,name,code), classes(id,name)")
              .eq("madrasa_id", tenant)
              .in("teacher_id", teacherUuidKeys);
          }
        })
      : [],
    teacherUuidKeys.length > 0
      ? rows(() =>
          db
            .from("routines")
            .select("id,class_id")
            .eq("madrasa_id", tenant)
            .in("teacher_id", teacherUuidKeys),
        )
      : [],
  ]);

  // Hydrate missing class/subject joins on teacher_subjects and deduplicate by class+subject
  const classLookup = new Map(allClasses.map((c: any) => [String(c.id), c]));
  let subjectLookup = new Map<string, any>();
  const missingSubjectIds = Array.from(
    new Set(
      rawAssignments
        .filter((a: any) => !a.subjects?.name && a.subject_id)
        .map((a: any) => String(a.subject_id)),
    ),
  );
  if (missingSubjectIds.length > 0) {
    try {
      const { data: subRows } = await db
        .from("subjects")
        .select("id, name, code")
        .in("id", missingSubjectIds);
      subjectLookup = new Map(
        (subRows || []).map((s: any) => [String(s.id), s]),
      );
    } catch {
      // non-fatal hydration fallback
    }
  }

  const seenAssignmentPairs = new Set<string>();
  const assignments = rawAssignments
    .map((a: any) => {
      const cls =
        (Array.isArray(a.classes) ? a.classes[0] : a.classes) ||
        classLookup.get(String(a.class_id)) ||
        null;
      const sub =
        (Array.isArray(a.subjects) ? a.subjects[0] : a.subjects) ||
        subjectLookup.get(String(a.subject_id)) ||
        null;
      return {
        ...a,
        classes: cls,
        subjects: sub,
      };
    })
    .filter((a: any) => {
      const pairKey = `${a.class_id || ""}:${a.subject_id || ""}`;
      if (seenAssignmentPairs.has(pairKey)) return false;
      seenAssignmentPairs.add(pairKey);
      return true;
    });

  const display = teacherDisplay(teacher, staff, i.userRow.full_name);
  const targetNames = new Set(
    [
      display.name,
      staff?.personal?.full_name_bn,
      [staff?.personal?.first_name, staff?.personal?.last_name]
        .filter(Boolean)
        .join(" "),
      [teacher?.first_name, teacher?.last_name].filter(Boolean).join(" "),
      staffHint?.fullNameBn,
      [staffHint?.firstName, staffHint?.lastName].filter(Boolean).join(" "),
      ...matchedUserNames,
      !staffId ? i.userRow?.full_name : "",
    ]
      .flatMap((n) => {
        if (typeof n !== "string" || !n.trim()) return [];
        const trimmed = n.trim();
        const normalized = normalizeBengaliTeacherName(trimmed);
        return normalized ? [trimmed, normalized] : [trimmed];
      })
      .filter(Boolean),
  );
  const inCharge = allClasses.filter((c) => {
    const byKey = [
      c.class_teacher_id,
      c.in_charge_teacher_id,
      meta.class_teachers?.[c.id]?.teacher_id,
    ].some((v) => v && keys.includes(v));
    if (byKey) return true;
    const assignedName = String(
      meta.class_teachers?.[c.id]?.teacher_name || "",
    ).trim();
    const assignedNorm = normalizeBengaliTeacherName(assignedName);
    return Boolean(
      (assignedName && targetNames.has(assignedName)) ||
        (assignedNorm && targetNames.has(assignedNorm)),
    );
  });
  const isAdminPreview =
    !staffId && hasRole(i, ["super_admin", "admin", "muhtamim"]);
  const classIds = new Set([
    ...(!staffId ? i.perms.profile.assignedClassIds || [] : []),
    ...inCharge.map((c) => c.id),
    ...assignments.map((a) => a.class_id),
    ...direct.map((r) => r.class_id),
  ]);
  const classes =
    classIds.size > 0
      ? allClasses.filter((c) => classIds.has(c.id))
      : isAdminPreview
        ? allClasses
        : [];
  return {
    teacher,
    staff,
    display,
    meta,
    classes,
    assignments,
    inCharge,
    keys,
  };
}
const cachedTeacherScope = cache(async () => {
  const i = await webIdentity();
  if (!i) return null;
  return { i, scope: await teacherScope(i) };
});
export const webTeacher = async (allowAdmin = false) => {
  const ctx = await cachedTeacherScope();
  if (!ctx) return null;
  if (
    !hasRole(ctx.i, teacherRoles) &&
    !(allowAdmin && hasRole(ctx.i, ["super_admin", "admin", "muhtamim"]))
  ) {
    return null;
  }
  return ctx;
};
export type TeacherScope = Awaited<ReturnType<typeof teacherScope>>;
export async function teacherSchedule(i: Identity, s: TeacherScope) {
  // A class/subject assignment grants roster access, not every slot on its timetable.
  const teacherUuidKeys = Array.from(
    new Set(
      [s.teacher?.id, ...s.keys].filter(
        (k) => k && ANY_UUID_RE.test(String(k)),
      ),
    ),
  );
  const visible =
    teacherUuidKeys.length > 0 && s.classes.length > 0
      ? await routines(
          i.db,
          i.tenant,
          s.classes.map((c) => c.id),
          teacherUuidKeys,
        )
      : [];
  return {
    teacherId: s.teacher?.id || s.staff?.id || "",
    isTeachingStaff: !!(s.classes.length || s.teacher || s.staff),
    assignedSubjects: s.assignments.map((a) => ({
      ...a,
      class_name: a.classes?.name || "নির্ধারিত জামাত",
      subject_name: a.subjects?.name || "নির্ধারিত কিতাব",
      subject_code: a.subjects?.code || null,
    })),
    inChargeClasses: s.inCharge.map((c) => ({
      class_id: c.id,
      class_name: c.name,
    })),
    routines: visible,
  };
}
export async function teacherStudents(
  i: Identity,
  scope: TeacherScope,
  classIds = scope.classes.map((c) => c.id),
) {
  const ids = classIds.filter((id) => scope.classes.some((c) => c.id === id));
  if (!ids.length) return [];
  const allTenantStudents = await rows(() =>
    i.db
      .from("students")
      .select("id, created_at")
      .eq("madrasa_id", i.tenant)
      .order("created_at", { ascending: true }),
  );
  const { getStudentIdNumber } = await import("@/lib/student-utils");
  const prefix = scope.meta?.id_prefix || "MUSE";
  const classMap = new Map<string, string>(
    scope.classes.map((c: any) => [String(c.id), String(c.name || "")])
  );
  return (
    await rows(() =>
      i.db
        .from("students")
        .select("*, classes(*)")
        .eq("madrasa_id", i.tenant)
        .in("class_id", ids)
        .order("roll_number"),
    )
  )
    .map((s) => hydrateStudentWithMetadata(s, scope.meta))
    .filter((s) => ["ACTIVE", "IRREGULAR"].includes(s.student_status))
    .map((s) => {
      // School directory fields only. Do not serialize financial, medical or ID-document metadata to Teacher clients.
      const rawId =
        s.student_id_formatted ||
        s.student_id ||
        getStudentIdNumber(s, allTenantStudents.length ? allTenantStudents : [s], prefix);
      const cleanPrefix = String(prefix).replace(/[-_\s]+$/g, "").toUpperCase();
      const computedId =
        rawId && cleanPrefix && /^\d+$/.test(String(rawId).trim())
          ? `${cleanPrefix}-${String(rawId).trim()}`
          : rawId;
      const resolvedClassName =
        (Array.isArray(s.classes) ? s.classes[0]?.name : s.classes?.name) ||
        s.class_name ||
        (s.class_id ? classMap.get(String(s.class_id)) : "") ||
        "নির্ধারিত জামাত";
      const {
        id,
        madrasa_id,
        first_name,
        last_name,
        class_id,
        classes,
        section,
        roll_number,
        student_status,
        photo_url,
        guardian_name,
        father_name,
        guardian_relation,
        parent_phone,
        address,
        blood_group,
      } = s;
      return maskStudentSensitiveFields(
        {
          id,
          madrasa_id,
          first_name,
          last_name,
          class_id,
          class_name: resolvedClassName,
          classes: classes || { id: class_id, name: resolvedClassName },
          section,
          roll_number,
          student_id: computedId,
          student_id_formatted: computedId,
          student_status,
          photo_url,
          guardian_name,
          father_name,
          guardian_relation,
          parent_phone,
          address,
          blood_group,
        },
        canViewUnmaskedField(i.perms.summary, "students", "phone"),
      );
    });
}
