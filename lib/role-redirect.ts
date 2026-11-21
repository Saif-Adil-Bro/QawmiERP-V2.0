/**
 * QawmiManager - Role-based portal redirect resolver
 * Directs teachers, parents, students and administrators to their designated portals.
 */

export function getPortalRedirectUrl(
  primaryRole?: string | null,
  additionalRoles: string[] = []
): string {
  const allRoles = [primaryRole, ...additionalRoles]
    .filter(Boolean)
    .map((r) => String(r).toLowerCase().trim());

  // A portal grant cannot widen access to tenant-wide tables on a shared/multi-role account.
  // 2. Parent & Student Roles -> Parent Portal (/portal)
  const isParentOrStudent = allRoles.some((r) =>
    ["parent", "guardian", "student", "guardian_student"].includes(r)
  );

  if (isParentOrStudent) {
    return "/portal";
  }

  // 3. Teacher & Hifz Ustad Roles -> Teacher Portal (/teacher-portal)
  const isTeacher = allRoles.some((r) =>
    ["teacher", "hifz_teacher", "hifz_supervisor", "ustad"].includes(r)
  );

  if (isTeacher) {
    return "/teacher-portal";
  }

  // Default fallback
  return "/dashboard";
}
