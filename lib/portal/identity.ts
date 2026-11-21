import { SessionUnavailableError } from "../current-app-session";
import {
  canViewUnmaskedField,
  maskStudentSensitiveFields,
} from "../pii-masking";
import { resolveTeacherIdentity, teacherDisplay } from "../teacher-identity";
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
  const ids = hasRole(i, studentRoles)
    ? linkedIds(i.userRow, i.perms.profile)
    : [];
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

// Authenticated identity and administrator-maintained links only. A name, partial phone, or
// user_editable_metadata value is not a teacher assignment. Validate class IDs against the tenant.
export async function teacherScope(i: Identity, staffId?: string) {
  const { tenant, db } = i;
  const meta = await getMadrasaMetadata(tenant, true);
  const teachers = await rows(() =>
    db.from("teachers").select("*").eq("madrasa_id", tenant),
  );
  const { teacher, staff, keys } = resolveTeacherIdentity(
    teachers,
    meta.staff_members || [],
    staffId
      ? { linkedId: staffId }
      : {
          linkedId: i.userRow.teacher_id,
          authUserId: i.user.id,
          verifiedEmail: i.user.email_confirmed_at ? i.user.email : null,
        },
  );
  const [allClasses, assignments, direct] = await Promise.all([
    rows(() =>
      db.from("classes").select("*").eq("madrasa_id", tenant).order("name"),
    ),
    teacher
      ? rows(() =>
          db
            .from("teacher_subjects")
            .select("*, subjects(id,name,code), classes(id,name)")
            .eq("madrasa_id", tenant)
            .eq("teacher_id", teacher.id),
        )
      : [],
    teacher
      ? rows(() =>
          db
            .from("routines")
            .select("id,class_id")
            .eq("madrasa_id", tenant)
            .eq("teacher_id", teacher.id),
        )
      : [],
  ]);
  const inCharge = allClasses.filter((c) =>
    [
      c.class_teacher_id,
      c.in_charge_teacher_id,
      meta.class_teachers?.[c.id]?.teacher_id,
    ].some((v) => v && keys.includes(v)),
  );
  const classIds = new Set([
    ...(!staffId ? i.perms.profile.assignedClassIds || [] : []),
    ...inCharge.map((c) => c.id),
    ...assignments.map((a) => a.class_id),
    ...direct.map((r) => r.class_id),
  ]);
  const classes = allClasses.filter((c) => classIds.has(c.id));
  return {
    teacher,
    staff,
    display: teacherDisplay(teacher, staff, i.userRow.full_name),
    meta,
    classes,
    assignments,
    inCharge,
    keys,
  };
}
export const webTeacher = cache(async () => {
  const i = await webIdentity();
  if (!i || !hasRole(i, teacherRoles)) return null;
  return { i, scope: await teacherScope(i) };
});
export type TeacherScope = Awaited<ReturnType<typeof teacherScope>>;
export async function teacherSchedule(i: Identity, s: TeacherScope) {
  // A class/subject assignment grants roster access, not every slot on its timetable.
  const visible = s.teacher?.id
    ? await routines(
        i.db,
        i.tenant,
        s.classes.map((c) => c.id),
        s.teacher.id,
      )
    : [];
  return {
    teacherId: s.teacher?.id || s.staff?.id || "",
    isTeachingStaff: !!(s.classes.length || s.teacher || s.staff),
    assignedSubjects: s.assignments.map((a) => ({
      ...a,
      class_name: a.classes?.name,
      subject_name: a.subjects?.name,
      subject_code: a.subjects?.code,
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
      const {
        id,
        madrasa_id,
        first_name,
        last_name,
        class_id,
        class_name,
        classes,
        section,
        roll_number,
        student_id,
        student_id_formatted,
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
          class_name,
          classes,
          section,
          roll_number,
          student_id,
          student_id_formatted,
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
