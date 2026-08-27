import React from "react";
import { getZakatReportStats, getFunds, getDonors, getDonations } from "@/app/actions/zakat";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import ZakatNav from "@/components/zakat/ZakatNav";
import ReportsClient from "./ReportsClient";

export default async function ZakatReportsPage() {
  const [stats, funds, donors, donations, madrasaInfo] = await Promise.all([
    getZakatReportStats(),
    getFunds(),
    getDonors(),
    getDonations(),
    getMadrasaInfo(),
  ]);

  return (
    <div className="space-y-6">
      <ZakatNav totalFundsCount={funds.length} totalDonorsCount={donors.length} />
      <ReportsClient
        stats={stats}
        funds={funds}
        donors={donors}
        donations={donations}
        madrasaInfo={madrasaInfo}
      />
    </div>
  );
}
