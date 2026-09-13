import { Suspense } from "react";
import PublicDonateClient from "./PublicDonateClient";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import { getPaymentGatewayConfig } from "@/app/actions/payment-gateway";
import { getOnlineDonationSettings } from "@/app/actions/fundraising";
import { getFunds } from "@/app/actions/zakat";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicDonatePage() {
  const [madrasaInfo, paymentGatewayConfig, donationSettings, funds] = await Promise.all([
    getMadrasaInfo(),
    getPaymentGatewayConfig(),
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
        madrasaInfo={madrasaInfo}
        paymentGatewayConfig={paymentGatewayConfig}
        donationSettings={donationSettings}
        funds={funds}
      />
    </Suspense>
  );
}

