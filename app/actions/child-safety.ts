"use server";

import { revalidatePath } from "next/cache";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { toDhakaDateString } from "@/lib/date-utils";
import {
  AuthorizedPickupPerson,
  KidsHealthProfile,
  StudentGatePassRecord,
} from "@/lib/child-safety-utils";

export async function getStudentSafetyAndHealth(studentId: string): Promise<{
  authorizedPickups: AuthorizedPickupPerson[];
  healthProfile: KidsHealthProfile;
}> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

  const defaultHealth: KidsHealthProfile = {
    foodAllergies: [],
    chronicConditions: [],
    regularMedications: "",
    emergencyDoctorPhone: "",
    dietaryRestrictions: "",
  };

  if (!madrasaId) {
    return { authorizedPickups: [], healthProfile: defaultHealth };
  }

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    const pickups: AuthorizedPickupPerson[] =
      (meta as any)?.authorized_pickups?.[studentId] || [];
    const health: KidsHealthProfile =
      (meta as any)?.kids_health_profiles?.[studentId] || defaultHealth;

    return {
      authorizedPickups: pickups,
      healthProfile: health,
    };
  } catch (err) {
    console.error("getStudentSafetyAndHealth error:", err);
    return { authorizedPickups: [], healthProfile: defaultHealth };
  }
}

export async function saveStudentHealthProfile(
  studentId: string,
  health: KidsHealthProfile
): Promise<{ success: boolean; data?: KidsHealthProfile; error?: string }> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { success: false, error: "অননুমোদিত অ্যাক্সেস" };

  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) return { success: false, error: "মাদ্রাসা পাওয়া যায়নি" };

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    if (!(meta as any).kids_health_profiles) {
      (meta as any).kids_health_profiles = {};
    }

    const payload: KidsHealthProfile = {
      ...health,
      lastUpdated: new Date().toISOString(),
    };

    (meta as any).kids_health_profiles[studentId] = payload;

    // Also update student medical_notes in metadata if present
    if (health.foodAllergies?.length > 0 || health.chronicConditions?.length > 0) {
      const summary = `অ্যালার্জি: ${health.foodAllergies.join(", ")} | সতর্কতা: ${health.chronicConditions.join(", ")}`;
      if ((meta as any).student_profiles?.[studentId]) {
        (meta as any).student_profiles[studentId].medical_notes = summary;
      }
    }

    await saveMadrasaMetadata(madrasaId, meta);
    revalidatePath(`/dashboard/students/${studentId}`);
    return { success: true, data: payload };
  } catch (err: any) {
    console.error("saveStudentHealthProfile error:", err);
    return { success: false, error: err?.message || "সংরক্ষণ করা যায়নি" };
  }
}

export async function saveAuthorizedPickups(
  studentId: string,
  pickups: AuthorizedPickupPerson[]
): Promise<{ success: boolean; data?: AuthorizedPickupPerson[]; error?: string }> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { success: false, error: "অননুমোদিত অ্যাক্সেস" };

  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) return { success: false, error: "মাদ্রাসা পাওয়া যায়নি" };

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    if (!(meta as any).authorized_pickups) {
      (meta as any).authorized_pickups = {};
    }

    (meta as any).authorized_pickups[studentId] = pickups;
    await saveMadrasaMetadata(madrasaId, meta);
    revalidatePath(`/dashboard/students/${studentId}`);
    return { success: true, data: pickups };
  } catch (err: any) {
    console.error("saveAuthorizedPickups error:", err);
    return { success: false, error: err?.message || "সংরক্ষণ করা যায়নি" };
  }
}

export async function generateDailyGatePass(data: {
  studentId: string;
  studentName: string;
  studentRoll?: string;
  className: string;
  pickupPerson: {
    name: string;
    relation: string;
    phone: string;
    photoUrl?: string;
  };
  notes?: string;
}): Promise<{ success: boolean; data?: StudentGatePassRecord; error?: string }> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { success: false, error: "অননুমোদিত অ্যাক্সেস" };

  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) return { success: false, error: "মাদ্রাসা পাওয়া যায়নি" };

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    if (!(meta as any).gate_passes) {
      (meta as any).gate_passes = [];
    }

    const today = toDhakaDateString();
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const passCode = `GP-${randomCode}`;

    const newPass: StudentGatePassRecord = {
      id: `pass-${Date.now()}`,
      studentId: data.studentId,
      studentName: data.studentName,
      studentRoll: data.studentRoll,
      className: data.className,
      date: today,
      passCode,
      pickupPersonName: data.pickupPerson.name,
      pickupPersonRelation: data.pickupPerson.relation,
      pickupPersonPhone: data.pickupPerson.phone,
      pickupPersonPhoto: data.pickupPerson.photoUrl,
      status: "WAITING",
      notes: data.notes,
    };

    (meta as any).gate_passes.unshift(newPass);
    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath(`/dashboard/students/${data.studentId}`);
    revalidatePath("/dashboard/students");
    return { success: true, data: newPass };
  } catch (err: any) {
    console.error("generateDailyGatePass error:", err);
    return { success: false, error: err?.message || "গেট পাস তৈরি করা যায়নি" };
  }
}

export async function verifyAndCheckoutGatePass(
  passCode: string,
  teacherName: string = "গেটে কর্তব্যরত উস্তাদ"
): Promise<{ success: boolean; pass?: StudentGatePassRecord; error?: string }> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { success: false, error: "অননুমোদিত অ্যাক্সেস" };

  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) return { success: false, error: "মাদ্রাসা পাওয়া যায়নি" };

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    const passes: StudentGatePassRecord[] = (meta as any).gate_passes || [];

    const index = passes.findIndex(
      (p) => p.passCode.toUpperCase() === passCode.trim().toUpperCase()
    );

    if (index === -1) {
      return { success: false, error: "কোনো বৈধ গেট পাস পাওয়া যায়নি।" };
    }

    const pass = passes[index];
    if (pass.status === "PICKED_UP") {
      return {
        success: false,
        error: `এই পাসটি ইতোমধ্যে ব্যবহার করা হয়েছে (${pass.pickedUpAt}-এ)।`,
      };
    }

    const nowTime = new Date().toLocaleTimeString("bn-BD", {
      hour: "2-digit",
      minute: "2-digit",
    });

    pass.status = "PICKED_UP";
    pass.pickedUpAt = nowTime;
    pass.verifiedByTeacher = teacherName;

    passes[index] = pass;
    (meta as any).gate_passes = passes;

    await saveMadrasaMetadata(madrasaId, meta);
    return { success: true, pass };
  } catch (err: any) {
    console.error("verifyAndCheckoutGatePass error:", err);
    return { success: false, error: err?.message || "যাচাই সম্পন্ন করা যায়নি" };
  }
}

export async function getTodayGatePasses(): Promise<StudentGatePassRecord[]> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;
  if (!madrasaId) return [];

  try {
    const meta = await getMadrasaMetadata(madrasaId);
    const passes: StudentGatePassRecord[] = (meta as any).gate_passes || [];
    const today = toDhakaDateString();
    return passes.filter((p) => p.date === today);
  } catch (err) {
    console.error("getTodayGatePasses error:", err);
    return [];
  }
}
