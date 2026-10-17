"use server";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
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

    // ⛔ নিরাপত্তা ফিক্স (CR-1): আগে এখানে "ডিফল্ট পাসওয়ার্ড (123456) দিয়ে লগইন ব্যর্থ হলে
    // admin API দিয়ে জোরপূর্বক পাসওয়ার্ড রিসেট করে আবার লগইন" করার কোড ছিল। ফলে শুধু শিক্ষার্থী
    // আইডি জানলেই যে কেউ ওই অ্যাকাউন্ট দখল করতে পারত — কারণ শিক্ষার্থী আগে পাসওয়ার্ড বদলালেও
    // সিস্টেম নিজেই সেটি মুছে 123456 করে দিত। এই স্বয়ংক্রিয় রিসেট সম্পূর্ণভাবে সরিয়ে দেওয়া হলো।
    // পাসওয়ার্ড ভুলে গেলে মাদ্রাসা প্রশাসন (PermissionGuard-যুক্ত resetUserPassword) রিসেট করাবেন।
    if (error && isStudentLogin) {
      return {
        error:
          "পাসওয়ার্ড সঠিক নয়। আপনি যদি পাসওয়ার্ড ভুলে গিয়ে থাকেন, তবে মাদ্রাসা প্রশাসনের সাথে যোগাযোগ করে পাসওয়ার্ড রিসেট করিয়ে নিন।",
      };
    }

    if (error || !data?.user) {
      return { error: error?.message || "লগইন ব্যর্থ হয়েছে।" };
    }
    // ⛔ CR-4: অ্যাকাউন্ট স্ট্যাটাস (SUSPENDED / DISABLED) এখানেই যাচাই করা হয়।
    // আগে স্ট্যাটাস শুধু ক্লায়েন্ট কম্পোনেন্টে দেখা হতো — ফলে স্থগিত ইউজারও লগইন করে
    // server action সরাসরি কল করে সব কাজ করতে পারত।
    try {
      const statusClient = await createAdminClient();
      const { data: statusRow } = await statusClient
        .from("users")
        .select("madrasa_id, role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (statusRow?.madrasa_id) {
        const { loadServerPermissions } = await import("@/lib/permissions-server");
        const permCtx = await loadServerPermissions(data.user.id, statusRow.madrasa_id);
        if (permCtx && (permCtx.status === "SUSPENDED" || permCtx.status === "DISABLED")) {
          await supabase.auth.signOut();
          return {
            error:
              permCtx.status === "SUSPENDED"
                ? "আপনার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত করা হয়েছে। মাদ্রাসা প্রশাসনের সাথে যোগাযোগ করুন।"
                : "আপনার অ্যাকাউন্টটি নিষ্ক্রিয় (Disabled) করা হয়েছে। মাদ্রাসা প্রশাসনের সাথে যোগাযোগ করুন।",
          };
        }
      }
    } catch (statusErr) {
      console.warn("Account status check during login failed:", statusErr);
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

  // ⛔ L-3 ফিক্স: signOut() সেশন সার্ভারে বাতিল করে এবং `setAll` দিয়ে cookie মুছতে চায় —
  // কিন্তু `createClient` React `cache()`-এ মোড়ানো এবং RSC-তে cookie লেখা নীরবে ব্যর্থ হয়।
  // ফলে কখনো কখনো `sb-*-auth-token` cookie ক্লায়েন্টে থেকে যেত এবং পরের রিকোয়েস্টে
  // পুরোনো (বাতিল) টোকেন নিয়ে ব্যবহারকারী "লগআউট হয়নি" অনুভব করতেন। তাই এখানে
  // ডিফেন্স-ইন-ডেপথ হিসেবে সব Supabase auth cookie স্পষ্টভাবে মোছে হয়।
  try {
    const cookieStore = await cookies();
    for (const cookie of cookieStore.getAll()) {
      if (cookie.name.startsWith("sb-")) {
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

  redirect("/login");
}

