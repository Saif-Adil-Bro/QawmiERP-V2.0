"use server";

import { revalidatePath } from "next/cache";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";
import { encodeRoutineMeta, RoutineItemType } from "@/lib/routine-helper";

export async function addRoutine(formData: FormData) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুগ্রহ করে লগইন করুন।" };

    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি।" };

    const class_id = formData.get("class_id") as string;
    const routine_type = (formData.get("routine_type") as string) || "Class";
    const day_of_week = formData.get("day_of_week") as string;
    const start_time = formData.get("start_time") as string;
    const end_time = formData.get("end_time") as string;
    const item_type = (formData.get("item_type") as RoutineItemType) || "SUBJECT";
    const subject_id = (formData.get("subject_id") as string) || null;
    const teacher_id = (formData.get("teacher_id") as string) || null;
    const custom_title = (formData.get("custom_title") as string) || "";
    const raw_room = (formData.get("room_number") as string) || "";

    if (!class_id) {
      return { error: "জামাত নির্বাচন করুন।" };
    }
    if (!day_of_week) {
      return { error: "বার নির্বাচন করুন।" };
    }
    if (item_type !== "OFFDAY" && (!start_time || !end_time)) {
      return { error: "শুরুর সময় এবং শেষের সময় দেওয়া আবশ্যক।" };
    }

    const encodedRoom = encodeRoutineMeta(item_type, custom_title, raw_room);

    const insertPayload = {
      madrasa_id: finalMadrasaId,
      class_id,
      subject_id: item_type === "SUBJECT" ? (subject_id || null) : null,
      teacher_id: item_type === "SUBJECT" ? (teacher_id || null) : null,
      day_of_week,
      start_time: item_type === "OFFDAY" ? "00:00:00" : (start_time.length === 5 ? `${start_time}:00` : start_time),
      end_time: item_type === "OFFDAY" ? "23:59:59" : (end_time.length === 5 ? `${end_time}:00` : end_time),
      room_number: encodedRoom,
      routine_type: item_type === "OFFDAY" ? "OffDay" : routine_type,
    };

    const { error } = await supabase.from("routines").insert(insertPayload);

    if (error) {
      console.error("Error inserting routine:", error);
      return { error: error.message || "রুটিন সংরক্ষণ করতে সমস্যা হয়েছে।" };
    }

    revalidatePath("/dashboard/academic/routine");
    revalidatePath("/dashboard/academic/routine/builder");
    revalidatePath("/portal/routine");
    revalidatePath("/teacher-portal/routine");
    return { success: true };
  } catch (err: any) {
    console.error("Exception in addRoutine:", err);
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}

export async function updateRoutine(formData: FormData) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুগ্রহ করে লগইন করুন।" };

    const routine_id = formData.get("id") as string;
    if (!routine_id) return { error: "রুটিন আইডি পাওয়া যায়নি।" };

    const routine_type = (formData.get("routine_type") as string) || "Class";
    const day_of_week = formData.get("day_of_week") as string;
    const start_time = formData.get("start_time") as string;
    const end_time = formData.get("end_time") as string;
    const item_type = (formData.get("item_type") as RoutineItemType) || "SUBJECT";
    const subject_id = (formData.get("subject_id") as string) || null;
    const teacher_id = (formData.get("teacher_id") as string) || null;
    const custom_title = (formData.get("custom_title") as string) || "";
    const raw_room = (formData.get("room_number") as string) || "";

    const encodedRoom = encodeRoutineMeta(item_type, custom_title, raw_room);

    const updatePayload = {
      subject_id: item_type === "SUBJECT" ? (subject_id || null) : null,
      teacher_id: item_type === "SUBJECT" ? (teacher_id || null) : null,
      day_of_week,
      start_time: item_type === "OFFDAY" ? "00:00:00" : (start_time.length === 5 ? `${start_time}:00` : start_time),
      end_time: item_type === "OFFDAY" ? "23:59:59" : (end_time.length === 5 ? `${end_time}:00` : end_time),
      room_number: encodedRoom,
      routine_type: item_type === "OFFDAY" ? "OffDay" : routine_type,
    };

    const { error } = await supabase
      .from("routines")
      .update(updatePayload)
      .eq("id", routine_id);

    if (error) {
      console.error("Error updating routine:", error);
      return { error: error.message || "রুটিন আপডেট করতে সমস্যা হয়েছে।" };
    }

    revalidatePath("/dashboard/academic/routine");
    revalidatePath("/dashboard/academic/routine/builder");
    revalidatePath("/portal/routine");
    revalidatePath("/teacher-portal/routine");
    return { success: true };
  } catch (err: any) {
    console.error("Exception in updateRoutine:", err);
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}

