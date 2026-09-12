import { Suspense } from "react";
import { getMahfils } from "@/app/actions/fundraising";
import MahfilListClient from "./MahfilListClient";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MahfilManagementPage() {
  const mahfils = await getMahfils();

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <MahfilListClient initialMahfils={mahfils} />
    </Suspense>
  );
}
