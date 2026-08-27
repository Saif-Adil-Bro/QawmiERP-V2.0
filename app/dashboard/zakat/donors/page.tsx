import React from "react";
import { getDonors, getFunds } from "@/app/actions/zakat";
import ZakatNav from "@/components/zakat/ZakatNav";
import DonorsClient from "./DonorsClient";

export default async function DonorsPage() {
  const [donors, funds] = await Promise.all([
    getDonors(),
    getFunds(),
  ]);

  return (
    <div className="space-y-6">
      <ZakatNav totalFundsCount={funds.length} totalDonorsCount={donors.length} />
      <DonorsClient initialDonors={donors} funds={funds} />
    </div>
  );
}
