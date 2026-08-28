"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";

export interface MadrasaUser {
  id: string;
  madrasa_id: string;
  role: "super_admin" | "admin" | "muhtamim" | "teacher" | "accountant" | "hostel_manager" | "library_manager" | "parent" | "student";
  full_name: string;
  phone?: string | null;
  email: string;
  created_at: string;
  student_id?: string | null;
  teacher_id?: string | null;
  student_info?: {
    first_name?: string;
    last_name?: string;
    roll_number?: string | number | null;
    class_name?: string | null;
  } | null;
  teacher_info?: {
    first_name?: string;
    last_name?: string;
    designation?: string | null;
  } | null;
}

/**
 * Fetch all users for the authenticated madrasa
 */
export async function getMadrasaUsers() {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস", users: [] };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "কোন মাদরাসা পাওয়া যায়নি", users: [] };

    const adminClient = await createAdminClient();
    const { data: users, error } = await adminClient
      .from("users")
      .select("*")
      .eq("madrasa_id", madrasaId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching users:", error);
      return { error: error.message, users: [] };
    }

    return { users: users || [], error: null };
  } catch (err: any) {
    console.error("Catch in getMadrasaUsers:", err);
    return { error: err.message || "ইউজার তালিকা লোড করতে সমস্যা হয়েছে", users: [] };
  }
}

/**
 * Fetch linkable teacher and student profiles for quick user creation
 */
export async function getLinkableProfiles() {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { teachers: [], students: [] };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { teachers: [], students: [] };

    const [teachersRes, studentsRes] = await Promise.all([
      supabase
        .from("teachers")
        .select("id, first_name, last_name, phone, email, designation")
        .eq("madrasa_id", madrasaId)
        .order("first_name"),
      supabase
        .from("students")
        .select("id, first_name, last_name, roll_number, student_id, phone, parent_phone, father_name, class_name, classes(name)")
        .eq("madrasa_id", madrasaId)
        .order("first_name"),
    ]);

    return {
      teachers: teachersRes.data || [],
      students: (studentsRes.data || []).map((s: any) => ({
        ...s,
        class_name: s.class_name || s.classes?.name || "",
      })),
    };
  } catch (err: any) {
    console.error("Error fetching linkable profiles:", err);
    return { teachers: [], students: [] };
  }
}

/**
 * Create a new user account (with Supabase Auth + users table)
 */
export async function createUserAccount(prevState: any, formData: FormData) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি।" };

    const fullName = (formData.get("full_name") as string)?.trim();
    const role = (formData.get("role") as string)?.trim() || "parent";
    let email = (formData.get("email") as string)?.trim().toLowerCase();
    const phone = (formData.get("phone") as string)?.trim() || "";
    const password = (formData.get("password") as string)?.trim();
    const studentId = (formData.get("student_id") as string)?.trim() || null;
    const teacherId = (formData.get("teacher_id") as string)?.trim() || null;

    if (!fullName) {
      return { error: "ব্যবহারকারীর পুরো নাম আবশ্যক।" };
    }

    if (!password || password.length < 6) {
      return { error: "পাসওয়ার্ড বা পিন অন্তত ৬ অক্ষরের হতে হবে।" };
    }

    // Auto-generate email if missing (e.g. phone-based or random username)
    if (!email) {
      const sanitizedPhone = phone.replace(/[^0-9]/g, "");
      if (sanitizedPhone.length >= 6) {
        email = `${role}_${sanitizedPhone}@qawmi.app`;
      } else {
        const randomStr = Math.random().toString(36).substring(2, 8);
        email = `${role}_${randomStr}@qawmi.app`;
      }
    }

    // Ensure valid email format
    if (!email.includes("@")) {
      email = `${email.replace(/[^a-zA-Z0-9._-]/g, "")}@qawmi.app`;
    }

    const adminClient = await createAdminClient();

    // Check if user with this email already exists in Auth
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone,
        role,
        madrasa_id: madrasaId,
        student_id: studentId,
        teacher_id: teacherId,
      },
    });

    if (authError) {
      console.error("Auth creation error:", authError);
      return { error: `লগইন অ্যাকাউন্ট তৈরিতে ত্রুটি: ${authError.message}` };
    }

    const authUserId = authData.user.id;

    // Insert into users table
    const { error: userError } = await adminClient.from("users").upsert({
      id: authUserId,
      madrasa_id: madrasaId,
      full_name: fullName,
      email: email,
      phone: phone || null,
      role: role,
    });

    if (userError) {
      console.error("Users table insertion error:", userError);
      return { error: `ডাটাবেজ প্রোফাইল তৈরিতে ত্রুটি: ${userError.message}` };
    }

    revalidatePath("/dashboard/users");
    revalidatePath("/dashboard/teachers");
    revalidatePath("/dashboard/students");

    return {
      success: true,
      message: "ইউজার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!",
      createdUser: {
        id: authUserId,
        full_name: fullName,
        email,
        phone,
        role,
        password,
      },
    };
  } catch (err: any) {
    console.error("Catch in createUserAccount:", err);
    return { error: err.message || "ইউজার তৈরি করতে অপ্রত্যাশিত ত্রুটি ঘটেছে।" };
  }
}

