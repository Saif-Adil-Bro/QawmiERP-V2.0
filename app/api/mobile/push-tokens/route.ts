import { NextRequest } from "next/server";
import { authenticateMobileRequest, mobileError, mobileSuccess } from "@/lib/mobile-api";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { isMissingTableError } from "@/lib/audit-log";
import { getStructuredMadrasaSetting, saveStructuredMadrasaSetting } from "@/lib/structured-config";

const FALLBACK_TOKENS_KEY = "notification_device_tokens";

export async function POST(req: NextRequest) {
  let userId = "";
  let madrasaId = "";
  let adminClient: any = null;

  const hasBearer = (req.headers.get("authorization") || "").toLowerCase().startsWith("bearer ");
  if (hasBearer) {
    const auth = await authenticateMobileRequest(req, {
      requireWrite: false,
      allowPortalRoles: true,
    });
    if (!auth.ok) return auth.response;
    userId = auth.ctx.userId;
    madrasaId = auth.ctx.madrasaId;
    adminClient = auth.adminClient;
  } else {
    // Support SSR cookie-authenticated mobile/portal requests
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return mobileError("অননুমোদিত অ্যাক্সেস।", 401, "UNAUTHORIZED");
    }
    adminClient = await createAdminClient();
    const { data: userRow } = await adminClient
      .from("users")
      .select("madrasa_id")
      .eq("id", user.id)
      .maybeSingle();

    userId = user.id;
    madrasaId = String((userRow as any)?.madrasa_id || user.user_metadata?.madrasa_id || "");
    if (!madrasaId) {
      return mobileError("মাদ্রাসা সংযুক্ত নেই।", 403, "NO_MADRASA_LINKED");
    }
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return mobileError("অবৈধ JSON পেলোড।", 400, "INVALID_JSON");
  }

  const token = String(body.token || body.deviceToken || body.device_token || "").trim();
  if (!token) {
    return mobileError("ডিভাইস পুশ টোকেন (token) খালি হতে পারবে না।", 400, "MISSING_PUSH_TOKEN");
  }

  const platform = String(body.platform || "android").trim().toLowerCase() || "android";
  const deviceId = body.deviceId ? String(body.deviceId).trim() : null;
  const deviceName = body.deviceName ? String(body.deviceName).trim() : null;
  const studentId = body.studentId ? String(body.studentId).trim() : null;
  const nowIso = new Date().toISOString();

  const record = {
    madrasa_id: madrasaId,
    user_id: userId,
    student_id: studentId,
    platform,
    token,
    device_id: deviceId,
    device_name: deviceName,
    is_active: true,
    last_seen_at: nowIso,
    updated_at: nowIso,
  };

  const { data, error } = await adminClient
    .from("notification_device_tokens")
    .upsert(record, { onConflict: "madrasa_id,token" })
    .select("id, platform, token, device_id, is_active, last_seen_at")
    .maybeSingle();

  if (!error) {
    return mobileSuccess(
      data || record,
      "পুশ নোটিফিকেশন টোকেন সফলভাবে নিবন্ধিত হয়েছে।",
      undefined,
      200,
      req
    );
  }

  if (isMissingTableError(error)) {
    const fb = await getStructuredMadrasaSetting<any[]>(
      madrasaId,
      "notifications",
      FALLBACK_TOKENS_KEY
    );
    const list = Array.isArray(fb.value) ? fb.value : [];
    const idx = list.findIndex((t) => (t.token || t.device_token) === token);
    const saved = {
      id: idx >= 0 ? list[idx].id : `dt_${Date.now()}`,
      ...record,
      created_at: idx >= 0 ? list[idx].created_at : nowIso,
    };
    if (idx >= 0) list[idx] = saved;
    else list.unshift(saved);

    await saveStructuredMadrasaSetting(
      madrasaId,
      "notifications",
      FALLBACK_TOKENS_KEY,
      list.slice(0, 500),
      userId
    );
    return mobileSuccess(
      saved,
      "পুশ নোটিফিকেশন টোকেন সফলভাবে সংরক্ষিত হয়েছে (fallback)।",
      undefined,
      200,
      req
    );
  }

  return mobileError(error.message || "টোকেন সংরক্ষণ ব্যর্থ হয়েছে।", 500, "DB_ERROR");
}
