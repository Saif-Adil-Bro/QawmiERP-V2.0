import {recordFailedLogin} from "@/lib/failed-login-audit";
import { NextRequest } from "next/server";
import { completeAppLogin } from "@/lib/app-login";
import {
  createStatelessSupabaseClient,
  mobileError,
  mobileSuccess,
  verifyMobileApiKey,
} from "@/lib/mobile-api";
import {
  findStudentByIdentifier,
  banglaToEnglishDigits,
} from "@/lib/student-auth";
import { DEMO_ADMIN_EMAIL } from "@/lib/demo-data";
import { ensureDemoMadrasaExists } from "@/app/actions/demo-seed";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!verifyMobileApiKey(req)) {
    return mobileError("অবৈধ বা অনুপস্থিত API Key (x-api-key)।", 401, "INVALID_API_KEY");
  }

  try {
    const body = await req.json();
    const rawIdentifier = String(body.identifier || body.email || "").trim();
    const rawPassword = String(body.password || "").trim();

    if (!rawIdentifier || !rawPassword) {
      return mobileError(
        "শিক্ষার্থী আইডি / ইমেইল এবং পাসওয়ার্ড আবশ্যক।",
        400,
        "VALIDATION_ERROR"
      );
    }

    const normalizedPassword = banglaToEnglishDigits(rawPassword);
    let targetEmail = rawIdentifier.toLowerCase();
    let isStudentLogin = false;
    let tenant:string|null=null;
    let studentIdCode = "";
    let canonicalEmail = "";
    let legacyEmail = "";

    if (!rawIdentifier.includes("@") || rawIdentifier.endsWith("@qawmi.app")) {
      const resolved = await findStudentByIdentifier(rawIdentifier);
      if (resolved) {
        tenant=resolved.madrasaId;
        isStudentLogin = true;
        studentIdCode = resolved.canonicalStudentId;
        canonicalEmail = resolved.portalEmail;
        legacyEmail = resolved.legacyPortalEmail;
        targetEmail = canonicalEmail;
      } else if (!rawIdentifier.includes("@")) {
        await recordFailedLogin(rawIdentifier,"mobile");
        return mobileError(
          `প্রদত্ত আইডি বা রোল (${rawIdentifier}) অনুযায়ী কোনো শিক্ষার্থী খুঁজে পাওয়া যায়নি।`,
          404,
          "STUDENT_NOT_FOUND"
        );
      }
    }

    if (targetEmail.toLowerCase() === DEMO_ADMIN_EMAIL.toLowerCase()) {
      try {
        await ensureDemoMadrasaExists();
      } catch {}
    }

    const supabase = createStatelessSupabaseClient();
    let { data, error } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password: rawPassword,
    });

    if (error && normalizedPassword !== rawPassword) {
      const retry = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: normalizedPassword,
      });
      if (!retry.error) {
        data = retry.data;
        error = null;
      }
    }

    if (error && isStudentLogin) {
      const altEmails = [canonicalEmail, legacyEmail].filter(
        (e) => e && e.toLowerCase() !== targetEmail.toLowerCase()
      );
      for (const alt of altEmails) {
        const altAttempt = await supabase.auth.signInWithPassword({
          email: alt,
          password: rawPassword,
        });
        if (!altAttempt.error && altAttempt.data.user) {
          data = altAttempt.data;
          error = null;
          targetEmail = alt;
          break;
        }
      }
    }

    if (error || !data?.user || !data?.session) {
      await recordFailedLogin(targetEmail,"mobile",tenant);
      return mobileError(
        isStudentLogin
          ? "প্রদত্ত শিক্ষার্থী আইডি অথবা পাসওয়ার্ড সঠিক নয়।"
          : error?.message || "লগইন ব্যর্থ হয়েছে।",
        401,
        "INVALID_CREDENTIALS"
      );
    }

    const login = await completeAppLogin(supabase, data.session, "mobile", true, req.headers);
    if (!login.ok) {await recordFailedLogin(targetEmail,"mobile",tenant);return mobileError(login.message, login.status, login.code); }
    const {row:userRow, perms} = login;
    const {role, roles, madrasaId} = perms;
    const permissions = perms.summary.effectivePermissions;

    return mobileSuccess(
      {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        token_type: "Bearer",
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
        user: {
          id: data.user.id,
          email: data.user.email,
          full_name:
            (userRow as any)?.full_name || data.user.user_metadata?.full_name || "",
          phone: (userRow as any)?.phone || data.user.user_metadata?.phone || null,
          role,
          roles,
          permissions,
          madrasa_id: madrasaId,
          student_id_code:
            studentIdCode || data.user.user_metadata?.student_id_code || null,
          is_default_password: Boolean(
            data.user.user_metadata?.is_default_password ?? false
          ),
        },
        madrasa: (userRow as any)?.madrasas || null,
      },
      "লগইন সফল হয়েছে।",
      undefined,
      200,
      req
    );
  } catch (err: any) {
    return mobileError(err?.message || "সার্ভার ত্রুটি হয়েছে।", 500, "INTERNAL_ERROR");
  }
}
