"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";

export async function createTeacher(prevState: any, formData: FormData) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) {
    return { error: "No Madrasa exists in the system. Please register a Madrasa first." };
  }

  const firstName = formData.get("first_name") as string;
  const lastName = formData.get("last_name") as string;
  const phone = formData.get("phone") as string;
  const designation = formData.get("designation") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!firstName || !lastName) {
    return { error: "প্রথম এবং শেষ নাম আবশ্যক।" };
  }

  let authUserId = null;

  if (email && password) {
    const adminClient = await createAdminClient();
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error("Error creating teacher auth user:", authError);
      return { error: `অ্যাকাউন্ট তৈরিতে ত্রুটি: ${authError.message}` };
    }
    
    authUserId = authData.user.id;

    // Insert into users table
    const { error: userError } = await adminClient.from("users").insert({
      id: authUserId,
      madrasa_id: finalMadrasaId,
      full_name: `${firstName} ${lastName}`,
      email: email,
      role: 'teacher'
    });

    if (userError) {
      console.error("Error creating teacher user profile:", userError);
      return { error: `প্রোফাইল তৈরিতে ত্রুটি: ${userError.message}` };
    }
  }

  const { error } = await supabase.from("teachers").insert({
    madrasa_id: finalMadrasaId,
    first_name: firstName,
    last_name: lastName,
    phone: phone,
    designation: designation,
    email: email,
  });

  if (error) {
    console.error("Error creating teacher:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/teachers");
  return { success: true };
}

export async function getTeacher(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teachers")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching teacher:", error);
    return null;
  }
  return data;
}

export async function updateTeacher(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const id = formData.get("id") as string;
  const firstName = formData.get("first_name") as string;
  const lastName = formData.get("last_name") as string;
  const phone = formData.get("phone") as string;
  const designation = formData.get("designation") as string;
  const email = formData.get("email") as string;

  if (!firstName || !lastName) {
    return { error: "প্রথম এবং শেষ নাম আবশ্যক।" };
  }

  const { error } = await supabase
    .from("teachers")
    .update({
      first_name: firstName,
      last_name: lastName,
      phone: phone,
      designation: designation,
      email: email,
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating teacher:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/teachers");
  return { success: true };
}

export async function deleteTeacher(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("teachers")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting teacher:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/teachers");
  return { success: true };
}
