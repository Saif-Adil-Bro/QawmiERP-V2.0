import { linkedStudents, webIdentity, hasRole } from "./portal/identity";
import { studentRoles } from "./portal/rules";
import { createClient } from "./supabase/server";

export async function getPortalStudentData(requestedStudentId?: string) {
  const i = await webIdentity();
  if (!i || !hasRole(i, studentRoles)) return null;
  const { students, child, meta } = await linkedStudents(i, requestedStudentId);
  return {
    students,
    child,
    meta,
    user: i.user,
    userData: i.userRow,
    madrasaId: i.tenant,
    madrasaPrefix: meta.prefix || meta.short_code || "",
    adminClient: i.db,
    supabase: await createClient(),
  };
}
