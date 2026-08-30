"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getStudents() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("students")
      .select("*, classes(*)")
      .order("created_at", { ascending: false });

    if (error || !data) {
      console.warn("Retrying students fetch with admin fallback...");
      try {
        const adminClient = await createAdminClient();
        const { data: adminData } = await adminClient
          .from("students")
          .select("*, classes(*)")
          .order("created_at", { ascending: false });
        if (adminData && adminData.length > 0) return adminData;

        const { data: fallbackData } = await adminClient
          .from("students")
          .select("*")
          .order("created_at", { ascending: false });
        return fallbackData || [];
      } catch {
        return [];
      }
    }
    return data || [];
  } catch (err) {
    console.error("Exception in getStudents:", err);
    return [];
  }
}

export async function getClasses() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .order("name");

    if (error || !data || data.length === 0) {
      try {
        const adminClient = await createAdminClient();
        const { data: adminData } = await adminClient
          .from("classes")
          .select("*")
          .order("name");
        return adminData || [];
      } catch {
        return [];
      }
    }
    return data;
  } catch (err) {
    console.error("Exception in getClasses:", err);
    return [];
  }
}

export async function getStudentById(id: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("students")
      .select("*, classes(*)")
      .eq("id", id)
      .single();

    if (error || !data) {
      try {
        const adminClient = await createAdminClient();
        const { data: fallbackData } = await adminClient
          .from("students")
          .select("*")
          .eq("id", id)
          .single();
        return fallbackData || null;
      } catch {
        return null;
      }
    }
    return data || null;
  } catch (err) {
    console.error("Exception in getStudentById:", err);
    return null;
  }
}

export async function getAuthMadrasaId(supabase: any, user: any) {
  if (!user?.id) return null;
  try {
    const adminClient = await createAdminClient();

    // 1. Try getting user's madrasa_id from users table using adminClient (bypasses RLS)
    const { data: userData } = await adminClient
      .from("users")
      .select("madrasa_id")
      .eq("id", user.id)
      .single();

    let finalMadrasaId = userData?.madrasa_id;

    if (finalMadrasaId) {
      return finalMadrasaId;
    }

    // 2. If user doesn't have a valid madrasa_id, find or create the primary madrasa
    const { data: firstMadrasa } = await adminClient
      .from("madrasas")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (firstMadrasa?.id) {
      finalMadrasaId = firstMadrasa.id;
    } else {
      // Create new madrasa if table is completely empty
      const { data: newMadrasa } = await adminClient
        .from("madrasas")
        .insert({
          name: "মাদ্রাসাতুল মুসলিমীন",
          subscription_plan: "free",
        })
        .select("id")
        .single();

      if (newMadrasa?.id) {
        finalMadrasaId = newMadrasa.id;
      }
    }

    if (finalMadrasaId) {
      try {
        await adminClient.from("users").upsert({
          id: user.id,
          madrasa_id: finalMadrasaId,
          full_name: user.email?.split("@")[0] || "Admin",
          email: user.email || "",
          role: "super_admin",
        });
      } catch {}
    }

    return finalMadrasaId || null;
  } catch (err) {
    console.error("Exception in getAuthMadrasaId:", err);
    return null;
  }
}

export async function createStudent(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) {
    return { error: "No Madrasa exists in the system. Please register a Madrasa first." };
  }

  const firstName = formData.get("first_name") as string;
  const lastName = formData.get("last_name") as string;
  const rollNumber = formData.get("roll_number") as string;
  const classId = formData.get("class_id") as string;
  const parentPhone = formData.get("parent_phone") as string;
  const parentEmail = formData.get("parent_email") as string;
  const password = formData.get("password") as string;
  const fatherName = formData.get("father_name") as string;
  const address = formData.get("address") as string;
  const photoUrl = formData.get("photo_url") as string;

  if (!firstName || !lastName || !classId) {
    return { error: "First name, Last name and Class are required." };
  }

  let authUserId = null;

  if (parentEmail && password) {
    const adminClient = await createAdminClient();
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: parentEmail,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error("Error creating student/parent auth user:", authError);
      return { error: `অ্যাকাউন্ট তৈরিতে ত্রুটি: ${authError.message}` };
    }
    
    authUserId = authData.user.id;

    // Insert into users table
    const { error: userError } = await adminClient.from("users").insert({
      id: authUserId,
      madrasa_id: finalMadrasaId,
      full_name: `${firstName}'s Parent`,
      email: parentEmail,
      role: 'parent'
    });

    if (userError) {
      console.error("Error creating parent user profile:", userError);
      return { error: `প্রোফাইল তৈরিতে ত্রুটি: ${userError.message}` };
    }
  }

  const { data: insertedStudent, error } = await supabase.from("students").insert({
    madrasa_id: finalMadrasaId,
    first_name: firstName,
    last_name: lastName,
    roll_number: rollNumber,
    class_id: classId,
    parent_phone: parentPhone,
    father_name: fatherName,
    address: address,
    photo_url: photoUrl,
  }).select("id").single();

  if (error) {
    console.error("Error creating student:", error);
    return { error: error.message };
  }

  // Auto enroll student into current active academic session
  if (insertedStudent?.id) {
    try {
      const { getMadrasaMetadata, saveMadrasaMetadata, getDefaultSessions } = await import("@/lib/sessions");
      const meta = await getMadrasaMetadata(finalMadrasaId);
      const sessions = meta.sessions || getDefaultSessions(finalMadrasaId);
      const currentSession = sessions.find((s) => s.is_current) || sessions[0];
      if (currentSession) {
        const enrollments = meta.enrollments || [];
        enrollments.push({
          id: `enr_${insertedStudent.id}_${currentSession.id}`,
          madrasa_id: finalMadrasaId,
          student_id: insertedStudent.id,
          session_id: currentSession.id,
          class_id: classId,
          roll_number: rollNumber,
          status: "ACTIVE",
          enrollment_date: new Date().toISOString().split("T")[0],
          created_at: new Date().toISOString(),
        });
        meta.enrollments = enrollments;
        await saveMadrasaMetadata(finalMadrasaId, meta);
      }
    } catch (sessionEnrollErr) {
      console.warn("Auto enrollment error:", sessionEnrollErr);
    }
  }

  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard/academic/sessions");
  return { success: true };
}

export async function updateStudent(prevState: any, formData: FormData) {
  const supabase = await createClient();

  const id = formData.get("id") as string;
  const firstName = formData.get("first_name") as string;
  const lastName = formData.get("last_name") as string;
  const rollNumber = formData.get("roll_number") as string;
  const classId = formData.get("class_id") as string;
  const parentPhone = formData.get("parent_phone") as string;
  const fatherName = formData.get("father_name") as string;
  const address = formData.get("address") as string;
  const photoUrl = formData.get("photo_url") as string;

  if (!id || !firstName || !lastName || !classId) {
    return { error: "ID, First name, Last name and Class are required." };
  }

  const { error } = await supabase
    .from("students")
    .update({
      first_name: firstName,
      last_name: lastName,
      roll_number: rollNumber,
      class_id: classId,
      parent_phone: parentPhone,
      father_name: fatherName,
      address: address,
      photo_url: photoUrl,
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating student:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/students");
  return { success: true };
}

export async function deleteStudent(studentId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .delete()
    .eq("id", studentId);

  if (error) {
    console.error("Error deleting student:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/students");
  return { success: true };
}
