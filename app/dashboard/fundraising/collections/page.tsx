import { Suspense } from "react";
import { getLeatherCollections, getCollectionBoxes } from "@/app/actions/fundraising";
import CollectionsClient from "./CollectionsClient";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CollectionsManagementPage() {
  const [leatherBatches, boxesData] = await Promise.all([
    getLeatherCollections(),
    getCollectionBoxes(),
  ]);

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <CollectionsClient initialLeathers={leatherBatches} initialBoxes={boxesData.boxes} />
    </Suspense>
  );
}
