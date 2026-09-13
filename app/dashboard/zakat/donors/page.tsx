import React, { Suspense } from "react";
import { getLifeMemberDonors } from "@/app/actions/fundraising";
import { getFunds } from "@/app/actions/zakat";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import ZakatNav from "@/components/zakat/ZakatNav";
import DonorsClient from "@/app/dashboard/fundraising/donors/DonorsClient";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DonorsPage() {
  const [{ donors, payments }, funds, madrasaInfo] = await Promise.all([
    getLifeMemberDonors(),
    getFunds(),
    getMadrasaInfo(),
  ]);

  return (
    <div className="space-y-6">
      <ZakatNav totalFundsCount={funds.length} totalDonorsCount={donors.length} />
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[50vh]">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        }
      >
        <DonorsClient initialDonors={donors} initialPayments={payments} madrasaInfo={madrasaInfo} />
      </Suspense>
    </div>
  );
}
