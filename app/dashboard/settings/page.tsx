import { getMadrasaDetails } from "@/app/actions/tenant";
import { getFundChoices } from "@/app/actions/zakat";
import SettingsClient from "./SettingsClient";
import PermissionGuard from "@/components/permissions/PermissionGuard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsPage() {
  const [madrasa, funds] = await Promise.all([
    getMadrasaDetails(),
    getFundChoices().catch(() => []),
  ]);

  if (!madrasa) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-100 shadow-sm">
        <p className="text-slate-500">মাদরাসার তথ্য খুঁজে পাওয়া যায়নি। অনুগ্রহ করে আবার লগইন করুন।</p>
      </div>
    );
  }

  return (
    <PermissionGuard permission="settings.view">
      <SettingsClient
        madrasa={madrasa}
        initialLogoUrl={madrasa.logo_url || ""}
        initialSignatureUrl={madrasa.principal_signature_url || ""}
        funds={funds}
      />
    </PermissionGuard>
  );
}
