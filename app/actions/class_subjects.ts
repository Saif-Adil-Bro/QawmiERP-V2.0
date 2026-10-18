"use server";

import { writeGuard } from "@/lib/action-authorization";
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
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  // P2-Fix: function-scope — try-ব্লকের by-ID tenant guard-ও __authz.madrasaId ব্যবহার করবে
  const __authz = await writeGuard("classes");
  if (!__authz.allowed) return __authz.fallback;

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
      // P2-Fix: first-madrasa fallback সরানো — tenant resolve না হলে fail-closed
      return { error: "মাদরাসা পাওয়া যায়নি।" };
    }

    // P2-Fix: cross-tenant guard — classId অন্য মাদ্রাসার হলে সেখানে row insert করা যাবে না
    if (clsData?.madrasa_id && clsData.madrasa_id !== __authz.madrasaId) {
      return { error: "জামাত খুঁজে পাওয়া যায়নি।" };
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

    let insertRes = await adminClient
      .from("class_subjects")
      .insert(insertPayload)
      .select("*, subjects(*)")
      .single();

    // If madrasa_id column doesn't exist on class_subjects, retry without it
    if (insertRes.error && (insertRes.error.message?.includes("madrasa_id") || insertRes.error.code === "42703")) {
      insertRes = await adminClient
        .from("class_subjects")
        .insert({
          class_id: classId,
          subject_id: subjectId,
        })
        .select("*, subjects(*)")
        .single();
    }

    if (insertRes.error) {
      console.error("Error assigning subject to class:", insertRes.error);
      if (insertRes.error.code === "23505") {
        return { error: "এই বিষয়টি ইতিমধ্যেই এই জামাতে বরাদ্দ করা হয়েছে।" };
      }
      return { error: insertRes.error.message || "বিষয় বরাদ্দ করতে সমস্যা হয়েছে।" };
    }

    revalidatePath(`/dashboard/classes/${classId}/subjects`);
    revalidatePath("/dashboard/classes");
    return { success: true, item: insertRes.data };
  } catch (err: any) {
    console.error("Exception in assignSubjectToClass:", err);
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}

export async function removeSubjectFromClass(classSubjectId: string, classId: string, subjectId?: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  // P2-Fix: function-scope — try-ব্লকের by-ID tenant guard-ও __authz.madrasaId ব্যবহার করবে
  const __authz = await writeGuard("classes");
  if (!__authz.allowed) return __authz.fallback;

  try {
    const adminClient = await createAdminClient();

    // P2-Fix: cross-tenant guard — by-ID/by-class ডিলিটের আগে জামাতটিই নিজের মাদ্রাসার কিনা যাচাই
    const { data: clsRow, error: clsErr } = await adminClient
      .from("classes")
      .select("id, madrasa_id")
      .eq("id", classId)
      .maybeSingle();
    if (clsErr || !clsRow) return { error: "জামাত খুঁজে পাওয়া যায়নি।" };
    if (clsRow.madrasa_id && clsRow.madrasa_id !== __authz.madrasaId) {
      return { error: "অন্য মাদ্রাসার বিষয় ডিলিট করা যাবে না।" };
    }

    const isUuid = Boolean(classSubjectId) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classSubjectId);
    
    let error: any = null;

    if (isUuid) {
      const res = await adminClient
        .from("class_subjects")
        .delete()
        .eq("id", classSubjectId)
        .eq("class_id", classId); // P2-Fix: verified class-এর scope-এই ডিলিট
      error = res.error;
    }

    // Fallback: if not UUID or delete by ID had an error, delete by class_id + subject_id
    if (!isUuid || (error && subjectId)) {
      if (subjectId) {
        const fallbackRes = await adminClient
          .from("class_subjects")
          .delete()
          .eq("class_id", classId)
          .eq("subject_id", subjectId);
        error = fallbackRes.error;
      }
    }

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
