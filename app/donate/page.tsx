import { Suspense } from "react";
import PublicDonateClient from "@/app/portal/donate/PublicDonateClient";
import { getMadrasaInfo, toPublicMadrasaInfo } from "@/lib/getMadrasaInfo";
import { getOnlineDonationSettings } from "@/app/actions/fundraising";
import { getFunds } from "@/app/actions/zakat";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "অনলাইন অনুদান ও দান | QawmiManager",
  description: "মাদ্রাসার লিল্লাহ বোর্ডিং, এতিমখানা ও দ্বীনি শিক্ষা তহবিলে সরাসরি অনলাইন অনুদান প্রদান করুন।",
};

export default async function PublicDonatePage() {
  // ⛔ পেমেন্ট গেটওয়ে কনফিগ আর ক্লায়েন্টে পাঠানো হয় না — এতে store_passwd /
  // app_secret পাবলিক পেজের HTML/RSC পেলোডে চলে যেত (ক্লায়েন্টে এটি ব্যবহৃতও হতো না)।
  const [madrasaInfo, donationSettings, funds] = await Promise.all([
    getMadrasaInfo(),
    getOnlineDonationSettings(),
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
      <PublicDonateClient
        madrasaInfo={toPublicMadrasaInfo(madrasaInfo)}
        donationSettings={donationSettings}
        funds={funds}
      />
    </Suspense>
  );
}
