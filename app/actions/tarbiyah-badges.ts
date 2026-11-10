"use server";

import { revalidatePath } from "next/cache";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { toDhakaDateString } from "@/lib/date-utils";
import {
  TARBIYAH_BADGES,
  StudentBadgeAward,
} from "@/lib/tarbiyah-badges";

export async function getStudentBadges(studentId: string): Promise<StudentBadgeAward[]> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;
  if (!madrasaId) return [];

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    const awards: StudentBadgeAward[] = (meta as any).tarbiyah_awards || [];
    return awards.filter((a) => a.studentId === studentId);
  } catch (err) {
    console.error("getStudentBadges error:", err);
    return [];
  }
}

export async function awardStudentBadge(data: {
  studentId: string;
  studentName: string;
  className: string;
  badgeId: string;
  teacherName?: string;
  notes?: string;
}): Promise<{ success: boolean; data?: StudentBadgeAward; error?: string }> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { success: false, error: "অননুমোদিত অ্যাক্সেস" };

  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) return { success: false, error: "মাদ্রাসা পাওয়া যায়নি" };

  const badgeObj = TARBIYAH_BADGES.find((b) => b.id === data.badgeId);
  if (!badgeObj) return { success: false, error: "ব্যাজ পাওয়া যায়নি" };

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    if (!(meta as any).tarbiyah_awards) {
      (meta as any).tarbiyah_awards = [];
    }

    const newAward: StudentBadgeAward = {
      id: `awd-${Date.now()}`,
      studentId: data.studentId,
      studentName: data.studentName,
      className: data.className,
      badgeId: badgeObj.id,
      badgeName: badgeObj.name,
      badgeIcon: badgeObj.icon,
      starPoints: badgeObj.starPoints,
      awardedDate: toDhakaDateString(),
      teacherName: data.teacherName || "উস্তাদ",
      notes: data.notes,
    };

    (meta as any).tarbiyah_awards.unshift(newAward);
    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath(`/dashboard/academic/amal-tracker`);
    revalidatePath(`/dashboard/students/${data.studentId}`);
    return { success: true, data: newAward };
  } catch (err: any) {
    console.error("awardStudentBadge error:", err);
    return { success: false, error: err?.message || "ব্যাজ প্রদান করা যায়নি" };
  }
}

export async function getAllTarbiyahAwards(): Promise<StudentBadgeAward[]> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;
  if (!madrasaId) return [];

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    return (meta as any).tarbiyah_awards || [];
  } catch (err) {
    console.error("getAllTarbiyahAwards error:", err);
    return [];
  }
}

export async function getTopMuminStudents(limit: number = 5): Promise<
  Array<{
    studentId: string;
    studentName: string;
    className: string;
    totalStars: number;
    badgeCount: number;
  }>
> {
  const awards = await getAllTarbiyahAwards();
  const studentMap: Record<
    string,
    { studentId: string; studentName: string; className: string; totalStars: number; badgeCount: number }
  > = {};

  for (const awd of awards) {
    if (!studentMap[awd.studentId]) {
      studentMap[awd.studentId] = {
        studentId: awd.studentId,
        studentName: awd.studentName,
        className: awd.className,
        totalStars: 0,
        badgeCount: 0,
      };
    }
    studentMap[awd.studentId].totalStars += awd.starPoints;
    studentMap[awd.studentId].badgeCount += 1;
  }

  return Object.values(studentMap)
    .sort((a, b) => b.totalStars - a.totalStars)
    .slice(0, limit);
}
