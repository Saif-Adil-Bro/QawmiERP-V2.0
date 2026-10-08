import { createAdminClient } from "@/lib/supabase/server";
import { extractMadrasaPrefix, generateSuggestedPrefix, findUniquePrefix } from "./madrasa-prefix";

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
