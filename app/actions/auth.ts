"use server";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPortalRedirectUrl } from "@/lib/role-redirect";
import {
  findStudentByIdentifier,
  ensureStudentGuardianAuthUser,
  syncAllStudentsDefaultLogins,
  SyncStudentLoginsResult,
} from "@/lib/student-auth";

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
    let canonicalEmail = "";
    let legacyEmail = "";

    // If identifier doesn't have '@' or is a student ID / roll / phone
    if (!rawIdentifier.includes("@") || rawIdentifier.endsWith("@qawmi.app")) {
      const resolved = await findStudentByIdentifier(rawIdentifier);
      if (resolved) {
        isStudentLogin = true;
        canonicalEmail = resolved.portalEmail;
        legacyEmail = resolved.legacyPortalEmail;
        const authRes = await ensureStudentGuardianAuthUser(
          resolved.student,
          resolved.canonicalStudentId,
          "123456"
        );
        targetEmail = authRes.email || canonicalEmail;
      } else if (!rawIdentifier.includes("@")) {
        return {
          error: `প্রদত্ত আইডি বা রোল (${rawIdentifier}) অনুযায়ী কোনো শিক্ষার্থী খুঁজে পাওয়া যায়নি। আপনার সঠিক শিক্ষার্থী আইডি (যেমন: AHH480001 বা 480001) প্রদান করুন।`,
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
      const altEmails = [canonicalEmail, legacyEmail].filter(
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

    // If student login failed with default password (123456), force password sync and retry
    if (error && isStudentLogin && password.trim() === "123456") {
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
          }
        }
      } catch (syncPassErr) {
        console.warn("Password sync in server action login error:", syncPassErr);
      }
    }

    if (error || !data?.user) {
      if (isStudentLogin) {
        return {
          error: "পাসওয়ার্ড সঠিক নয়। ডিফল্ট পাসওয়ার্ড 123456 অথবা আপনার পরবর্তীতে পরিবর্তিত পাসওয়ার্ড ব্যবহার করুন।",
        };
      }
      return { error: error?.message || "লগইন ব্যর্থ হয়েছে।" };
    }

    if (data.user) {
      let userRole = data.user.user_metadata?.role || (isStudentLogin ? "parent" : "staff");
      let additionalRoles: string[] = [];

      try {
        const adminClient = await createAdminClient();
        const { data: userData } = await adminClient
          .from("users")
          .select("role, madrasa_id")
          .eq("id", data.user.id)
          .maybeSingle();

        if (userData?.role) {
          userRole = userData.role;
        }

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

        if (userData?.madrasa_id) {
          const { data: madrasaRow } = await adminClient
            .from("madrasas")
            .select("registration_no")
            .eq("id", userData.madrasa_id)
            .maybeSingle();
          if (madrasaRow?.registration_no?.startsWith("{")) {
            const parsed = JSON.parse(madrasaRow.registration_no);
            const profile = parsed.user_security_profiles?.[data.user.id];
            if (profile?.primaryRole) userRole = profile.primaryRole;
            if (profile?.roles) additionalRoles = profile.roles;
          }
        }
      } catch (e) {
        console.warn("Role lookup in login action error:", e);
      }

      targetRedirectUrl = getPortalRedirectUrl(userRole, additionalRoles);
    }

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
      return { success: false, error: "বর্তমান পাসওয়ার্ড প্রদান করুন (ডিফল্ট: 123456)।" };
    }

    if (!next || next.length < 6) {
      return { success: false, error: "নতুন পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।" };
    }

    if (next !== conf) {
      return { success: false, error: "নতুন পাসওয়ার্ড ও কনফার্মেশন পাসওয়ার্ড মিলছে না।" };
    }

    if (next === "123456") {
      return { success: false, error: "ডিফল্ট পাসওয়ার্ড (123456) ছাড়া অন্য কোনো গোপন পাসওয়ার্ড দিন।" };
    }

    // Verify current password by test sign-in if email exists
    if (user.email) {
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: cur,
      });

      if (verifyErr) {
        return {
          success: false,
          error: "আপনার বর্তমান পাসওয়ার্ডটি সঠিক নয়। ডিফল্ট পাসওয়ার্ড 123456 অথবা আপনার পূর্বে সেট করা পাসওয়ার্ড দিন।",
        };
      }
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

    revalidatePath("/portal");
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
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { success: false, error: "অননুমোদিত অ্যাক্সেস।" };

    const adminClient = await createAdminClient();
    const { data: userRow } = await adminClient.from("users").select("madrasa_id").eq("id", user.id).maybeSingle();
    const madrasaId = userRow?.madrasa_id;

    const res = await syncAllStudentsDefaultLogins(madrasaId);
    revalidatePath("/dashboard/users");
    revalidatePath("/dashboard/students");
    return res;
  } catch (err: any) {
    return { success: false, error: err?.message || "সিঙ্ক করতে সমস্যা হয়েছে।" };
  }
}

export async function logout() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("Logout error:", err);
  }
  redirect("/login");
}

