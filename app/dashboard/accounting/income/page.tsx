import { toPublicMadrasaInfoFromRecord } from "@/lib/getMadrasaInfo";
import React from "react";
import { getUnifiedIncomeHistory } from "@/app/actions/accounting";
import { getMadrasaProfileWithLogo } from "@/app/actions/tenant";
import IncomeHistoryClient from "./IncomeHistoryClient";
import PermissionGuard from "@/components/permissions/PermissionGuard";

export const dynamic = "force-dynamic";

export default async function IncomeHistoryPage() {
  const [incomeData, madrasaRes] = await Promise.all([
    getUnifiedIncomeHistory().catch(()=>null),
    getMadrasaProfileWithLogo(),
  ]);

  return (
    <PermissionGuard permission="finance.view">
      {!incomeData ? <p role="alert">পূর্ণ আয়ের হিসাব পড়া যায়নি। আবার চেষ্টা করুন।</p> : <IncomeHistoryClient
        initialData={incomeData}
        madrasaInfo={toPublicMadrasaInfoFromRecord(madrasaRes?.madrasa)}
        logoUrl={madrasaRes?.logoUrl || ""}
      />}
    </PermissionGuard>
  );
}
