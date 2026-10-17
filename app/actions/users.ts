"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";
import { requirePermission } from "@/lib/permissions-server";

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
    // HI-8 ফিক্স: আগে `.or(\`madrasa_id.eq.${madrasaId},madrasa_id.is.null\`)` দিয়ে
    // প্লাটফর্মের সব madrasa_id=NULL ইউজারও আনা হতো এবং নিচে সেগুলো নিজের মাদ্রাসায়
    // "দখল" করে নেওয়া হতো (adminClient RLS বাইপাস করে) — ফলে এক অ্যাডমিন অন্য
    // টেন্যান্টের অনাথ ইউজারদের মালিকানা নিয়ে নিতেন। এখন শুধু নিজের মাদ্রাসার ইউজার।
    let { data: users, error } = await adminClient
      .from("users")
      .select("*")
      .eq("madrasa_id", madrasaId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching users:", error);
      return { error: error.message, users: [] };
    }

    // HI-8 (পূর্বে এখানে স্বয়ংক্রিয় "দখল" ছিল): মাদ্রাসাহীন ইউজার নিজে নিজে কোনো
    // মাদ্রাসার সাথে যুক্ত হবে না। অ্যাডমিনকে শুধু জানানো হয় যাতে তিনি সচেতনভাবে নিয়োগ করেন।
    return { users: users || [], error: null, unassignedCount: 0 };
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
        .select("id, first_name, last_name, roll_number, parent_phone, father_name, class_name, classes(name)")
        .eq("madrasa_id", madrasaId)
        .order("created_at", { ascending: true }),
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

    // CR-2 ফিক্স: সার্ভার-সাইড পারমিশন যাচাই। আগে শুধু `if (!user)` ছিল — ফলে সবচেয়ে
    // নিচু অনুমতির অ্যাকাউন্টও (এমনকি অভিভাবক/শিক্ষার্থী) সরাসরি server action কল করে
    // ইউজার তৈরি, ভূমিকা পরিবর্তন, পাসওয়ার্ড রিসেট ও অ্যাকাউন্ট মুছে ফেলতে পারত।
    const guard = await requirePermission({
      userId: user.id,
      madrasaId,
      permissions: ["user.create", "user.edit"],
      roles: ["super_admin", "admin", "muhtamim"],
    });
    if (!guard.allowed) return { error: guard.error || "এই কাজটি করার অনুমতি নেই।" };

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

    // privilege escalation প্রতিরোধ: নিজের চেয়ে উঁচু ভূমিকা তৈরি/দান করা যাবে না।
    const ALLOWED_ROLES = [
      "super_admin", "admin", "muhtamim", "teacher", "accountant",
      "hostel_manager", "library_manager", "parent", "student", "staff",
    ];
    if (!ALLOWED_ROLES.includes(role)) {
      return { error: "অবৈধ ভূমিকা নির্বাচন করা হয়েছে।" };
    }
    const actorIsSuperAdmin = guard.context?.roles.includes("super_admin") === true;
    if (role === "super_admin" && !actorIsSuperAdmin) {
      return { error: "সুপার অ্যাডমিন ভূমিকা কেবল সুপার অ্যাডমিন তৈরি করতে পারেন।" };
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
      // MD-8 ফিক্স: আগে Auth ইউজার তৈরি হয়ে থাকলেও প্রোফাইল row ছাড়াই থেকে যেত —
      // ফলে অ্যাকাউন্টটি কোথাও দেখা যেত না, আবার একই ইমেইলে আবার চেষ্টা করলে
      // "already registered" error আসত। এখন ব্যর্থ হলে Auth ইউজারটি ফিরিয়ে মুছে দেওয়া হয়।
      try {
        await adminClient.auth.admin.deleteUser(authUserId);
      } catch (rollbackErr) {
        console.warn("Orphan auth user rollback failed:", rollbackErr);
      }
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

    // CR-2 ফিক্স: সার্ভার-সাইড পারমিশন যাচাই। আগে শুধু `if (!user)` ছিল — ফলে সবচেয়ে
    // নিচু অনুমতির অ্যাকাউন্টও (এমনকি অভিভাবক/শিক্ষার্থী) সরাসরি server action কল করে
    // ইউজার তৈরি, ভূমিকা পরিবর্তন, পাসওয়ার্ড রিসেট ও অ্যাকাউন্ট মুছে ফেলতে পারত।
    const guard = await requirePermission({
      userId: user.id,
      madrasaId,
      permissions: ["user.edit"],
      roles: ["super_admin", "admin", "muhtamim"],
    });
    if (!guard.allowed) return { error: guard.error || "এই কাজটি করার অনুমতি নেই।" };

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
      const ALLOWED_ROLES_UPDATE = [
        "super_admin", "admin", "muhtamim", "teacher", "accountant",
        "hostel_manager", "library_manager", "parent", "student", "staff",
      ];
      if (!ALLOWED_ROLES_UPDATE.includes(role)) {
        return { error: "অবৈধ ভূমিকা নির্বাচন করা হয়েছে।" };
      }
      const actorIsSuper = guard.context?.roles.includes("super_admin") === true;
      if (role === "super_admin" && !actorIsSuper) {
        return { error: "সুপার অ্যাডমিন ভূমিকা কেবল সুপার অ্যাডমিন দিতে পারেন।" };
      }
      const { data: currentTarget } = await (await createAdminClient())
        .from("users")
        .select("role")
        .eq("id", userId)
        .eq("madrasa_id", madrasaId)
        .maybeSingle();
      if (currentTarget?.role === "super_admin" && !actorIsSuper) {
        return { error: "সুপার অ্যাডমিনের ভূমিকা কেবল সুপার অ্যাডমিন পরিবর্তন করতে পারেন।" };
      }
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

    // ⛔ HI-10 ফিক্স: আগে এই ফাংশনে madrasa স্কোপ, নিজের-অ্যাকাউন্ট চেক বা কোনো
    // পারমিশন যাচাই—কিছুই ছিল না। ফলে যেকোনো লগইন করা ইউজার শুধু একটি UUID জানলেই
    // admin API দিয়ে super_admin সহ যেকোনো অ্যাকাউন্টের পাসওয়ার্ড বদলে দিতে পারত।
    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি" };

    const guard = await requirePermission({
      userId: user.id,
      madrasaId,
      permissions: ["user.reset", "user.edit"],
      roles: ["super_admin", "admin", "muhtamim"],
    });
    if (!guard.allowed) return { error: guard.error || "এই কাজটি করার অনুমতি নেই।" };

    if (user.id === userId) {
      return {
        error:
          "নিজের পাসওয়ার্ড এখান থেকে রিসেট করা যাবে না। ‘আমার প্রোফাইল’ থেকে নিজের পাসওয়ার্ড পরিবর্তন করুন।",
      };
    }

    const adminClient = await createAdminClient();

    // টার্গেট ইউজার অবশ্যই একই মাদ্রাসার হতে হবে
    const { data: targetUser } = await adminClient
      .from("users")
      .select("id, role, full_name")
      .eq("id", userId)
      .eq("madrasa_id", madrasaId)
      .maybeSingle();

    if (!targetUser) {
      return { error: "ইউজার পাওয়া যায়নি বা অন্য মাদ্রাসার ইউজার।" };
    }

    // super_admin-এর পাসওয়ার্ড শুধু অন্য super_admin বদলাতে পারবেন
    const actorIsSuperAdmin = guard.context?.roles.includes("super_admin");
    if (targetUser.role === "super_admin" && !actorIsSuperAdmin) {
      return { error: "সুপার অ্যাডমিনের পাসওয়ার্ড কেবল সুপার অ্যাডমিন রিসেট করতে পারেন।" };
    }

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

    // CR-2 ফিক্স: সার্ভার-সাইড পারমিশন যাচাই। আগে শুধু `if (!user)` ছিল — ফলে সবচেয়ে
    // নিচু অনুমতির অ্যাকাউন্টও (এমনকি অভিভাবক/শিক্ষার্থী) সরাসরি server action কল করে
    // ইউজার তৈরি, ভূমিকা পরিবর্তন, পাসওয়ার্ড রিসেট ও অ্যাকাউন্ট মুছে ফেলতে পারত।
    const guard = await requirePermission({
      userId: user.id,
      madrasaId,
      permissions: ["user.disable", "user.delete"],
      roles: ["super_admin", "admin", "muhtamim"],
    });
    if (!guard.allowed) return { error: guard.error || "এই কাজটি করার অনুমতি নেই।" };

    // Prevent self-deletion
    if (user.id === userId) {
      return { error: "আপনি নিজের চলমান অ্যাকাউন্ট মুছে ফেলতে পারবেন না।" };
    }

    const adminClient = await createAdminClient();

    // super_admin অ্যাকাউন্ট কেবল অন্য super_admin মুছতে পারবেন
    const { data: deleteTarget } = await adminClient
      .from("users")
      .select("id, role")
      .eq("id", userId)
      .eq("madrasa_id", madrasaId)
      .maybeSingle();

    if (!deleteTarget) {
      return { error: "ইউজার পাওয়া যায়নি বা অন্য মাদ্রাসার ইউজার।" };
    }

    const actorIsSuper = guard.context?.roles.includes("super_admin");
    if (deleteTarget.role === "super_admin" && !actorIsSuper) {
      return { error: "সুপার অ্যাডমিন অ্যাকাউন্ট কেবল সুপার অ্যাডমিন মুছতে পারেন।" };
    }

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
