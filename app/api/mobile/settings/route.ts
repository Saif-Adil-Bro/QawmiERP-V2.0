import { NextRequest } from "next/server";
import { authenticateMobileRequest, mobileError, mobileSuccess } from "@/lib/mobile-api";
import { readJsonStore, writeJsonStore } from "@/lib/madrasa-store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateMobileRequest(req, {
    requireWrite: false,
    allowPortalRoles: true,
  });
  if (!auth.ok) return auth.response;

  const [{ data: madrasa }, meta] = await Promise.all([
    auth.adminClient.from("madrasas").select("*").eq("id", auth.ctx.madrasaId).maybeSingle(),
    readJsonStore(auth.ctx.madrasaId, "meta"),
  ]);

  return mobileSuccess(
    {
      madrasa,
      settings: {
        madrasa_prefix: meta.madrasa_prefix || null,
        active_session_id: meta.active_session_id || null,
        absence_alert_settings: meta.absence_alert_settings || null,
        payment_gateway_config: meta.payment_gateway_config || null,
      },
    },
    "Success",
    undefined,
    200,
    req
  );
}

export async function PATCH(req: NextRequest) {
  const auth = await authenticateMobileRequest(req, {
    module: "users",
    requireWrite: true,
  });
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const madrasaFields: Record<string, any> = {};
    for (const key of ["name", "address", "contact_email", "contact_phone", "logo_url"]) {
      if (body[key] !== undefined) madrasaFields[key] = body[key];
    }

    if (Object.keys(madrasaFields).length > 0) {
      await auth.adminClient
        .from("madrasas")
        .update(madrasaFields)
        .eq("id", auth.ctx.madrasaId);
    }

    if (body.settings && typeof body.settings === "object") {
      const meta = await readJsonStore(auth.ctx.madrasaId, "meta");
      Object.assign(meta, body.settings);
      await writeJsonStore(auth.ctx.madrasaId, "meta", meta);
    }

    return mobileSuccess({ updated: true }, "সেটিংস সফলভাবে আপডেট হয়েছে।");
  } catch (err: any) {
    return mobileError(err?.message || "Server error", 500, "INTERNAL_ERROR");
  }
}
