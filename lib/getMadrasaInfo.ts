import { createClient } from "@/lib/supabase/server";

export async function getMadrasaInfo() {
  let madrasaInfo = { name: "Qawmi Madrasa", address: "Please update address", phone: "", logo_url: "" };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userDetails } = await supabase.from('users').select('madrasa_id').eq('id', user.id).single();
      if (userDetails?.madrasa_id) {
        // Try fetching with address and contact_phone
        const { data: fullMadrasa, error } = await supabase.from('madrasas').select('name, address, contact_phone').eq('id', userDetails.madrasa_id).single();
        if (!error && fullMadrasa) {
           madrasaInfo = {
             name: fullMadrasa.name || madrasaInfo.name,
             address: fullMadrasa.address || madrasaInfo.address,
             phone: fullMadrasa.contact_phone || madrasaInfo.phone,
             logo_url: supabase.storage.from('logos').getPublicUrl(`madrasa_logo_${userDetails.madrasa_id}.png`).data.publicUrl
           };
        } else {
           // Fallback to just name
           const { data: nameOnly } = await supabase.from('madrasas').select('name').eq('id', userDetails.madrasa_id).single();
           if (nameOnly) {
             madrasaInfo.name = nameOnly.name || madrasaInfo.name;
           }
           madrasaInfo.logo_url = supabase.storage.from('logos').getPublicUrl(`madrasa_logo_${userDetails.madrasa_id}.png`).data.publicUrl;
        }
      }
    }
  } catch (e) {
    console.error("Error fetching madrasa info", e);
  }
  return madrasaInfo;
}
