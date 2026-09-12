import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { extractMadrasaPrefix, generateSuggestedPrefix } from "@/lib/madrasa-prefix";

export async function getMadrasaInfo(specificMadrasaId?: string) {
  let madrasaInfo = { 
    id: "",
    name: "মাদরাসা", 
    prefix: "",
    short_code: "",
    address: "", 
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
    metadata: {} as Record<string, any>,
  };

  try {
    const adminClient = await createAdminClient();
    let targetMadrasaId: string | null = specificMadrasaId || null;

    if (!targetMadrasaId) {
      try {
        const supabase = await createClient();
        const user = await getAuthUser(supabase);
        if (user?.id) {
          const { data: userDetails } = await adminClient
            .from("users")
            .select("madrasa_id")
            .eq("id", user.id)
            .single();
          targetMadrasaId = userDetails?.madrasa_id || null;
        }
      } catch {
        // Fallback for public requests outside user context
      }
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

      let logoUrl = "";
      let sigUrl = "";
      try {
        const supabase = await createClient();
        const { data: logoData } = supabase.storage
          .from("logos")
          .getPublicUrl(`madrasa_logo_${targetMadrasaId}.png`);
        const { data: sigData } = supabase.storage
          .from("signatures")
          .getPublicUrl(`madrasa_signature_${targetMadrasaId}.png`);
        logoUrl = logoData?.publicUrl || "";
        sigUrl = sigData?.publicUrl || "";
      } catch {
        // storage public url fallback
      }

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

        const resolvedPrefix =
          meta.prefix ||
          meta.short_code ||
          (fullMadrasa as any).prefix ||
          (fullMadrasa as any).short_code ||
          extractMadrasaPrefix(fullMadrasa) ||
          generateSuggestedPrefix(fullMadrasa.name || "") ||
          "";

        madrasaInfo = {
          id: fullMadrasa.id || targetMadrasaId,
          name: fullMadrasa.name || madrasaInfo.name || "মাদরাসা",
          prefix: resolvedPrefix,
          short_code: resolvedPrefix,
          address: fullMadrasa.address || "",
          phone: fullMadrasa.contact_phone || (fullMadrasa as any).phone || "",
          email: fullMadrasa.contact_email || (fullMadrasa as any).email || "",
          logo_url: meta.logo_url || logoUrl || "",
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
          principal_signature_url: meta.signature_url || sigUrl || "",
          signature_url: meta.signature_url || sigUrl || "",
          eiin_code: meta.eiin_code || "",
          slogan: meta.slogan || "",
          website: meta.website || "",
          metadata: meta,
        };
      }
    }
  } catch (e) {
    console.error("Error fetching madrasa info", e);
  }
  return madrasaInfo;
}
