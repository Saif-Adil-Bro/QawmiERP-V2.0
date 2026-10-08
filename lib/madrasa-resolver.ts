import { createAdminClient, createClient, getAuthUser } from "@/lib/supabase/server";
import { getAllMadrasasWithPrefixes } from "@/lib/madrasa-prefix-server";
import { getAuthMadrasaId } from "@/app/actions/students";

export interface MadrasaAdmissionInfo {
  id: string;
  name: string;
  prefix: string;
  short_code: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  isSpecificMatch: boolean;
}

export interface ResolveAdmissionResult {
  selectedMadrasa: MadrasaAdmissionInfo;
  availableMadrasas: Array<{
    id: string;
    name: string;
    prefix: string;
    short_code: string;
    address?: string;
  }>;
}

/**
 * Resolves which madrasa should receive the admission application
 * based on query parameter (?madrasa=xxx, ?madrasa_id=xxx, ?m=xxx),
 * or logged-in user context, or defaults to the primary active madrasa.
 */
export async function resolveMadrasaForAdmission(
  identifier?: string | null
): Promise<ResolveAdmissionResult> {
  try {
    const adminClient = await createAdminClient();
    const allMadrasas = await getAllMadrasasWithPrefixes();

    const availableMadrasas = allMadrasas.map((m) => {
      const meta = m.raw?.registration_no?.startsWith("{")
        ? JSON.parse(m.raw.registration_no)
        : m.raw?.metadata || {};

      return {
        id: m.id,
        name: m.name,
        prefix: m.prefix,
        short_code: meta.short_code || m.prefix.toLowerCase(),
        address: m.raw?.address || "",
        phone: m.raw?.contact_phone || m.raw?.phone || "",
        email: m.raw?.contact_email || m.raw?.email || "",
      };
    });

    let cleanInput = (identifier || "").trim();
    try {
      cleanInput = decodeURIComponent(cleanInput).trim();
    } catch {}
    const lowerInput = cleanInput.toLowerCase();

    // 1. Try matching with provided identifier if any
    if (lowerInput) {
      // a. Match full ID (exact 36-char UUID)
      let match = allMadrasas.find((m) => m.id.toLowerCase() === lowerInput);

      // b. Match Prefix (e.g. AHM, MSM, MT, ABH) - High priority to prevent short UUID collisions
      if (!match) {
        match = allMadrasas.find(
          (m) => m.prefix.toLowerCase() === lowerInput
        );
      }

      // c. Match short_code, slug, or metadata code
      if (!match) {
        match = allMadrasas.find((m) => {
          const meta = m.raw?.registration_no?.startsWith("{")
            ? JSON.parse(m.raw.registration_no)
            : m.raw?.metadata || {};
          const sc = (meta.short_code || meta.slug || meta.code || "").toLowerCase();
          return sc === lowerInput;
        });
      }

      // d. Match short UUID (ONLY if input is at least 8 characters and valid hex)
      if (!match && lowerInput.length >= 8 && /^[0-9a-f-]+$/i.test(lowerInput)) {
        match = allMadrasas.find((m) => m.id.toLowerCase().startsWith(lowerInput));
      }

      // e. Match by exact name first, then name keyword (only if at least 3 chars)
      if (!match) {
        match = allMadrasas.find((m) => m.name.toLowerCase() === lowerInput);
      }
      if (!match && lowerInput.length >= 3) {
        match = allMadrasas.find((m) =>
          m.name.toLowerCase().includes(lowerInput)
        );
      }

      if (match) {
        let logo_url = "";
        try {
          const supabase = await createClient();
          const { data: logoData } = supabase.storage
            .from("logos")
            .getPublicUrl(`madrasa_logo_${match.id}.png`);
          logo_url = logoData?.publicUrl || "";
        } catch {}

        return {
          selectedMadrasa: {
            id: match.id,
            name: match.name,
            prefix: match.prefix,
            short_code: match.prefix.toLowerCase(),
            address: match.raw?.address || "",
            phone: match.raw?.contact_phone || match.raw?.phone || "",
            email: match.raw?.contact_email || match.raw?.email || "",
            logo_url,
            isSpecificMatch: true,
          },
          availableMadrasas,
        };
      }
    }

    // 2. If no identifier provided or no match, check if there is a logged in user
    try {
      const supabase = await createClient();
      const user = await getAuthUser(supabase);
      if (user?.id) {
        const userMadrasaId = await getAuthMadrasaId(supabase, user);
        if (userMadrasaId) {
          const match = allMadrasas.find((m) => m.id === userMadrasaId);
          if (match) {
            return {
              selectedMadrasa: {
                id: match.id,
                name: match.name,
                prefix: match.prefix,
                short_code: match.prefix.toLowerCase(),
                address: match.raw?.address || "",
                phone: match.raw?.contact_phone || match.raw?.phone || "",
                email: match.raw?.contact_email || match.raw?.email || "",
                isSpecificMatch: false,
              },
              availableMadrasas,
            };
          }
        }
      }
    } catch {}

    // 3. Fallback: Prefer the madrasa that has registered classes or users
    // "25f5b85c-4b75-4255-846d-f5f84a61608c" is the primary active madrasa ("আলহাজ্ব আবুল হোসেন হাফিজিয়া মাদ্রাসা")
    const primaryActiveId = "25f5b85c-4b75-4255-846d-f5f84a61608c";
    let defaultMatch = allMadrasas.find((m) => m.id === primaryActiveId);

    // If not found, use first available
    if (!defaultMatch && allMadrasas.length > 0) {
      defaultMatch = allMadrasas[0];
    }

    if (defaultMatch) {
      return {
        selectedMadrasa: {
          id: defaultMatch.id,
          name: defaultMatch.name,
          prefix: defaultMatch.prefix,
          short_code: defaultMatch.prefix.toLowerCase(),
          address: defaultMatch.raw?.address || "",
          phone: defaultMatch.raw?.contact_phone || defaultMatch.raw?.phone || "",
          email: defaultMatch.raw?.contact_email || defaultMatch.raw?.email || "",
          isSpecificMatch: false,
        },
        availableMadrasas,
      };
    }

    // Ultimate fallback if no madrasas table
    return {
      selectedMadrasa: {
        id: "default_madrasa_id",
        name: "কওমি মাদরাসা",
        prefix: "QM",
        short_code: "qm",
        isSpecificMatch: false,
      },
      availableMadrasas: [],
    };
  } catch (err) {
    console.error("Error in resolveMadrasaForAdmission:", err);
    return {
      selectedMadrasa: {
        id: "default_madrasa_id",
        name: "কওমি মাদরাসা",
        prefix: "QM",
        short_code: "qm",
        isSpecificMatch: false,
      },
      availableMadrasas: [],
    };
  }
}
