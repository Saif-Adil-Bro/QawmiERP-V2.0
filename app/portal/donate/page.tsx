import { Suspense } from "react";
import PublicDonateClient from "./PublicDonateClient";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default function PublicDonatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <PublicDonateClient />
    </Suspense>
  );
}
