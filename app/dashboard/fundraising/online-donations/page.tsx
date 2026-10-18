import { Suspense } from "react";
import { getOnlineDonations, getOnlineDonationSettings } from "@/app/actions/fundraising";
import { getMadrasaInfo, toPublicMadrasaInfo } from "@/lib/getMadrasaInfo";
import { getFunds } from "@/app/actions/zakat";
import OnlineDonationsClient from "./OnlineDonationsClient";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OnlineDonationsPage() {
  // ⛔ গেটওয়ে কনফিগ ক্লায়েন্টে ব্যবহৃত হয় না — পূর্ণ কনফিগ (store_passwd/app_secret)
  // prop হিসেবে পাঠানো মানে সেটি browser-এ সিরিয়ালাইজ হয়ে ফাঁস হওয়া। বাদ দেওয়া হলো।
  const [donations, donationSettings, madrasaInfo, funds] = await Promise.all([
    getOnlineDonations(),
    getOnlineDonationSettings(),
    getMadrasaInfo(),
    getFunds(),
  ]);

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <OnlineDonationsClient
        initialDonations={donations}
        initialSettings={donationSettings}
        madrasaInfo={toPublicMadrasaInfo(madrasaInfo)}
        funds={funds}
      />
    </Suspense>
  );
}

