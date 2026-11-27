import {parseRoutineItem} from "@/lib/routine-helper";
import { SessionUnavailableError } from "../current-app-session";
import {
  canViewUnmaskedField,
  maskStudentSensitiveFields,
} from "../pii-masking";
import {
  normalizeBengaliTeacherName,
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
  const { getMadrasaPrefixById } = await import("@/lib/madrasa-prefix-server");
  const { getStudentIdNumber } = await import("@/lib/student-utils");
  const prefix = await getMadrasaPrefixById(i.tenant, meta, i.db);
  const allTenantStudents = ids.length
    ? await rows(() =>
        i.db
          .from("students")
          .select("id, created_at")
          .eq("madrasa_id", i.tenant)
          .order("created_at", { ascending: true }),
      )
    : [];
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
      )
        .map((s) => hydrateStudentWithMetadata(s, meta))
        .map((s) => {
          const computedId = getStudentIdNumber(
            s,
            allTenantStudents.length ? allTenantStudents : [s],
            prefix,
          );
          return {
            ...s,
            madrasa_prefix: prefix,
            prefix,
            student_id: computedId,
            student_id_formatted: computedId,
          };
        });
  return { students, child: selected(students, requested), meta, madrasaPrefix: prefix };
}

// Authenticated identity and administrator-maintained links only. A name, partial phone, or
// user_editable_metadata value is not a teacher assignment. Validate class IDs against the tenant.
export async function teacherScope(
  i: Identity,
  staffId?: string,
  profile = false,
) {
  const { tenant, db } = i;
  const meta = await getMadrasaMetadata(tenant, true);
  const [teachers, tenantUsers] = await Promise.all([
    rows(() => db.from("teachers").select("*").eq("madrasa_id", tenant)),
    staffId ? rows(() =>
      db
        .from("users")
        .select("id,email,full_name,teacher_id")
        .eq("madrasa_id", tenant),
    ) : [],
  ]);
  const staffMembers = Array.isArray(meta.staff_members) ? meta.staff_members.filter((s:any)=>!s.madrasa_id || s.madrasa_id===tenant) : [];
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

  // Administrative directory ids may refer to a staff record, its previous id,
  // a tenant user, or the SQL teacher. Only trust server-owned rows for aliases;
  // display hints from the browser must not grant another teacher's timetable.
  const matchedUserNames: string[] = [];
  const targetKeys = new Set(keys);
  if (staffId) {
    const email = String(staff?.contact?.email || teacher?.email || "").trim().toLowerCase();
    const authId = teacher?.auth_user_id || staff?.auth_user_id;
    const users = tenantUsers.filter(u => u.id === staffId || u.id === authId || targetKeys.has(u.teacher_id) ||
      (!authId && email && String(u.email || "").toLowerCase() === email));
    for (const u of users) {
      if (authId && u.id !== authId) continue;
      targetKeys.add(u.id);
      if (!u.teacher_id) continue;
      const linked = resolveTeacherIdentity(teachers, staffMembers, {linkedId:u.teacher_id});
      if (linked.teacher?.auth_user_id && linked.teacher.auth_user_id !== u.id) continue;
      for (const id of linked.keys) targetKeys.add(id);
      teacher ??= linked.teacher;
      staff ??= linked.staff;
      if (u.full_name) matchedUserNames.push(u.full_name);
    }
  }
  keys = [...targetKeys];
  // Never pass a metadata alias to a UUID column. The directory/assignment
  // source of truth is membership in this tenant's SQL teachers, not ID syntax.
  const teacherUuidKeys = teachers.filter(t=>targetKeys.has(t.id)).map(t=>t.id);
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
    !profile && teacherUuidKeys.length > 0
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
    .filter(a=>classLookup.has(String(a.class_id)))
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

  const display = teacherDisplay(teacher, staff, staffId ? "" : i.userRow.full_name);
  const targetNames = new Set(
    [
      display.name,
      staff?.personal?.full_name_bn,
      [staff?.personal?.first_name, staff?.personal?.last_name]
        .filter(Boolean)
        .join(" "),
      [teacher?.first_name, teacher?.last_name].filter(Boolean).join(" "),
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
    // A stored id wins over a namesake. Name-only links are historical display
    // metadata, usable only in a permission-checked staff preview.
    if (!staffId || meta.class_teachers?.[c.id]?.teacher_id || c.class_teacher_id || c.in_charge_teacher_id) return false;
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
    keys, teacherUuidKeys,
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
export async function teacherSchedule(i: Identity, s: TeacherScope, profile = false) {
  // A class/subject assignment grants roster access, not every slot on its timetable.
  const teacherUuidKeys = s.teacherUuidKeys;
  let routineUnavailable = false;
  const visible =
    profile && teacherUuidKeys.length ? await rows(()=>i.db.from("routines").select("*, classes(id,name), subjects(id,name)").eq("madrasa_id",i.tenant).in("teacher_id",teacherUuidKeys).order("start_time"))
        .then(rs=>rs.map(r=>({...parseRoutineItem(r),class_name:r.classes?.name,subject_name:r.subjects?.name})))
        .catch(()=>{routineUnavailable=true;return [];}) : teacherUuidKeys.length > 0 && s.classes.length > 0
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
    routines: visible, routineUnavailable,
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
  const { getMadrasaPrefixById } = await import("@/lib/madrasa-prefix-server");
  const prefix = await getMadrasaPrefixById(i.tenant, scope.meta, i.db);
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
      const computedId = getStudentIdNumber(
        s,
        allTenantStudents.length ? allTenantStudents : [s],
        prefix,
      );
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
