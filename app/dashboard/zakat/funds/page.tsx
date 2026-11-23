import React from "react";
import { getFundOverview, getDonors } from "@/app/actions/zakat";
import ZakatNav from "@/components/zakat/ZakatNav";
import FundsClient from "./FundsClient";

export default async function ZakatFundsPage() {
  const [{funds, review, error}, donors] = await Promise.all([
    getFundOverview(),
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
      {error && <p role="alert">{error}</p>}
      {review.length > 0 && <details id="reconciliation" className="rounded-lg border border-amber-400 bg-amber-50 p-4">
        <summary className="cursor-pointer font-bold">ম্যানুয়াল সমন্বয় প্রয়োজন ({review.length})</summary>
        <p className="my-2">এই রেকর্ডগুলো মুছে ফেলা হয়নি। যাচাই না হওয়া পর্যন্ত নিশ্চিত ফান্ড স্থিতিতে ধরা হয়নি। মূল ভাউচার ও মাহফিলের জমার সঙ্গে মিলিয়ে দেখুন।</p>
        <ul className="max-h-80 overflow-auto">{review.map((r,i) => <li key={`${r.kind}:${r.id}:${i}`} className="border-t py-2">
          {r.date} · {r.kind === "donation" ? "জমা" : "ব্যয়"} · {r.voucher} · ৳{r.amount} · {r.reason} <small>({r.id})</small>
        </li>)}</ul>
      </details>}
      {!error && <FundsClient initialFunds={enrichedFunds} />}
    </div>
  );
}
