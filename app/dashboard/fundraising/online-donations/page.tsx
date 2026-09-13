import { Suspense } from "react";
import { getOnlineDonations, getOnlineDonationSettings } from "@/app/actions/fundraising";
import { getPaymentGatewayConfig } from "@/app/actions/payment-gateway";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import { getFunds } from "@/app/actions/zakat";
import OnlineDonationsClient from "./OnlineDonationsClient";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OnlineDonationsPage() {
  const [donations, donationSettings, paymentGatewayConfig, madrasaInfo, funds] = await Promise.all([
    getOnlineDonations(),
    getOnlineDonationSettings(),
    getPaymentGatewayConfig(),
    getMadrasaInfo(),
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
      <OnlineDonationsClient
        initialDonations={donations}
        initialSettings={donationSettings}
        paymentGatewayConfig={paymentGatewayConfig}
        madrasaInfo={madrasaInfo}
        funds={funds}
      />
    </Suspense>
  );
}

