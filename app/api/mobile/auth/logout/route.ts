import { NextRequest } from "next/server";
import {
  createStatelessSupabaseClient,
  extractBearerToken,
  mobileError,
  mobileSuccess,
  verifyMobileApiKey,
} from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!verifyMobileApiKey(req)) {
    return mobileError("অবৈধ বা অনুপস্থিত API Key (x-api-key)।", 401, "INVALID_API_KEY");
  }

  const token = extractBearerToken(req);
  if (!token) {
    return mobileSuccess({ logged_out: true }, "লগআউট সম্পন্ন হয়েছে।");
  }

  try {
    const { hashSessionToken, revokeSessionByTokenHash } = await import("@/lib/session-manager");
    await revokeSessionByTokenHash(hashSessionToken(token), "MOBILE_LOGOUT");
  } catch {}

  try {
    const supabase = createStatelessSupabaseClient();
    await supabase.auth.admin?.signOut?.(token).catch(() => {});
  } catch {}

  return mobileSuccess({ logged_out: true }, "লগআউট সম্পন্ন হয়েছে।");
}
