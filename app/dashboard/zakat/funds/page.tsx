import React from "react";
import { getFunds, getDonations, getDonors } from "@/app/actions/zakat";
import ZakatNav from "@/components/zakat/ZakatNav";
import FundsClient from "./FundsClient";

export default async function ZakatFundsPage() {
  const [funds, donations, donors] = await Promise.all([
    getFunds(),
    getDonations(),
    getDonors(),
  ]);

  // Aggregate fund statistics
  const fundStatsMap = new Map<string, { totalCollected: number; donationCount: number; donorsCount: Set<string> }>();

  funds.forEach(f => {
    fundStatsMap.set(f.name, { totalCollected: 0, donationCount: 0, donorsCount: new Set() });
  });

  donations.forEach(d => {
    const fName = d.fund_name || d.donation_type || "সাধারণ ফান্ড";
    if (!fundStatsMap.has(fName)) {
      fundStatsMap.set(fName, { totalCollected: 0, donationCount: 0, donorsCount: new Set() });
    }
    const current = fundStatsMap.get(fName)!;
    current.totalCollected += Number(d.amount || 0);
    current.donationCount += 1;
    if (d.donor_id) current.donorsCount.add(d.donor_id);
  });

  const enrichedFunds = funds.map(f => {
    const stats = fundStatsMap.get(f.name) || { totalCollected: 0, donationCount: 0, donorsCount: new Set() };
    return {
      ...f,
      total_collected: stats.totalCollected,
      donations_count: stats.donationCount,
      unique_donors_count: stats.donorsCount.size,
    };
  });

  return (
    <div className="space-y-6">
      <ZakatNav totalFundsCount={funds.length} totalDonorsCount={donors.length} />
      <FundsClient initialFunds={enrichedFunds} />
    </div>
  );
}
