import React from "react";
import { getFunds, getDonors } from "@/app/actions/zakat";
import { getMadrasaProfileWithLogo } from "@/app/actions/tenant";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import ZakatNav from "@/components/zakat/ZakatNav";
import FundsClient from "./FundsClient";

export default async function ZakatFundsPage() {
  const [funds, donors, madrasaProfile] = await Promise.all([
    getFunds(),
    getDonors(),
    getMadrasaProfileWithLogo().catch(() => null),
  ]);

  const madrasaInfo = madrasaProfile?.madrasa || (await getMadrasaInfo().catch(() => null));

  const enrichedFunds = funds.map((f) => ({
    ...f,
    total_collected: f.total_collected || 0,
    donations_count: f.donations_count || 0,
    unique_donors_count: f.unique_donors_count || 0,
  }));

  return (
    <div className="space-y-6">
      <ZakatNav totalFundsCount={funds.length} totalDonorsCount={donors.length} />
      <FundsClient initialFunds={enrichedFunds} madrasaInfo={madrasaInfo} />
    </div>
  );
}

