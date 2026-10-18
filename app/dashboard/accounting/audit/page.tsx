import { getDhakaYear } from "@/lib/date-utils";
import { getAnnualAuditStatement } from "@/app/actions/audit";
import AuditStatementClient from "./AuditStatementClient";
import PermissionGuard from "@/components/permissions/PermissionGuard";

export default async function AuditStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year } = await searchParams;
  const currentYear = year || String(getDhakaYear());
  const statement = await getAnnualAuditStatement(currentYear);

  return (
    <PermissionGuard permission="expense.view">
      <AuditStatementClient
        initialStatement={statement}
        initialYear={currentYear}
      />
    </PermissionGuard>
  );
}
