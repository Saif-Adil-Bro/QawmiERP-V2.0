// Finance grants are school-wide. A linked pupil/teacher portal never widens to
// the school's books, even if its account also has a legacy secondary role.
export const financeDeniedRoles = [
  "student",
  "parent",
  "guardian",
  "guardian_student",
  "teacher",
  "hifz_teacher",
  "hifz_supervisor",
  "ustad",
];
export const financeRoles = [
  "super_admin",
  "admin",
  "muhtamim",
  "naib_muhtamim",
  "accountant",
];
export const financeWritePermissions = [
  "finance.create",
  "finance.edit",
  "fee.create",
  "fee.edit",
];
export const financeReadPermissions = [
  ...financeWritePermissions,
  "finance.approve",
  "fee.approve",
  "fee.view",
  "finance.view",
  "finance.manage",
];
export function canReadSchoolFinance(
  roles: readonly string[],
  permissions: readonly string[],
) {
  const names = roles.map((r) => String(r).toLowerCase());
  return (
    !names.some((r) => financeDeniedRoles.includes(r)) &&
    (names.some((r) => financeRoles.includes(r)) ||
      permissions.some((p) => financeReadPermissions.includes(p)))
  );
}
