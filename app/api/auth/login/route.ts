import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getPortalRedirectUrl } from "@/lib/role-redirect";
import {
  findStudentByIdentifier,
  ensureStudentGuardianAuthUser,
  banglaToEnglishDigits,
} from "@/lib/student-auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawIdentifier = (body.identifier || body.email || "").trim();
    let rawPassword = (body.password || "").trim();

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
    let canonicalEmail = "";
    let legacyEmail = "";

    // If identifier is not a standard external email (or matches student ID/roll/phone/qawmi format)
    if (!rawIdentifier.includes("@") || rawIdentifier.endsWith("@qawmi.app")) {
      const resolved = await findStudentByIdentifier(rawIdentifier);
      if (resolved) {
        isStudentLogin = true;
        matchedStudent = resolved.student;
        studentIdCode = resolved.canonicalStudentId;
        canonicalEmail = resolved.portalEmail;
        legacyEmail = resolved.legacyPortalEmail;

        // Auto-provision if account doesn't exist yet, or sync credentials
        const authRes = await ensureStudentGuardianAuthUser(
          matchedStudent,
          studentIdCode,
          "123456"
        );
        targetEmail = authRes.email || canonicalEmail;
      } else if (!rawIdentifier.includes("@")) {
        return NextResponse.json(
          {
            error: `প্রদত্ত আইডি বা রোল (${rawIdentifier}) অনুযায়ী কোনো শিক্ষার্থী খুঁজে পাওয়া যায়নি। আপনার সঠিক শিক্ষার্থী আইডি (যেমন: AHH480001 বা 480001) অথবা ইমেইল প্রদান করুন।`,
          },
          { status: 404 }
        );
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

    // If student login failed, try canonical or legacy email alternatives
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

    // If student login failed with default password (123456), force password sync on auth user and retry
    if (error && isStudentLogin && (rawPassword === "123456" || normalizedPassword === "123456")) {
      try {
        const adminClient = await createAdminClient();
        const { data: authUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
        const authUser = authUsers?.users?.find(
          (u) =>
            u.email?.toLowerCase() === targetEmail.toLowerCase() ||
            u.email?.toLowerCase() === canonicalEmail.toLowerCase() ||
            u.email?.toLowerCase() === legacyEmail.toLowerCase()
        );
        if (authUser) {
          await adminClient.auth.admin.updateUserById(authUser.id, {
            password: "123456",
            email_confirm: true,
          });
          const reSync = await supabase.auth.signInWithPassword({
            email: authUser.email || targetEmail,
            password: "123456",
          });
          if (!reSync.error && reSync.data.user) {
            data = reSync.data;
            error = null;
            targetEmail = authUser.email || targetEmail;
          }
        }
      } catch (syncPassErr) {
        console.warn("Password sync on login error:", syncPassErr);
      }
    }

    if (error || !data || !data.user) {
      if (isStudentLogin) {
        return NextResponse.json(
          {
            error: "পাসওয়ার্ড সঠিক নয়। ডিফল্ট পাসওয়ার্ড 123456 অথবা আপনার পরিবর্তিত পাসওয়ার্ড ব্যবহার করুন।",
          },
          { status: 401 }
        );
      }
      return NextResponse.json({ error: error?.message || "লগইন ব্যর্থ হয়েছে।" }, { status: 401 });
    }

    // Resolve user role
    let userRole = data.user.user_metadata?.role || (isStudentLogin ? "parent" : "staff");
    let roles: string[] = [];

    try {
      const adminClient = await createAdminClient();
      const { data: userRow } = await adminClient
        .from("users")
        .select("role, madrasa_id")
        .eq("id", data.user.id)
        .maybeSingle();

      if (userRow?.role) {
        userRole = userRow.role;
      }

      // If role still not determined or default, check if user exists in teachers table
      if (userRole === "staff" || !userRole) {
        const { data: teacherRow } = await adminClient
          .from("teachers")
          .select("id")
          .eq("email", targetEmail)
          .maybeSingle();
        if (teacherRow) {
          userRole = "teacher";
        }
      }

      // Check madrasa security store for custom user profiles
      if (userRow?.madrasa_id) {
        const { data: madrasaRow } = await adminClient
          .from("madrasas")
          .select("registration_no")
          .eq("id", userRow.madrasa_id)
          .maybeSingle();
        if (madrasaRow?.registration_no?.startsWith("{")) {
          const parsed = JSON.parse(madrasaRow.registration_no);
          const profileOverride = parsed.user_security_profiles?.[data.user.id];
          if (profileOverride?.primaryRole) {
            userRole = profileOverride.primaryRole;
          }
          if (profileOverride?.roles) {
            roles = profileOverride.roles;
          }
        }
      }
    } catch (dbErr) {
      console.warn("Role lookup in login API fallback:", dbErr);
    }

    const redirectUrl = getPortalRedirectUrl(userRole, roles);

    return NextResponse.json({
      success: true,
      user: data.user,
      session: data.session,
      role: userRole,
      redirectUrl,
      resolvedEmail: targetEmail,
      studentIdCode: studentIdCode || data.user?.user_metadata?.student_id_code || null,
      isDefaultPassword: Boolean(data.user?.user_metadata?.is_default_password ?? true),
    });
  } catch (err: any) {
    console.error("Login API error:", err);
    return NextResponse.json(
      { error: err?.message || "সার্ভার এরর হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}