/**
 * Update an existing user's profile
 */
export async function updateUserAccount(prevState: any, formData: FormData) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি" };

    const userId = formData.get("user_id") as string;
    const fullName = (formData.get("full_name") as string)?.trim();
    const phone = (formData.get("phone") as string)?.trim() || null;
    const role = (formData.get("role") as string)?.trim();

    if (!userId || !fullName) {
      return { error: "ইউজার আইডি এবং পুরো নাম আবশ্যক।" };
    }

    const adminClient = await createAdminClient();

    const updatePayload: any = {
      full_name: fullName,
      phone: phone,
    };
    if (role) {
      updatePayload.role = role;
    }

    const { error } = await adminClient
      .from("users")
      .update(updatePayload)
      .eq("id", userId)
      .eq("madrasa_id", madrasaId);

    if (error) {
      console.error("User update error:", error);
      return { error: error.message };
    }

    revalidatePath("/dashboard/users");
    return { success: true, message: "ইউজার তথ্য সফলভাবে আপডেট হয়েছে!" };
  } catch (err: any) {
    console.error("Catch in updateUserAccount:", err);
    return { error: err.message || "আপডেট ব্যর্থ হয়েছে" };
  }
}

/**
 * Reset / Update a user's password
 */
export async function resetUserPassword(userId: string, newPassword: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };

    if (!newPassword || newPassword.length < 6) {
      return { error: "পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।" };
    }

    const adminClient = await createAdminClient();

    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      console.error("Error resetting password:", error);
      return { error: `পাসওয়ার্ড পরিবর্তনে ত্রুটি: ${error.message}` };
    }

    return { success: true, message: "পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!" };
  } catch (err: any) {
    console.error("Catch in resetUserPassword:", err);
    return { error: err.message || "পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে।" };
  }
}

/**
 * Delete a user account (from Auth + users table)
 */
export async function deleteUserAccount(userId: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি" };

    // Prevent self-deletion
    if (user.id === userId) {
      return { error: "আপনি নিজের চলমান অ্যাকাউন্ট মুছে ফেলতে পারবেন না।" };
    }

    const adminClient = await createAdminClient();

    // Delete from users table
    const { error: dbError } = await adminClient
      .from("users")
      .delete()
      .eq("id", userId)
      .eq("madrasa_id", madrasaId);

    if (dbError) {
      console.error("Error deleting from users table:", dbError);
    }

    // Delete from Auth
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId);
    if (authError) {
      console.error("Error deleting from Supabase Auth:", authError);
      return { error: `লগইন ইউজার মুছে ফেলতে ত্রুটি: ${authError.message}` };
    }

    revalidatePath("/dashboard/users");
    return { success: true, message: "ইউজার অ্যাকাউন্ট সফলভাবে মুছে ফেলা হয়েছে।" };
  } catch (err: any) {
    console.error("Catch in deleteUserAccount:", err);
    return { error: err.message || "ইউজার মুছে ফেলতে ব্যর্থ হয়েছে।" };
  }
}
