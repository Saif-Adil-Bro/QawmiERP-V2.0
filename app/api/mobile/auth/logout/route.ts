import { currentAppSession } from "@/lib/current-app-session";
import { revokeUserSession } from "@/lib/session-manager";
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
    return mobileError(
      "অবৈধ বা অনুপস্থিত API Key (x-api-key)।",
      401,
      "INVALID_API_KEY",
    );
  }

  const token = extractBearerToken(req);
  if (!token) {
    return mobileError("সার্ভারে সেশন বন্ধ করতে Bearer token প্রয়োজন।", 401, "MISSING_BEARER_TOKEN");
  }

  try {
    const client = createStatelessSupabaseClient(token);
    const session = await currentAppSession(client);
    if (session) {
      const result = await revokeUserSession({
        sessionId: session.id,
        madrasaId: session.madrasa_id,
        ownerUserId: session.user_id,
        revokedBy: session.user_id,
        reason: "MOBILE_LOGOUT",
        skipAudit: true,
      });
      if (!result.success) throw new Error("Revocation not confirmed");
    }
    const { error } = await client.auth.admin.signOut(token, "local");
    if (!session && error && [401, 403, 404].includes(error.status || 0))
      return mobileError("সার্ভারে সেশন বন্ধ হওয়া নিশ্চিত করা যায়নি।", 401, "LOGOUT_UNCONFIRMED");
    if (error && ![401, 403, 404].includes(error.status || 0))
      throw new Error("Provider logout not confirmed");
  } catch {
    return mobileError(
      "সেশন বাতিল নিশ্চিত করা যায়নি।",
      503,
      "LOGOUT_UNCONFIRMED",
    );
  }

  return mobileSuccess({ logged_out: true }, "লগআউট সম্পন্ন হয়েছে।");
}
