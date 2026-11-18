import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError } from "@/lib/audit-log";
import { getStructuredMadrasaSetting } from "@/lib/structured-config";

const FALLBACK_DELIVERIES_KEY = "webhook_deliveries";

export async function GET(req: Request) {
  const auth = await authorizeApi("webhooks");
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const endpointId = searchParams.get("endpointId");
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || 50)));

  const admin = await createAdminClient();
  let query = admin
    .from("webhook_deliveries")
    .select("*")
    .eq("madrasa_id", auth.ctx.madrasaId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (endpointId) {
    query = query.eq("endpoint_id", endpointId);
  }

  const { data, error } = await query;
  if (!error) {
    return NextResponse.json({ deliveries: data || [] });
  }

  if (isMissingTableError(error)) {
    const fb = await getStructuredMadrasaSetting<any[]>(
      auth.ctx.madrasaId,
      "webhooks",
      FALLBACK_DELIVERIES_KEY
    );
    let items = Array.isArray(fb.value) ? fb.value : [];
    if (endpointId) {
      items = items.filter((d) => d.endpoint_id === endpointId);
    }
    return NextResponse.json({ deliveries: items.slice(0, limit) });
  }

  return NextResponse.json({ error: error.message }, { status: 500 });
}
