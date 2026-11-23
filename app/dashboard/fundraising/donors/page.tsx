import { Suspense } from "react";
import { getFundChoices } from "@/app/actions/zakat";
import { getLifeMemberDonors } from "@/app/actions/fundraising";
import { getMadrasaInfo, toPublicMadrasaInfo } from "@/lib/getMadrasaInfo";
import DonorsClient from "./DonorsClient";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DonorsManagementPage() {
  const [{ donors, payments }, madrasaInfo, funds] = await Promise.all([
    getLifeMemberDonors(),
    getMadrasaInfo(), getFundChoices(),
  ]);

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <DonorsClient funds={funds} initialDonors={donors} initialPayments={payments} madrasaInfo={toPublicMadrasaInfo(madrasaInfo)} />
    </Suspense>
  );
}
