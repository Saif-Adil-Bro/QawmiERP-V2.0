import { Suspense } from "react";
import { getLifeMemberDonors } from "@/app/actions/fundraising";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import DonorsClient from "./DonorsClient";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DonorsManagementPage() {
  const [{ donors, payments }, madrasaInfo] = await Promise.all([
    getLifeMemberDonors(),
    getMadrasaInfo(),
  ]);

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <DonorsClient initialDonors={donors} initialPayments={payments} madrasaInfo={madrasaInfo} />
    </Suspense>
  );
}
