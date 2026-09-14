import React from "react";
import { getFunds, getDonations, getDonors } from "@/app/actions/zakat";
import ZakatNav from "@/components/zakat/ZakatNav";
import FundsClient from "./FundsClient";

export default async function ZakatFundsPage() {
  const [funds, donors] = await Promise.all([
    getFunds(),
    getDonors(),
  ]);

  const enrichedFunds = funds.map((f) => ({
    ...f,
    total_collected: f.total_collected || 0,
    donations_count: f.donations_count || 0,
    unique_donors_count: f.unique_donors_count || 0,
  }));

  return (
    <div className="space-y-6">
      <ZakatNav totalFundsCount={funds.length} totalDonorsCount={donors.length} />
      <FundsClient initialFunds={enrichedFunds} />
    </div>
  );
}
