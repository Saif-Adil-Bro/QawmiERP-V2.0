import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createStatelessSupabaseClient,
  mobileError,
  mobileSuccess,
  verifyMobileApiKey,
} from "@/lib/mobile-api";
import {
  findStudentByIdentifier,
  ensureStudentGuardianAuthUser,
  banglaToEnglishDigits,
} from "@/lib/student-auth";
import { assertActiveAccount } from "@/lib/permissions-server";
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
    let studentIdCode = "";
    let canonicalEmail = "";
    let legacyEmail = "";

    if (!rawIdentifier.includes("@") || rawIdentifier.endsWith("@qawmi.app")) {
      const resolved = await findStudentByIdentifier(rawIdentifier);
      if (resolved) {
        isStudentLogin = true;
        studentIdCode = resolved.canonicalStudentId;
        canonicalEmail = resolved.portalEmail;
        legacyEmail = resolved.legacyPortalEmail;
        const authRes = await ensureStudentGuardianAuthUser(
          resolved.student,
          studentIdCode,
          "123456"
        );
        targetEmail = authRes.email || canonicalEmail;
      } else if (!rawIdentifier.includes("@")) {
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
      return mobileError(
        isStudentLogin
          ? "প্রদত্ত শিক্ষার্থী আইডি অথবা পাসওয়ার্ড সঠিক নয়।"
          : error?.message || "লগইন ব্যর্থ হয়েছে।",
        401,
        "INVALID_CREDENTIALS"
      );
    }

    const adminClient = await createAdminClient();
    const { data: userRow } = await adminClient
      .from("users")
      .select("*, madrasas(id, name, address, contact_phone, contact_email, logo_url)")
      .eq("id", data.user.id)
      .maybeSingle();

    const madrasaId = String(
      (userRow as any)?.madrasa_id || data.user.user_metadata?.madrasa_id || ""
    );

    let role = String(
      (userRow as any)?.role ||
        data.user.user_metadata?.role ||
        (isStudentLogin ? "parent" : "staff")
    ).toLowerCase();
    let roles: string[] = [role];
    let permissions: string[] = [];

    if (madrasaId) {
      const active = await assertActiveAccount(data.user.id, madrasaId);
      if (!active.allowed) {
        return mobileError(
          active.error || "আপনার অ্যাকাউন্টটি সক্রিয় নয়।",
          403,
          "ACCOUNT_INACTIVE"
        );
      }
      if (active.context) {
        role = String(active.context.role || role).toLowerCase();
        roles = (active.context.roles || [role]).map((r) => String(r).toLowerCase());
        permissions = active.context.summary?.effectivePermissions || [];
      }

      try {
        const { registerUserSession } = await import("@/lib/session-manager");
        const forwarded = req.headers.get("x-forwarded-for");
        const ipAddress = forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip");
        await registerUserSession({
          userId: data.user.id,
          madrasaId,
          ipAddress,
          userAgent: req.headers.get("user-agent") || "QawmiERP Mobile App",
          accessToken: data.session.access_token,
          remember: true,
          channel: "mobile",
        });
      } catch {}
    }

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