export async function deleteRoutine(id: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("routines").delete().eq("id", id);

    if (error) {
      console.error("Error deleting routine:", error);
      return { error: error.message || "রুটিন মুছতে সমস্যা হয়েছে।" };
    }

    revalidatePath("/dashboard/academic/routine");
    revalidatePath("/dashboard/academic/routine/builder");
    revalidatePath("/portal/routine");
    revalidatePath("/teacher-portal/routine");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}

export async function deleteRoutineAction(formData: FormData) {
  const id = formData.get("id") as string;
  if (id) {
    await deleteRoutine(id);
  }
}

export async function copyDayRoutine(params: {
  class_id: string;
  routine_type: string;
  from_day: string;
  to_days: string[];
  overwrite?: boolean;
}) {
  try {
    const { class_id, routine_type, from_day, to_days, overwrite = true } = params;
    if (!class_id || !from_day || !to_days || to_days.length === 0) {
      return { error: "সঠিক দিন ও জামাত নির্বাচন করুন।" };
    }

    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদরাসা পাওয়া যায়নি।" };

    // 1. Fetch source day routines
    const { data: sourceRoutines, error: srcErr } = await supabase
      .from("routines")
      .select("*")
      .eq("class_id", class_id)
      .eq("routine_type", routine_type)
      .eq("day_of_week", from_day)
      .order("start_time", { ascending: true });

    if (srcErr || !sourceRoutines || sourceRoutines.length === 0) {
      return { error: `"${from_day}" বারে কপি করার মতো কোনো রুটিন পাওয়া যায়নি।` };
    }

    // 2. If overwrite is true, delete existing routines for target days
    if (overwrite) {
      for (const targetDay of to_days) {
        if (targetDay !== from_day) {
          await supabase
            .from("routines")
            .delete()
            .eq("class_id", class_id)
            .eq("routine_type", routine_type)
            .eq("day_of_week", targetDay);
        }
      }
    }

    // 3. Prepare bulk insert list
    const newItems: any[] = [];
    for (const targetDay of to_days) {
      if (targetDay === from_day) continue; // Skip same day
      for (const item of sourceRoutines) {
        newItems.push({
          madrasa_id: finalMadrasaId,
          class_id: item.class_id,
          subject_id: item.subject_id,
          teacher_id: item.teacher_id,
          day_of_week: targetDay,
          start_time: item.start_time,
          end_time: item.end_time,
          room_number: item.room_number,
          routine_type: item.routine_type,
        });
      }
    }

    if (newItems.length > 0) {
      const { error: insErr } = await supabase.from("routines").insert(newItems);
      if (insErr) {
        console.error("Error bulk inserting routines:", insErr);
        return { error: insErr.message || "রুটিন কপি করতে সমস্যা হয়েছে।" };
      }
    }

    revalidatePath("/dashboard/academic/routine");
    revalidatePath("/dashboard/academic/routine/builder");
    revalidatePath("/portal/routine");
    revalidatePath("/teacher-portal/routine");
    return { success: true, count: newItems.length };
  } catch (err: any) {
    console.error("Exception in copyDayRoutine:", err);
    return { error: err.message || "সার্ভার এরর হয়েছে।" };
  }
}

export async function clearDayRoutines(params: {
  class_id: string;
  routine_type: string;
  day_of_week: string;
}) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("routines")
      .delete()
      .eq("class_id", params.class_id)
      .eq("routine_type", params.routine_type)
      .eq("day_of_week", params.day_of_week);

    if (error) {
      return { error: error.message || "দিনের রুটিন ক্লিয়ার করতে সমস্যা হয়েছে।" };
    }

    revalidatePath("/dashboard/academic/routine");
    revalidatePath("/dashboard/academic/routine/builder");
    revalidatePath("/portal/routine");
    revalidatePath("/teacher-portal/routine");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "সার্ভার এরর।" };
  }
}
