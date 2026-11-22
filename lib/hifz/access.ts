import {
  webIdentity,
  hasRole,
  teacherScope,
  teacherStudents,
  type Identity,
} from "../portal/identity";
import { studentRoles, teacherRoles } from "../portal/rules";
import { rows } from "../portal/queries";
import { getMadrasaMetadata } from "../sessions";
import { MODULE_POLICIES } from "../action-authorization";
import { EntryError } from "./entries";
import type { WriteScope } from "./storage";
export async function staffScope(
  i: Identity | null,
  classId?: string,
  child?: string,
): Promise<WriteScope> {
  const policy = MODULE_POLICIES.hifz;
  if (
    !i ||
    hasRole(i, studentRoles) ||
    !(
      hasRole(i, policy.roles || []) ||
      policy.permissions?.some((p) =>
        i.perms.summary.effectivePermissions.includes(p),
      )
    )
  )
    throw new EntryError("হিফজ নথির অনুমতি নেই।", 403);
  const { tenant, db } = i;
  const matchClass = classId && classId !== "All" ? classId : undefined;
  if (hasRole(i, teacherRoles)) {
    const s = await teacherScope(i);
    const roster = await teacherStudents(
      i,
      s,
      matchClass ? [matchClass] : undefined,
    );
    return {
      tenant,
      db,
      actor: i.user.id,
      teacherId: s.teacher?.id,
      legacy: s.meta.student_profiles,
      roster: child ? roster.filter((r) => r.id === child) : roster,
    };
  }
  const [roster, meta] = await Promise.all([
    rows(() => {
      let q = db
        .from("students")
        .select(
          "id,first_name,last_name,roll_number,class_id,class_name,classes(name)",
        )
        .eq("madrasa_id", tenant);
      if (matchClass) q = q.eq("class_id", matchClass);
      return child ? q.eq("id", child) : q;
    }),
    getMadrasaMetadata(tenant, true),
  ]);
  return {
    tenant,
    db,
    actor: i.user.id,
    roster,
    legacy: meta.student_profiles,
  };
}
export async function webScope(classId?: string, child?: string) {
  return staffScope(await webIdentity(), classId, child);
}
