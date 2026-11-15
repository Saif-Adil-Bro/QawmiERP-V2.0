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
    return mobileError("অবৈধ বা অনুপস্থিত API Key (x-api-key)।", 401, "INVALID_API_KEY");
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

    if (error || !data?.session) {
      return mobileError(
        error?.message || "টোকেন রিফ্রেশ করা যায়নি। পুনরায় লগইন করুন।",
        401,
        "REFRESH_FAILED"
      );
    }

    return mobileSuccess(
      {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        token_type: "Bearer",
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
      },
      "টোকেন রিফ্রেশ সফল হয়েছে।"
    );
  } catch (err: any) {
    return mobileError(err?.message || "সার্ভার ত্রুটি হয়েছে।", 500, "INTERNAL_ERROR");
  }
}
