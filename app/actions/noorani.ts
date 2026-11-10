"use server";

import { revalidatePath } from "next/cache";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import {
  NOORANI_TAKHTIS,
  MAKHRAJ_LIST,
  StudentNooraniProgress,
} from "@/lib/noorani-utils";

export async function getNooraniCurriculum() {
  return {
    takhtis: NOORANI_TAKHTIS,
    makharij: MAKHRAJ_LIST,
  };
}

export async function getStudentNooraniProgress(studentId: string): Promise<StudentNooraniProgress> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

  const defaultProgress: StudentNooraniProgress = {
    studentId,
    currentTakhtiId: 1,
    completedTakhtis: [],
    makhrajWeaknesses: [],
    evaluationStatus: "BEGINNER",
    teacherNotes: "",
    updatedAt: new Date().toISOString(),
  };

  if (!madrasaId) return defaultProgress;

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    const existing = (meta as any)?.noorani_progress?.[studentId];
    if (existing) {
      return {
        ...defaultProgress,
        ...existing,
      };
    }
  } catch (err) {
    console.error("Error reading noorani progress:", err);
  }

  return defaultProgress;
}

export async function saveStudentNooraniProgress(
  studentId: string,
  updates: Partial<StudentNooraniProgress>
): Promise<{ success: boolean; data?: StudentNooraniProgress; error?: string }> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { success: false, error: "অননুমোদিত অ্যাক্সেস" };

  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) return { success: false, error: "মাদ্রাসা পাওয়া যায়নি" };

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    const allProgress = (meta as any)?.noorani_progress || {};

    const current = allProgress[studentId] || {
      studentId,
      currentTakhtiId: 1,
      completedTakhtis: [],
      makhrajWeaknesses: [],
      evaluationStatus: "BEGINNER",
      teacherNotes: "",
    };

    const updated: StudentNooraniProgress = {
      ...current,
      ...updates,
      studentId,
      updatedAt: new Date().toISOString(),
    };

    allProgress[studentId] = updated;

    await saveMadrasaMetadata(madrasaId, {
      ...meta,
      noorani_progress: allProgress,
    });

    revalidatePath(`/dashboard/hifz/${studentId}`);
    revalidatePath("/dashboard/hifz");
    revalidatePath("/teacher-portal/hifz");
    return { success: true, data: updated };
  } catch (err: any) {
    console.error("Error saving noorani progress:", err);
    return { success: false, error: err?.message || "সংরক্ষণ করা যায়নি" };
  }
}

export async function getAllNooraniProgressMap(): Promise<Record<string, StudentNooraniProgress>> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;
  if (!madrasaId) return {};

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    return (meta as any)?.noorani_progress || {};
  } catch (err) {
    console.error("Error fetching all noorani progress:", err);
    return {};
  }
}
