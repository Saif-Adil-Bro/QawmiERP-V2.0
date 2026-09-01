import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";

export async function getMadrasaInfo() {
  let madrasaInfo = { 
    id: "",
    name: "মাদ্রাসাতুল মুসলিমীন", 
    address: "ঠিকানা হালনাগাদ করুন", 
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
    const user = await getAuthUser(supabase);
    const adminClient = await createAdminClient();

    let targetMadrasaId: string | null = null;

    if (user?.id) {
      const { data: userDetails } = await adminClient
        .from("users")
        .select("madrasa_id")
        .eq("id", user.id)
        .single();
      targetMadrasaId = userDetails?.madrasa_id || null;
    }

    if (!targetMadrasaId) {
      const { data: firstMadrasa } = await adminClient
        .from("madrasas")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
      targetMadrasaId = firstMadrasa?.id || null;
    }

    if (targetMadrasaId) {
      const { data: fullMadrasa, error } = await adminClient
        .from("madrasas")
        .select("*")
        .eq("id", targetMadrasaId)
        .single();

      const { data: logoData } = supabase.storage
        .from("logos")
        .getPublicUrl(`madrasa_logo_${targetMadrasaId}.png`);
      const { data: sigData } = supabase.storage
        .from("signatures")
        .getPublicUrl(`madrasa_signature_${targetMadrasaId}.png`);

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
          id: fullMadrasa.id || targetMadrasaId,
          name: fullMadrasa.name || madrasaInfo.name,
          address: fullMadrasa.address || madrasaInfo.address,
          phone: fullMadrasa.contact_phone || madrasaInfo.phone,
          email: fullMadrasa.contact_email || madrasaInfo.email,
          logo_url: meta.logo_url || logoData?.publicUrl || "",
          registration_no:
            meta.reg_no ||
            (typeof fullMadrasa.registration_no === "string" &&
            !fullMadrasa.registration_no.startsWith("{")
              ? fullMadrasa.registration_no
              : ""),
          reg_no: meta.reg_no || "",
          established_year: meta.established_year || "",
          principal_name:
            meta.principal_name ||
            meta.mohtamim_name ||
            (fullMadrasa as any).principal_name ||
            (fullMadrasa as any).mohtamim_name ||
            "",
          principal_signature_url: meta.signature_url || sigData?.publicUrl || "",
          signature_url: meta.signature_url || sigData?.publicUrl || "",
          eiin_code: meta.eiin_code || "",
          slogan: meta.slogan || "",
          website: meta.website || "",
        };
      }
    }
  } catch (e) {
    console.error("Error fetching madrasa info", e);
  }
  return madrasaInfo;
}
