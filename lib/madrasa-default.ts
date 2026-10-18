import { createAdminClient } from "@/lib/supabase/server";

/**
 * ⛔ P2-Fix: কোডে আর কোনো hardcoded মাদরাসা UUID থাকবে না।
 *
 * "ডিফল্ট মাদরাসা" এখন একমাত্র কেন্দ্রীয় স্থান থেকে আসে:
 *   ১) `DEFAULT_MADRASA_ID` env (server-only; .env.local / Railway Variable)
 *      — যদি ওই UUID আসলে DB-তে থাকে
 *   ২) না পেলে সবচেয়ে পুরোনো মাদরাসা (created_at অনুযায়ী)
 *   ৩) কোনো মাদরাসা না থাকলে null — caller fail-closed হ্যান্ডেল করবে
 *
 * শুধুমাত্র PUBLIC/anonymous-UX পথে (ভর্তি, দান, পেমেন্ট কনফিগ) ব্যবহার করুন।
 * Staff action-এ নয় — সেখানে লগইন-করা user-এর নিজের মাদরাসাই সঠিক।
 */
export async function getDefaultMadrasaId(): Promise<string | null> {
  try {
    const adminClient = await createAdminClient();

    const envId = (process.env.DEFAULT_MADRASA_ID || "").trim();
    if (envId) {
      const { data } = await adminClient
        .from("madrasas")
        .select("id")
        .eq("id", envId)
        .maybeSingle();
      if (data?.id) return data.id;
    }

    const { data } = await adminClient
      .from("madrasas")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return data?.id || null;
  } catch {
    return null;
  }
}
