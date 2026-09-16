import React from "react";
import { getUnifiedIncomeHistory } from "@/app/actions/accounting";
import { getMadrasaProfileWithLogo } from "@/app/actions/tenant";
import IncomeHistoryClient from "./IncomeHistoryClient";
import PermissionGuard from "@/components/permissions/PermissionGuard";

export const dynamic = "force-dynamic";

export default async function IncomeHistoryPage() {
  const [incomeData, madrasaRes] = await Promise.all([
    getUnifiedIncomeHistory(),
    getMadrasaProfileWithLogo(),
  ]);

  return (
    <PermissionGuard permission="finance.view">
      <IncomeHistoryClient
        initialData={incomeData}
        madrasaInfo={madrasaRes?.madrasa}
        logoUrl={madrasaRes?.logoUrl || ""}
      />
    </PermissionGuard>
  );
}
