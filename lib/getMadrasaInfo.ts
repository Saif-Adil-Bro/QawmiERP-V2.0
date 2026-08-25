import { createClient } from "@/lib/supabase/server";

export async function getMadrasaInfo() {
  let madrasaInfo = { 
    id: "",
    name: "Qawmi Madrasa", 
    address: "Please update address", 
    phone: "", 
    email: "",
    logo_url: "",
    registration_no: "",
    reg_no: "",
    established_year: "",
    principal_name: "",
    principal_signature_url: "",
    signature_url: "",
    eiin_code: "",
    slogan: "",
    website: "",
  };

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userDetails } = await supabase.from('users').select('madrasa_id').eq('id', user.id).single();
      if (userDetails?.madrasa_id) {
        const { data: fullMadrasa, error } = await supabase
          .from('madrasas')
          .select('*')
          .eq('id', userDetails.madrasa_id)
          .single();

        const { data: logoData } = supabase.storage.from('logos').getPublicUrl(`madrasa_logo_${userDetails.madrasa_id}.png`);
        const { data: sigData } = supabase.storage.from('signatures').getPublicUrl(`madrasa_signature_${userDetails.madrasa_id}.png`);

        if (!error && fullMadrasa) {
          let meta: Record<string, any> = {};
          if (fullMadrasa.registration_no) {
            try {
              if (fullMadrasa.registration_no.startsWith("{")) {
                meta = JSON.parse(fullMadrasa.registration_no);
              } else {
                meta = { reg_no: fullMadrasa.registration_no };
              }
            } catch {
              meta = { reg_no: fullMadrasa.registration_no };
            }
          }

          madrasaInfo = {
            id: fullMadrasa.id || userDetails.madrasa_id,
            name: fullMadrasa.name || madrasaInfo.name,
            address: fullMadrasa.address || madrasaInfo.address,
            phone: fullMadrasa.contact_phone || madrasaInfo.phone,
            email: fullMadrasa.contact_email || madrasaInfo.email,
            logo_url: meta.logo_url || logoData?.publicUrl || "",
            registration_no: meta.reg_no || (typeof fullMadrasa.registration_no === "string" && !fullMadrasa.registration_no.startsWith("{") ? fullMadrasa.registration_no : ""),
            reg_no: meta.reg_no || "",
            established_year: meta.established_year || "",
            principal_name: meta.principal_name || "",
            principal_signature_url: meta.signature_url || sigData?.publicUrl || "",
            signature_url: meta.signature_url || sigData?.publicUrl || "",
            eiin_code: meta.eiin_code || "",
            slogan: meta.slogan || "",
            website: meta.website || "",
          };
        }
      }
    }
  } catch (e) {
    console.error("Error fetching madrasa info", e);
  }
  return madrasaInfo;
}
