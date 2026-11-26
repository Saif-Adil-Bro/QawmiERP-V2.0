"use server";
import {writeGuard} from '@/lib/action-authorization';
import { createClient, createAdminClient, getAuthUser, getWebAppSession } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { completeAppLogin } from "@/lib/app-login";
import { createStatelessSupabaseClient } from "@/lib/supabase/stateless";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getPortalRedirectUrl } from "@/lib/role-redirect";
import {
  findStudentByIdentifier,
  syncAllStudentsDefaultLogins,
  SyncStudentLoginsResult,
} from "@/lib/student-auth";
import { logAuditEvent } from "@/lib/audit-log";

import {recordFailedLogin} from "@/lib/failed-login-audit";

export async function login(prevState: any, formData: FormData) {
  let isSuccess = false;
  let targetRedirectUrl = "/dashboard";
  
  try {
    const rawIdentifier = (formData.get("identifier") || formData.get("email") || "") as string;
    const password = (formData.get("password") || "") as string;
    
    if (!rawIdentifier || !password) {
      return { error: "শিক্ষার্থী আইডি / ইমেইল এবং পাসওয়ার্ড আবশ্যক।" };
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
       return { error: "সার্ভার কনফিগারেশন ত্রুটি: সুপাবেস কি পাওয়া যায়নি।" };
    }

    let targetEmail = rawIdentifier.trim().toLowerCase();
    let isStudentLogin = false;
    let resolvedStudentMadrasaId: string | null = null;
    let candidateEmails: string[] = [];

    // If identifier doesn't have '@' or is a student ID / roll / phone / @qawmi.app
    if (!rawIdentifier.includes("@") || rawIdentifier.endsWith("@qawmi.app")) {
      const resolved = await findStudentByIdentifier(rawIdentifier);
      if (resolved) {
        isStudentLogin = true;
        resolvedStudentMadrasaId = resolved.madrasaId || null;
        candidateEmails = resolved.candidateEmails?.length
          ? resolved.candidateEmails
          : [resolved.portalEmail, resolved.legacyPortalEmail];
        targetEmail = rawIdentifier.includes("@")
          ? rawIdentifier.trim().toLowerCase()
          : candidateEmails[0] || resolved.portalEmail;
      } else if (!rawIdentifier.includes("@")) {
        await recordFailedLogin(rawIdentifier, "web_action");
        return {
          error: `প্রদত্ত আইডি বা রোল (${rawIdentifier}) অনুযায়ী কোনো শিক্ষার্থী খুঁজে পাওয়া যায়নি। আপনার সঠিক শিক্ষার্থী আইডি (যেমন: MUSE-480004 বা 480001) প্রদান করুন।`,
        };
      }
    }

    const supabase = await createClient();

    let { data, error } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password: password.trim(),
    });

    // If student login failed, try fallback emails
    if (error && isStudentLogin) {
      const altEmails = candidateEmails.filter(
        (e) => e && e.toLowerCase() !== targetEmail.toLowerCase()
      );
      for (const alt of altEmails) {
        const altAttempt = await supabase.auth.signInWithPassword({
          email: alt,
          password: password.trim(),
        });
        if (!altAttempt.error && altAttempt.data.user) {
          data = altAttempt.data;
          error = null;
          targetEmail = alt;
          break;
        }
      }
    }

    // ⛔ নিরাপত্তা ফিক্স (CR-1): আগে এখানে "ডিফল্ট পাসওয়ার্ড (123456) দিয়ে লগইন ব্যর্থ হলে
    // admin API দিয়ে জোরপূর্বক পাসওয়ার্ড রিসেট করে আবার লগইন" করার কোড ছিল। ফলে শুধু শিক্ষার্থী
    // আইডি জানলেই যে কেউ ওই অ্যাকাউন্ট দখল করতে পারত — কারণ শিক্ষার্থী আগে পাসওয়ার্ড বদলালেও
    // সিস্টেম নিজেই সেটি মুছে 123456 করে দিত। এই স্বয়ংক্রিয় রিসেট সম্পূর্ণভাবে সরিয়ে দেওয়া হলো।
    // পাসওয়ার্ড ভুলে গেলে মাদ্রাসা প্রশাসন (PermissionGuard-যুক্ত resetUserPassword) রিসেট করাবেন।
    if (error && isStudentLogin) {
      await recordFailedLogin(rawIdentifier, "web_action", resolvedStudentMadrasaId);
      return {
        error:
          "পাসওয়ার্ড সঠিক নয়। আপনি যদি পাসওয়ার্ড ভুলে গিয়ে থাকেন, তবে মাদ্রাসা প্রশাসনের সাথে যোগাযোগ করে পাসওয়ার্ড রিসেট করিয়ে নিন।",
      };
    }

    if (error || !data?.user) {
      await recordFailedLogin(targetEmail, "web_action", resolvedStudentMadrasaId);
      return { error: error?.message || "লগইন ব্যর্থ হয়েছে।" };
    }
    if (!data.session) {
      await recordFailedLogin(targetEmail, "web_action", resolvedStudentMadrasaId);
      return {error: "লগইন ব্যর্থ হয়েছে।"};
    }
    const login = await completeAppLogin(supabase, data.session, "web", false, await headers());
    if (!login.ok) {
      await recordFailedLogin(data.user.email || targetEmail, "web_action", resolvedStudentMadrasaId);
      return {error: login.message};
    }
    if (login.perms.madrasaId) {
      await logAuditEvent({
        madrasaId: login.perms.madrasaId,
        actorId: data.user.id,
        actorEmail: data.user.email || targetEmail,
        actorRole: login.perms.role,
        module: "security",
        action: "LOGIN",
        entityType: "auth_session",
        entityId: data.user.id,
        entityLabel: data.user.email || targetEmail,
        summary: `ব্যবহারকারী সফলভাবে লগইন করেছেন (${data.user.email || targetEmail})`,
        severity: "INFO",
      });
    }
    targetRedirectUrl = getPortalRedirectUrl(login.perms.role, login.perms.roles);
    isSuccess = true;
  } catch (err: any) {
    console.error("SignIn catch block:", err);
    return { error: err?.message || "লগইনে একটি ত্রুটি হয়েছে।" };
  }

  if (isSuccess) {
    redirect(targetRedirectUrl);
  }
}

