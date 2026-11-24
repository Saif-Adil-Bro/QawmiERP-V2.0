import { cache } from "react";
import { getAuthMadrasaId } from "@/app/actions/students";
import { writeGuard } from "@/lib/action-authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMadrasaMetadata, hydrateStudentWithMetadata } from "@/lib/sessions";
import { rows } from "@/lib/portal/queries";
import {
  type HealthStudent,
  type HealthCase,
  type StaffCase,
  HEALTH_ROLES,
  type HealthWidgetData,
  priority,
  healthStats,
} from "./model";
import { HealthError, readCases } from "./store";
import { webIdentity, webTeacher, hasRole } from "@/lib/portal/identity";
import { studentRoles } from "@/lib/portal/rules";
export const staffContext = cache(async () => {
  const guard = await writeGuard("student_health");
  if (!guard.allowed) throw new HealthError(guard.error);
  const tenant = await getAuthMadrasaId();
  if (!guard.userId || !tenant || tenant !== guard.madrasaId)
    throw new HealthError("মাদরাসার পরিচয় যাচাই করা যায়নি।");
  return { db: await createAdminClient(), tenant, actor: guard.userId };
});
export type StaffContext = Awaited<ReturnType<typeof staffContext>>;
export async function roster(
  { db, tenant }: StaffContext,
  ids?: string[],
): Promise<HealthStudent[]> {
  if (ids && !ids.length) return [];
  const [list, meta, teacherCtx] = await Promise.all([
    rows(() => {
      const q = db
        .from("students")
        .select("*,classes(name)")
        .eq("madrasa_id", tenant);
      return ids ? q.in("id", ids) : q;
    }),
    getMadrasaMetadata(tenant, true),
    webTeacher(),
  ]);
  const isStrictTeacher =
    teacherCtx &&
    !hasRole(teacherCtx.i, ["super_admin", "admin", "muhtamim", "hostel_manager"]);
  const allowedClassIds = isStrictTeacher
    ? new Set(teacherCtx.scope.classes.map((c: any) => c.id))
    : null;
  const scopedList = allowedClassIds
    ? list.filter((raw: any) => raw.class_id && allowedClassIds.has(raw.class_id))
    : list;
  return scopedList.map((raw) => {
    const s = hydrateStudentWithMetadata(raw, meta);
    return {
      id: s.id,
      name:
        [s.first_name, s.last_name].filter(Boolean).join(" ") ||
        "নাম অনুপস্থিত",
      class_id: s.class_id || null,
      class_name: s.class_name || "",
      roll_number: String(s.roll_number || ""),
      student_id_code: String(
        s.student_id_code || s.student_id_formatted || "",
      ),
      photo_url: s.photo_url || "",
      guardian_name: s.guardian_name || s.father_name || "",
      parent_phone: s.parent_phone || "",
    };
  });
}
export function joinStudents(
  records: HealthCase[],
  students: HealthStudent[],
): StaffCase[] {
  const byId = new Map(students.map((s) => [s.id, s]));
  return records.flatMap((r) => {
    const student = byId.get(r.student_id);
    return student ? [{ ...r, student }] : [];
  });
}
export async function workspace() {
  const c = await staffContext();
  const [records, students] = await Promise.all([
    readCases(c.db, c.tenant),
    roster(c),
  ]);
  return { records: joinStudents(records, students), students };
}
export async function healthWidget(expected?: {
  tenant: string;
  actor: string;
}): Promise<HealthWidgetData | "unavailable" | null> {
  try {
    const i = await webIdentity(true);
    if (
      !i ||
      (expected &&
        (i.tenant !== expected.tenant || i.user.id !== expected.actor)) ||
      !hasRole(i, HEALTH_ROLES) ||
      hasRole(i, studentRoles)
    )
      return null;
    const c = await staffContext(),
      active = await readCases(c.db, c.tenant, {
        activeOnly: true,
        timeline: false,
      });
    active.sort((a, b) => priority(b) - priority(a));
    const unique = [...new Set(active.map((r) => r.student_id))].slice(0, 5);
    const students = await roster(c, unique),
      cases = joinStudents(
        unique.map((id) => active.find((r) => r.student_id === id)!),
        students,
      );
    const { active: count, urgent } = healthStats(active);
    return {
      active: count,
      urgent,
      cases: cases.map(
        ({
          id,
          status,
          severity,
          illness_type,
          student: { name, class_name, roll_number },
        }) => ({
          id,
          status,
          severity,
          illness_type,
          name,
          class_name,
          roll_number,
        }),
      ),
    };
  } catch {
    return "unavailable";
  }
}
