import { Suspense } from "react";
import { getSyllabusDashboardData } from "@/app/actions/syllabus";
import SyllabusDashboardClient from "./SyllabusDashboardClient";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "সিলেবাস ও একাডেমিক অগ্রগতি গোয়েন্দা ট্র্যাকার | QawmiManager",
  description: "কওমি মাদরাসা সিলেবাস পরিকল্পনা, দৈনিক পাঠদান, রিভিশন ইন্টারভাল ও কর্মদিবস ভিত্তিক পূর্বাভাস",
};

export default async function SyllabusDashboardPage() {
  const result = await getSyllabusDashboardData();

  if (!result.success || !result.data) {
    return (
      <div className="p-6 text-center">
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 inline-block text-sm">
          সিলেবাসের তথ্য লোড করা সম্ভব হয়নি: {result.error || "অজ্ঞাত ত্রুটি"}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        }
      >
        <SyllabusDashboardClient initialData={result.data as any} />
      </Suspense>
    </div>
  );
}