/**
 * Changes a guardian/student user's portal password.
 * Validates current password, updates in Supabase Auth, and clears default password status.
 */
export async function changeGuardianPassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return { success: false, error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে আবার লগইন করুন।" };
    }

    const cur = (currentPassword || "").trim();
    const next = (newPassword || "").trim();
    const conf = (confirmPassword || "").trim();

    if (!cur) {
      return { success: false, error: "আপনার বর্তমান পাসওয়ার্ড প্রদান করুন।" };
    }

    if (!next || next.length < 6) {
      return { success: false, error: "নতুন পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।" };
    }

    if (next !== conf) {
      return { success: false, error: "নতুন পাসওয়ার্ড ও কনফার্মেশন পাসওয়ার্ড মিলছে না।" };
    }

    if (next === "123456") {
      return { success: false, error: "সহজ বা অনুমানযোগ্য পাসওয়ার্ড ছাড়া একটি সুরক্ষিত পাসওয়ার্ড নির্ধারণ করুন।" };
    }

    // Verify current password by test sign-in if email exists
    if (user.email) {
      // Password verification must not replace the registered SSR session.
      const verifier = createStatelessSupabaseClient();
      const { error: verifyErr } = await verifier.auth.signInWithPassword({
        email: user.email,
        password: cur,
      });

      if (verifyErr) {
        return {
          success: false,
          error: "আপনার বর্তমান পাসওয়ার্ডটি সঠিক নয়। অনুগ্রহ করে তথ্য যাচাই করে সঠিক পাসওয়ার্ড দিন।",
        };
      }
      await verifier.auth.signOut({scope:"local"});
    }

    const adminClient = await createAdminClient();
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(user.id, {
      password: next,
      user_metadata: {
        ...(user.user_metadata || {}),
        is_default_password: false,
        password_changed_at: new Date().toISOString(),
      },
    });

    if (updateErr) {
      return { success: false, error: `পাসওয়ার্ড আপডেটে ত্রুটি: ${updateErr.message}` };
    }

    const madrasaId = user.user_metadata?.madrasa_id || null;
    if (madrasaId) {
      await logAuditEvent({
        madrasaId,
        actorId: user.id,
        actorEmail: user.email || null,
        module: "security",
        action: "PASSWORD_CHANGED",
        entityType: "user",
        entityId: user.id,
        entityLabel: user.email || user.id,
        summary: "পোর্টাল থেকে ব্যবহারকারীর পাসওয়ার্ড পরিবর্তন করা হয়েছে",
        severity: "INFO",
      });
    }

    revalidatePath("/portal");
    revalidatePath("/teacher-portal/profile");
    revalidatePath("/teacher-portal");
    return {
      success: true,
      message: "আলহামদুলিল্লাহ! আপনার পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে। পরবর্তী সময়ে এই নতুন পাসওয়ার্ড দিয়ে লগইন করুন।",
    };
  } catch (err: any) {
    console.error("Change password error:", err);
    return { success: false, error: err?.message || "পাসওয়ার্ড পরিবর্তনে সমস্যা হয়েছে।" };
  }
}

