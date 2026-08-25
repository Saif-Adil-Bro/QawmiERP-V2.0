"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getClassSubjects(classId: string) {
  try {
    const adminClient = await createAdminClient();
    const { data, error } = await adminClient
      .from("class_subjects")
      .select("*, subjects(*)")
      .eq("class_id", classId);

    if (error) {
      console.error("Error fetching class subjects with admin client:", error);
      const supabase = await createClient();
      const { data: userFetchData } = await supabase
        .from("class_subjects")
        .select("*, subjects(*)")
        .eq("class_id", classId);
      return userFetchData || [];
    }
    return data || [];
  } catch (err) {
    console.error("Exception in getClassSubjects:", err);
    return [];
  }
}

export async function assignSubjectToClass(classId: string, subjectId: string) {
  try {
    const adminClient = await createAdminClient();

    // 1. Get class details to get accurate madrasa_id
    const { data: clsData } = await adminClient
      .from("classes")
      .select("madrasa_id")
      .eq("id", classId)
      .single();

    let madrasaId = clsData?.madrasa_id;

    if (!madrasaId) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { getAuthMadrasaId } = await import("./students");
        madrasaId = await getAuthMadrasaId(supabase, user);
      }
    }

    if (!madrasaId) {
      const { data: anyMadrasa } = await adminClient
        .from("madrasas")
        .select("id")
        .limit(1)
        .single();
      madrasaId = anyMadrasa?.id;
    }

    // 2. Check if already assigned
    const { data: existing } = await adminClient
      .from("class_subjects")
      .select("id")
      .eq("class_id", classId)
      .eq("subject_id", subjectId)
      .maybeSingle();

    if (existing) {
      return { error: "এই বিষয়টি ইতিমধ্যেই এই জামাতে বরাদ্দ করা হয়েছে।" };
    }

    // 3. Try insert with madrasa_id
    const insertPayload: any = {
      class_id: classId,
      subject_id: subjectId,
    };
    if (madrasaId) {
      insertPayload.madrasa_id = madrasaId;
    }

    let { error } = await adminClient.from("class_subjects").insert(insertPayload);

    // If madrasa_id column doesn't exist on class_subjects, retry without it
    if (error && (error.message?.includes("madrasa_id") || error.code === "42703")) {
      const retryRes = await adminClient.from("class_subjects").insert({
        class_id: classId,
        subject_id: subjectId,
      });
      error = retryRes.error;
    }

    if (error) {
      console.error("Error assigning subject to class:", error);
      if (error.code === "23505") {
        return { error: "এই বিষয়টি ইতিমধ্যেই এই জামাতে বরাদ্দ করা হয়েছে।" };
      }
      return { error: error.message || "বিষয় বরাদ্দ করতে সমস্যা হয়েছে।" };
    }

    revalidatePath(`/dashboard/classes/${classId}/subjects`);
    revalidatePath("/dashboard/classes");
    return { success: true };
  } catch (err: any) {
    console.error("Exception in assignSubjectToClass:", err);
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}

export async function removeSubjectFromClass(classSubjectId: string, classId: string) {
  try {
    const adminClient = await createAdminClient();
    
    const { error } = await adminClient
      .from("class_subjects")
      .delete()
      .eq("id", classSubjectId);

    if (error) {
      console.error("Error removing class subject:", error);
      return { error: error.message || "বিষয় ডিলিট করতে সমস্যা হয়েছে।" };
    }

    revalidatePath(`/dashboard/classes/${classId}/subjects`);
    revalidatePath("/dashboard/classes");
    return { success: true };
  } catch (err: any) {
    console.error("Exception in removeSubjectFromClass:", err);
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}
