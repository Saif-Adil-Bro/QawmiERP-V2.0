import { createAdminClient } from "@/lib/supabase/server";
import {
  extractMadrasaPrefix,
  extractSavedMadrasaPrefix,
  generateSuggestedPrefix,
  findUniquePrefix,
  resolveMadrasaPrefix,
} from "./madrasa-prefix";

/**
 * Resolves a single tenant's prefix on the server in strict priority order:
 * 1. Saved prefix (metadata id_prefix / prefix / short_code / madrasa_info.prefix / registration_no)
 * 2. Derived from that madrasah's own name
 * 3. Neutral generic default ("QM")
 */
export async function getMadrasaPrefixById(
  madrasaId?: string | null,
  meta?: any,
  dbClient?: any
): Promise<string> {
  const fromMeta = extractSavedMadrasaPrefix(meta);
  if (fromMeta) return fromMeta;

  if (madrasaId) {
    try {
      const db = dbClient || (await createAdminClient());
      const { data: madrasaRow } = await db
        .from("madrasas")
        .select("*")
        .eq("id", madrasaId)
        .maybeSingle();
      if (madrasaRow) {
        return resolveMadrasaPrefix(
          { ...madrasaRow, metadata: meta || (madrasaRow as any).metadata },
          madrasaRow.name || meta?.name || ""
        );
      }
    } catch {
      // Fall through to metadata/name/QM resolution
    }
  }

  return resolveMadrasaPrefix(meta);
}

/**
 * Fetches all existing prefixes across all madrasas in the database.
 * SERVER-ONLY function. Guarantees 100% uniqueness across all madrasas.
 */
export async function getAllMadrasasWithPrefixes(): Promise<
  Array<{ id: string; name: string; prefix: string; raw: any }>
> {
  const adminClient = await createAdminClient();
  const { data: madrasas, error } = await adminClient
    .from("madrasas")
    .select("*")
    .order("created_at", { ascending: true });

  if (error || !madrasas) return [];

  const assignedPrefixes: string[] = [];
  const results: Array<{ id: string; name: string; prefix: string; raw: any }> = [];

  for (const m of madrasas) {
    let p = extractMadrasaPrefix(m);
    if (!p) {
      p = generateSuggestedPrefix(m.name, assignedPrefixes);
    } else if (assignedPrefixes.includes(p.toUpperCase())) {
      // If manually extracted prefix was already claimed, resolve to next unique variant
      p = findUniquePrefix(p, assignedPrefixes);
    }
    assignedPrefixes.push(p.toUpperCase());
    results.push({
      id: m.id,
      name: m.name,
      prefix: p.toUpperCase(),
      raw: m,
    });
  }

  return results;
}
