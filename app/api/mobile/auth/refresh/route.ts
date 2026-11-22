import {
  authUnavailable,
  currentAppSession,
  SessionUnavailableError,
} from "@/lib/current-app-session";
import { assertActiveAccount } from "@/lib/permissions-server";
import { NextRequest } from "next/server";
import {
  createStatelessSupabaseClient,
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

  try {
    const body = await req.json();
    const refreshToken = String(body.refresh_token || "").trim();
    if (!refreshToken) {
      return mobileError("refresh_token আবশ্যক।", 400, "VALIDATION_ERROR");
    }

    const supabase = createStatelessSupabaseClient();
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (authUnavailable(error)) throw new SessionUnavailableError();
    if (error || !data?.session) {
      return mobileError(
        error?.message || "টোকেন রিফ্রেশ করা যায়নি। পুনরায় লগইন করুন।",
        401,
        "REFRESH_FAILED",
      );
    }

    // The provider may rotate successfully even after app-side termination. Never
    // return the new credentials or create a binding without an active app session.
    const binding = await currentAppSession(
      createStatelessSupabaseClient(data.session.access_token),
    );
    if (!binding || binding.user_id !== data.session.user.id) {
      await supabase.auth.signOut({ scope: "local" });
      return mobileError(
        "সেশন বাতিল হয়েছে। আবার লগইন করুন।",
        401,
        "SESSION_REVOKED",
      );
    }
    const active = await assertActiveAccount(
      binding.user_id,
      binding.madrasa_id,
    );
    if (!active.context) throw new SessionUnavailableError();
    if (!active.allowed) {
      await supabase.auth.signOut({ scope: "local" });
      return mobileError("অ্যাকাউন্ট সক্রিয় নয়।", 403, "ACCOUNT_INACTIVE");
    }

    return mobileSuccess(
      {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        token_type: "Bearer",
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
      },
      "টোকেন রিফ্রেশ সফল হয়েছে।",
    );
  } catch {
    return mobileError("সেশন যাচাই করা যায়নি।", 503, "SESSION_UNAVAILABLE");
  }
}
