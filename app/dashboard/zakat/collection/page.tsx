import React from "react";
import { getDonations, getDonors, getFunds } from "@/app/actions/zakat";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import ZakatNav from "@/components/zakat/ZakatNav";
import CollectionClient from "./CollectionClient";

export default async function ZakatCollectionPage({
  searchParams,
}: {
  searchParams?: Promise<{ donor_id?: string; fund?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const [donations, donors, funds, madrasaInfo] = await Promise.all([
    getDonations(),
    getDonors(),
    getFunds(),
    getMadrasaInfo(),
  ]);

  return (
    <div className="space-y-6">
      <ZakatNav totalFundsCount={funds.length} totalDonorsCount={donors.length} />
      <CollectionClient
        initialDonations={donations}
        donors={donors}
        funds={funds}
        madrasaInfo={madrasaInfo}
        preselectedDonorId={resolvedParams.donor_id}
        preselectedFundName={resolvedParams.fund}
      />
    </div>
  );
}
