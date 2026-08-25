import { getMadrasaDetails } from "@/app/actions/tenant";
import SettingsClient from "./SettingsClient";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const madrasa = await getMadrasaDetails();
  
  if (!madrasa) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-100 shadow-sm">
        <p className="text-slate-500">মাদরাসার তথ্য খুঁজে পাওয়া যায়নি। অনুগ্রহ করে আবার লগইন করুন।</p>
      </div>
    );
  }
  
  const supabase = await createClient();
  const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(`madrasa_logo_${madrasa.id}.png`);
  
  return (
    <SettingsClient madrasa={madrasa} initialLogoUrl={publicUrl} />
  );
}
