import { getTransportOverview } from "@/app/actions/transport";
import TransportClient from "@/components/transport/TransportClient";

export const dynamic = "force-dynamic";

export default async function TransportPage() {
  const overview = await getTransportOverview();

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <TransportClient initialOverview={overview} />
    </div>
  );
}
