import { completeAppLogin } from "@/lib/app-login";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
    const madrasaName = String(body.madrasa_name || body.madrasaName || "").trim();
    const fullName = String(body.full_name || body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const phone = String(body.phone || "").trim();
    const address = String(body.address || "").trim();

    if (!madrasaName || !fullName || !email || !password) {
      return mobileError(
        "মাদ্রাসার নাম, পূর্ণ নাম, ইমেইল এবং পাসওয়ার্ড আবশ্যক।",
        400,
        "VALIDATION_ERROR"
      );
    }

    if (password.length < 6) {
      return mobileError(
        "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।",
        400,
        "WEAK_PASSWORD"
      );
    }

    const adminClient = await createAdminClient();
    const { data: createdUser, error: authErr } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: "super_admin",
          phone,
        },
      });

    if (authErr || !createdUser?.user) {
      return mobileError(
        authErr?.message || "অ্যাকাউন্ট তৈরি করা যায়নি।",
        400,
        "REGISTER_FAILED"
      );
    }

    const { data: madrasa, error: madrasaErr } = await adminClient
      .from("madrasas")
      .insert({
        name: madrasaName,
        address: address || null,
        contact_email: email,
        contact_phone: phone || null,
      })
      .select("*")
      .single();

    if (madrasaErr || !madrasa) {
      await adminClient.auth.admin.deleteUser(createdUser.user.id);
      return mobileError(
        madrasaErr?.message || "মাদ্রাসা তৈরি করতে সমস্যা হয়েছে।",
        400,
        "MADRASA_CREATE_FAILED"
      );
    }

    const { error: profileErr } = await adminClient.from("users").insert({
      id: createdUser.user.id,
      madrasa_id: madrasa.id,
      role: "super_admin",
      full_name: fullName,
      phone: phone || null,
      email,
    });

    if (profileErr) {
      await adminClient.from("madrasas").delete().eq("id", madrasa.id);
      await adminClient.auth.admin.deleteUser(createdUser.user.id);
      return mobileError(profileErr.message, 400, "PROFILE_CREATE_FAILED");
    }

    const supabase = createStatelessSupabaseClient();
    const { data: signInData } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    const session = signInData.session;
    // Registration already committed. Keep the 201 and identity payload, but if
    // sign-in/registration failed the client must login, not create another tenant.
    const login = session && await completeAppLogin(supabase, session, "mobile", true, req.headers);
    const bound = login?.ok ? session : null;
    return mobileSuccess(
      {
        login_required: !bound,
        access_token: bound?.access_token || null,
        refresh_token: bound?.refresh_token || null,
        token_type: "Bearer",
        expires_in: bound?.expires_in || null,
        expires_at: bound?.expires_at || null,
        user: {
          id: createdUser.user.id,
          email,
          full_name: fullName,
          phone: phone || null,
          role: "super_admin",
          roles: ["super_admin"],
          madrasa_id: madrasa.id,
        },
        madrasa,
      },
      "মাদ্রাসা ও এডমিন অ্যাকাউন্ট সফলভাবে নিবন্ধিত হয়েছে।",
      undefined,
      201,
      req
    );
  } catch (err: any) {
    return mobileError(err?.message || "সার্ভার ত্রুটি হয়েছে।", 500, "INTERNAL_ERROR");
  }
}
