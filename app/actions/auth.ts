"use server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function login(prevState: any, formData: FormData) {
  let isSuccess = false;
  
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

    isSuccess = true;
  } catch (err: any) {
    console.error("SignIn catch block:", err);
    return { error: err?.message || "লগইনে একটি ত্রুটি হয়েছে।" };
  }

  if (isSuccess) {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (user) {
      const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).single();
      if (userData?.role === 'parent' || userData?.role === 'student') {
        redirect("/portal");
      }
      if (userData?.role === 'teacher') {
        redirect("/teacher-portal");
      }
    }
    redirect("/dashboard");
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
