import { redirect } from "next/navigation";

export default function PaymentGatewaySettingsRedirect() {
  redirect("/dashboard/accounting/gateway");
}
