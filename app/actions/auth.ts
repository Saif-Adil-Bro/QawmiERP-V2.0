"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function login(prevState: any, formData: FormData) {
  let isSuccess = false;
  
  try {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    
    if (!email || !password) {
      return { error: "Email and password are required" };
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
       return { error: "Server configuration error: Supabase keys are missing." };
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
    return { error: err?.message || "An unexpected error occurred during sign in." };
  }

  if (isSuccess) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
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
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
