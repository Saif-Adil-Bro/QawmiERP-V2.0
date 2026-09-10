import { createAdminClient } from "@/lib/supabase/server";
import { extractMadrasaPrefix, generateSuggestedPrefix } from "./madrasa-prefix";

/**
 * Fetches all existing prefixes across all madrasas in the database.
 * SERVER-ONLY function.
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
    }
    assignedPrefixes.push(p);
    results.push({
      id: m.id,
      name: m.name,
      prefix: p,
      raw: m,
    });
  }

  return results;
}
