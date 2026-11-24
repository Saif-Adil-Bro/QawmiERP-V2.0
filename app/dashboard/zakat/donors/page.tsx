import React, { Suspense } from "react";
import { getLifeMemberDonors } from "@/app/actions/fundraising";
import { getFundChoices } from "@/app/actions/zakat";
import { getMadrasaInfo, toPublicMadrasaInfo } from "@/lib/getMadrasaInfo";
import ZakatNav from "@/components/zakat/ZakatNav";
import DonorsClient from "@/app/dashboard/fundraising/donors/DonorsClient";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DonorsPage() {
  const [{ donors, payments }, funds, madrasaInfo] = await Promise.all([
    getLifeMemberDonors(),
    getFundChoices(),
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
        <DonorsClient funds={funds} initialDonors={donors} initialPayments={payments} madrasaInfo={toPublicMadrasaInfo(madrasaInfo)} />
      </Suspense>
    </div>
  );
}