/**
 * Triggers bulk sync of default logins (student_id + 123456) for all students.
 */
export async function syncAllStudentLoginsAction(): Promise<SyncStudentLoginsResult> {
  try {
    const guard = await writeGuard('users');
    if (!guard.allowed || !guard.madrasaId) return {success:false,error:'অনুমতি নেই।'};
    const madrasaId = guard.madrasaId;
    const res = await syncAllStudentsDefaultLogins(madrasaId);
    revalidatePath("/dashboard/users");
    revalidatePath("/dashboard/students");
    return res;
  } catch (err: any) {
    return { success: false, error: err?.message || "সিঙ্ক করতে সমস্যা হয়েছে।" };
  }
}

export async function logout() {
  let confirmed = true;
  try {
    const supabase = await createClient();
    try {
      const verified = await getWebAppSession(supabase);
      if (verified) {
        const {revokeUserSession} = await import("@/lib/session-manager");
        const result = await revokeUserSession({sessionId:verified.session.id, madrasaId:verified.session.madrasa_id,
          ownerUserId:verified.user.id, revokedBy:verified.user.id, reason:"USER_LOGOUT", skipAudit:true});
        if (!result.success) confirmed = false;
        if (verified.session.madrasa_id) {
          await logAuditEvent({
            madrasaId: verified.session.madrasa_id,
            actorId: verified.user.id,
            actorEmail: verified.user.email || null,
            module: "security",
            action: "LOGOUT",
            entityType: "auth_session",
            entityId: verified.session.id,
            entityLabel: verified.user.email || verified.user.id,
            summary: "ব্যবহারকারী সিস্টেম থেকে লগআউট করেছেন",
            severity: "INFO",
          });
        }
      } else { confirmed = false; }
    } catch { confirmed = false; }
    // Still attempt issuer sign-out if the app registry was unavailable. Other
    // devices are independent logins; clearing this browser must not end theirs.
    const {error} = await supabase.auth.signOut({scope:"local"});
    if (error) confirmed = false;
  } catch { confirmed = false; }

  // ⛔ L-3 ফিক্স: signOut() সেশন সার্ভারে বাতিল করে এবং `setAll` দিয়ে cookie মুছতে চায় —
  // কিন্তু `createClient` React `cache()`-এ মোড়ানো এবং RSC-তে cookie লেখা নীরবে ব্যর্থ হয়।
  // ফলে কখনো কখনো `sb-*-auth-token` cookie ক্লায়েন্টে থেকে যেত এবং পরের রিকোয়েস্টে
  // পুরোনো (বাতিল) টোকেন নিয়ে ব্যবহারকারী "লগআউট হয়নি" অনুভব করতেন। তাই এখানে
  // ডিফেন্স-ইন-ডেপথ হিসেবে সব Supabase auth cookie স্পষ্টভাবে মোছে হয়।
  try {
    const cookieStore = await cookies();
    for (const cookie of cookieStore.getAll()) {
      if (
        cookie.name.startsWith("sb-") ||
        cookie.name === "qawmi_remember_me" ||
        cookie.name === "qawmi_session_id" ||
        cookie.name === "qawmi_step_up_token"
      ) {
        try {
          cookieStore.delete(cookie.name);
        } catch {
          /* কিছু পরিবেশে cookie লিখন নিষিদ্ধ — signOut-ই তখন একমাত্র ভরসা */
        }
      }
    }
  } catch (err) {
    console.warn("Logout cookie cleanup warning:", err);
  }

  // লগআউটের পর ক্যাশে করা RSC পেলোড যেন পুরোনো সেশন-ডেটা না দেখায়
  try {
    revalidatePath("/", "layout");
  } catch {
    /* ক্যাশ রিভ্যালিডেশন ব্যর্থ হলেও লগআউট চলবে */
  }

  redirect(confirmed ? "/login" : "/login?logout=unconfirmed");
}

