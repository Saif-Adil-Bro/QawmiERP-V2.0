"use server";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPortalRedirectUrl } from "@/lib/role-redirect";

export async function login(prevState: any, formData: FormData) {
  let isSuccess = false;
  let targetRedirectUrl = "/dashboard";
  
  try {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    
    if (!email || !password) {
      return { error: "ইমেইল এবং পাসওয়ার্ড আবশ্যক" };
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
       return { error: "সার্ভার কনফিগারেশন ত্রুটি: সুপাবেস কি পাওয়া যায়নি।" };
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    if (data.user) {
      let userRole = data.user.user_metadata?.role || "staff";
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
            .eq("email", email)
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

export async function logout() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("Logout error:", err);
  }
  redirect("/login");
}

