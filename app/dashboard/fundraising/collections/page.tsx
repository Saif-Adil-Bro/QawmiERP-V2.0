import { Suspense } from "react";
import { getLeatherCollections, getCollectionBoxes, syncFundraisingCollectionsToDonations } from "@/app/actions/fundraising";
import { getFunds } from "@/app/actions/zakat";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import CollectionsClient from "./CollectionsClient";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CollectionsManagementPage() {
  // Ensure any collections are synchronized to the donations ledger
  await syncFundraisingCollectionsToDonations().catch(() => {});

  const [leatherBatches, boxesData, funds, madrasaInfo] = await Promise.all([
    getLeatherCollections(),
    getCollectionBoxes(),
    getFunds(),
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
      <CollectionsClient
        initialLeathers={leatherBatches}
        initialBoxes={boxesData.boxes}
        availableFunds={funds}
        madrasaInfo={madrasaInfo}
      />
    </Suspense>
  );
}
