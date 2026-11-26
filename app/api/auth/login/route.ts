import { completeAppLogin } from "@/lib/app-login";
import { privateResponseHeaders } from "@/lib/private-response";
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getPortalRedirectUrl } from "@/lib/role-redirect";
import {
  findStudentByIdentifier,
  banglaToEnglishDigits,
} from "@/lib/student-auth";
import { DEMO_ADMIN_EMAIL } from "@/lib/demo-data";
import { ensureDemoMadrasaExists } from "@/app/actions/demo-seed";
import { logAuditEvent } from "@/lib/audit-log";

import {recordFailedLogin} from "@/lib/failed-login-audit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawIdentifier = (body.identifier || body.email || "").trim();
    let rawPassword = (body.password || "").trim();
    const remember = body.remember !== false;

    if (!rawIdentifier || !rawPassword) {
      return NextResponse.json(
        { error: "শিক্ষার্থী আইডি / ইমেইল এবং পাসওয়ার্ড আবশ্যক।" },
        { status: 400 }
      );
    }

    // Support both English and Bangla numbers in password
    const normalizedPassword = banglaToEnglishDigits(rawPassword);

    let targetEmail = rawIdentifier.toLowerCase();
    let isStudentLogin = false;
    let matchedStudent: any = null;
    let studentIdCode = "";
    let candidateEmails: string[] = [];

    // If identifier is not a standard external email (or matches student ID/roll/phone/qawmi format)
    if (!rawIdentifier.includes("@") || rawIdentifier.endsWith("@qawmi.app")) {
      const resolved = await findStudentByIdentifier(rawIdentifier);
      if (resolved) {
        isStudentLogin = true;
        matchedStudent = resolved.student;
        studentIdCode = resolved.canonicalStudentId;
        candidateEmails = resolved.candidateEmails?.length
          ? resolved.candidateEmails
          : [resolved.portalEmail, resolved.legacyPortalEmail];

        // If user entered an explicit email (like muse-480004@qawmi.app), try it first; otherwise try first DB-matched candidate
        targetEmail = rawIdentifier.includes("@")
          ? rawIdentifier.toLowerCase()
          : candidateEmails[0] || resolved.portalEmail;
      } else if (!rawIdentifier.includes("@")) {
        await recordFailedLogin(rawIdentifier,"web");
        return NextResponse.json(
          {
            error: `প্রদত্ত আইডি বা রোল (${rawIdentifier}) অনুযায়ী কোনো শিক্ষার্থী খুঁজে পাওয়া যায়নি। আপনার সঠিক শিক্ষার্থী আইডি (যেমন: MUSE-480004 বা 480001) অথবা ইমেইল প্রদান করুন।`,
          },
          { status: 404 }
        );
      }
    }

    // If logging into demo account, automatically ensure all relational tables and profile exist
    if (targetEmail.toLowerCase() === DEMO_ADMIN_EMAIL.toLowerCase()) {
      try {
        await ensureDemoMadrasaExists();
      } catch (seedErr) {
        console.warn("Auto-seed demo madrasa error:", seedErr);
      }
    }

    const supabase = await createClient();
    let { data, error } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password: rawPassword,
    });

    // If initial attempt failed and password had Bengali digits, try normalized password
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

    // If student login failed, try all candidate email formats (including muse-480004@qawmi.app, student_muse480004@qawmi.app, etc.)
    if (error && isStudentLogin) {
      const altEmails = candidateEmails.filter(
        (e) => e && e.toLowerCase() !== targetEmail.toLowerCase()
      );
      for (const alt of altEmails) {
        let altAttempt = await supabase.auth.signInWithPassword({
          email: alt,
          password: rawPassword,
        });
        if (altAttempt.error && normalizedPassword !== rawPassword) {
          altAttempt = await supabase.auth.signInWithPassword({
            email: alt,
            password: normalizedPassword,
          });
        }
        if (!altAttempt.error && altAttempt.data.user) {
          data = altAttempt.data;
          error = null;
          targetEmail = alt;
          break;
        }
      }
    }

    if (error || !data?.session || !data.user) {
      await recordFailedLogin(targetEmail,"web",matchedStudent?.madrasa_id);
      if (isStudentLogin) {
        return NextResponse.json(
          {
            error: "প্রদত্ত শিক্ষার্থী আইডি অথবা পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে তথ্য যাচাই করে পুনরায় চেষ্টা করুন।",
          },
          { status: 401 }
        );
      }
      return NextResponse.json({ error: error?.message || "লগইন ব্যর্থ হয়েছে। তথ্য যাচাই করে আবার চেষ্টা করুন।" }, { status: 401 });
    }

    const login = await completeAppLogin(supabase, data.session, "web", remember, req.headers);
    if (!login.ok) {
      await recordFailedLogin(targetEmail,"web",matchedStudent?.madrasa_id);
      return NextResponse.json({ error: login.message }, { status: login.status, headers: privateResponseHeaders });
    }
    const {perms:ctx} = login;
    const userRole = ctx.profile.primaryRole, resolvedMadrasaId = ctx.madrasaId;
    const redirectUrl = getPortalRedirectUrl(userRole, ctx.roles);

    if (resolvedMadrasaId) {
      await logAuditEvent({
        madrasaId: resolvedMadrasaId,
        actorId: data.user.id,
        actorEmail: data.user.email || targetEmail,
        actorRole: userRole,
        module: "security",
        action: "LOGIN",
        entityType: "auth_session",
        entityId: data.user.id,
        entityLabel: data.user.email || targetEmail,
        summary: `ব্যবহারকারী সফলভাবে লগইন করেছেন (${data.user.email || targetEmail})`,
        severity: "INFO",
      });
    }

    const res = NextResponse.json({
      success: true,
      user: data.user,
      session: data.session,
      role: userRole, madrasaId:resolvedMadrasaId,
      redirectUrl,
      resolvedEmail: targetEmail,
      studentIdCode: studentIdCode || data.user?.user_metadata?.student_id_code || null,
      isDefaultPassword: Boolean(data.user?.user_metadata?.is_default_password ?? true),
      remember,
    }, { headers: privateResponseHeaders });

    res.cookies.set("qawmi_remember_me", remember ? "1" : "0", {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: remember ? 60 * 60 * 24 * 365 : 60 * 60 * 24 * 1,
    });

    return res;
  } catch (err: any) {
    console.error("Login API error:", err);
    return NextResponse.json(
      { error: err?.message || "সার্ভার এরর হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}

