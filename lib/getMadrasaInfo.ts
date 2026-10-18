import { getDefaultMadrasaId } from "@/lib/madrasa-default";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { extractMadrasaPrefix, generateSuggestedPrefix } from "@/lib/madrasa-prefix";

/**
 * মাদ্রাসার সম্পূর্ণ তথ্য — `metadata` সহ।
 *
 * ⚠️ `metadata`-তে থাকে payment gateway-এর `store_passwd`/`app_secret`,
 * biometric device-এর `secret_token`, `backup_history` ইত্যাদি গোপন তথ্য।
 * তাই এই অবজেক্ট **কখনো** পাবলিক API বা ক্লায়েন্ট কম্পোনেন্টে পাঠানো যাবে না —
 * সেখানে সবসময় `toPublicMadrasaInfo()` ব্যবহার করুন।
 */
export interface MadrasaInfoPayload {
  id: string;
  name: string;
  prefix: string;
  short_code: string;
  address: string;
  phone: string;
  email: string;
  logo_url: string;
  registration_no: string;
  reg_no: string;
  established_year: string;
  principal_name: string;
  principal_signature_url: string;
  signature_url: string;
  eiin_code: string;
  slogan: string;
  website: string;
  id_year_format: "hijri" | "gregorian" | "auto";
  metadata: Record<string, any>;
}

/** পাবলিক রেসপন্সে যেসব ফিল্ড যাওয়া বৈধ — শুধু প্রদর্শনের তথ্য, কোনো গোপন কী নয়। */
export type PublicMadrasaInfo = Omit<MadrasaInfoPayload, "metadata">;

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

/**
 * যেকোনো মাদ্রাসা-সদৃশ অবজেক্ট (getMadrasaInfo, getMadrasaDetails, action result …)
 * থেকে শুধু whitelisted পাবলিক ফিল্ড তুলে নেয়। `metadata` কখনো কপি হয় না।
 */
function pickPublicMadrasaFields(info: Record<string, any>): PublicMadrasaInfo {
  const idYearFormat = info.id_year_format;
  return {
    id: asString(info.id),
    name: asString(info.name, "মাদরাসা"),
    prefix: asString(info.prefix),
    short_code: asString(info.short_code),
    address: asString(info.address),
    phone: asString(info.phone),
    email: asString(info.email),
    logo_url: asString(info.logo_url),
    registration_no: asString(info.registration_no),
    reg_no: asString(info.reg_no),
    established_year: asString(info.established_year),
    principal_name: asString(info.principal_name),
    principal_signature_url: asString(info.principal_signature_url),
    signature_url: asString(info.signature_url),
    eiin_code: asString(info.eiin_code),
    slogan: asString(info.slogan),
    website: asString(info.website),
    id_year_format:
      idYearFormat === "gregorian" || idYearFormat === "auto" || idYearFormat === "hijri"
        ? idYearFormat
        : "hijri",
  };
}

/**
 * পাবলিক রেসপন্সের জন্য whitelist-ভিত্তিক স্যানিটাইজার।
 *
 * নতুন কোনো ফিল্ড `MadrasaInfoPayload`-এ যোগ হলেও এটি স্বয়ংক্রিয়ভাবে পাবলিক হবে না —
 * ইচ্ছাকৃতভাবে whitelist-এ যোগ করতে হবে। এভাবেই ভবিষ্যতে আর credential leak হবে না।
 */
export function toPublicMadrasaInfo(info: MadrasaInfoPayload): PublicMadrasaInfo;
export function toPublicMadrasaInfo(
  info: MadrasaInfoPayload | null | undefined
): PublicMadrasaInfo | undefined;
export function toPublicMadrasaInfo(
  info: MadrasaInfoPayload | null | undefined
): PublicMadrasaInfo | undefined {
  if (!info) return undefined;
  return pickPublicMadrasaFields(info as unknown as Record<string, any>);
}

/** ভিন্ন শেপের (যেমন `getMadrasaDetails`) অবজেক্টের জন্য একই whitelist প্রয়োগ। */
export function toPublicMadrasaInfoFromRecord(
  info: Record<string, any> | null | undefined
): PublicMadrasaInfo | undefined {
  if (!info || typeof info !== "object") return undefined;
  return pickPublicMadrasaFields(info);
}

export async function getMadrasaInfo(specificMadrasaId?: string): Promise<MadrasaInfoPayload> {
  let madrasaInfo: MadrasaInfoPayload = { 
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
    id_year_format: "hijri" as "hijri" | "gregorian" | "auto",
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
      // P2-Fix: hardcoded UUID সরানো — DEFAULT_MADRASA_ID env → সবচেয়ে পুরোনো মাদরাসা
      targetMadrasaId = await getDefaultMadrasaId();
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
          name: meta.name || fullMadrasa.name || madrasaInfo.name || "মাদরাসা",
          prefix: resolvedPrefix,
          short_code: resolvedPrefix,
          address: meta.address || fullMadrasa.address || "",
          phone: meta.phone || meta.contact_phone || fullMadrasa.phone || fullMadrasa.contact_phone || (fullMadrasa as any).phone || "",
          email: meta.email || meta.contact_email || fullMadrasa.email || fullMadrasa.contact_email || (fullMadrasa as any).email || "",
          logo_url: meta.logo_url || logoUrl || "",
          registration_no:
            meta.reg_no ||
            meta.registration_no ||
            (typeof fullMadrasa.registration_no === "string" &&
            !fullMadrasa.registration_no.startsWith("{")
              ? fullMadrasa.registration_no
              : ""),
          reg_no: meta.reg_no || meta.registration_no || "",
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
          id_year_format: meta.id_year_format || "hijri",
          metadata: meta,
        };
      }
    }
  } catch (e) {
    console.error("Error fetching madrasa info", e);
  }
  return madrasaInfo;
}
