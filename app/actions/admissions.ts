"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId, getClasses, getNextClassRoll } from "@/app/actions/students";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import {
  AdmissionApplication,
  generateApplicationNumber,
  generateExamRollNumber,
  getDefaultAdmissionsSeed,
  DEFAULT_EXAM_INSTRUCTIONS,
  normalizePhoneNumber,
} from "@/lib/admissions";
import { revalidatePath } from "next/cache";

/**
 * Fetch all admission applications with optional filters
 */
export async function getAdmissionApplications(filters?: {
  class_id?: string;
  status?: string;
  search?: string;
  session?: string;
  includeArchived?: boolean;
}) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);

    const meta = await getMadrasaMetadata(madrasaId);
    let list: AdmissionApplication[] = meta.admissions || [];

    if (!list || list.length === 0) {
      list = getDefaultAdmissionsSeed(madrasaId);
      meta.admissions = list;
      await saveMadrasaMetadata(madrasaId, meta);
    }

    if (!filters?.includeArchived) {
      list = list.filter((item) => !item.is_archived);
    }

    if (filters?.class_id && filters.class_id !== "all") {
      list = list.filter((item) => item.target_class_id === filters.class_id);
    }

    if (filters?.status && filters.status !== "all") {
      list = list.filter((item) => item.status === filters.status);
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.applicant_name_bn.toLowerCase().includes(q) ||
          item.applicant_name_en.toLowerCase().includes(q) ||
          item.application_no.toLowerCase().includes(q) ||
          item.roll_number.toLowerCase().includes(q) ||
          item.guardian_phone.includes(q) ||
          item.father_name.toLowerCase().includes(q)
      );
    }

    return list.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } catch (err) {
    console.error("Error in getAdmissionApplications:", err);
    return [];
  }
}

/**
 * Get single admission by ID or Application Number
 */
export async function getAdmissionById(identifier: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const adminClient = await createAdminClient();

    let madrasaId: string | null = null;
    if (user) {
      madrasaId = await getAuthMadrasaId(supabase, user);
    }
    if (!madrasaId) {
      const { data: firstMadrasa } = await adminClient
        .from("madrasas")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
      madrasaId = firstMadrasa?.id || "default_madrasa_id";
    }

    const safeMadrasaId = madrasaId || "default_madrasa_id";
    const meta = await getMadrasaMetadata(safeMadrasaId);
    const list: AdmissionApplication[] = meta.admissions || getDefaultAdmissionsSeed(safeMadrasaId);

    const found = list.find(
      (item) =>
        item.id === identifier ||
        item.application_no === identifier ||
        item.roll_number === identifier
    );

    if (found) return found;

    // Fallback search in all madrasas in case multiple exist
    const { data: allMadrasas } = await adminClient.from("madrasas").select("id");
    if (allMadrasas) {
      for (const m of allMadrasas) {
        if (m.id !== madrasaId) {
          const mMeta = await getMadrasaMetadata(m.id);
          const mList: AdmissionApplication[] = mMeta.admissions || [];
          const mFound = mList.find(
            (it) =>
              it.id === identifier ||
              it.application_no === identifier ||
              it.roll_number === identifier
          );
          if (mFound) return mFound;
        }
      }
    }

    return null;
  } catch (err) {
    console.error("Error fetching admission by ID:", err);
    return null;
  }
}

/**
 * Public search for applicant status and admit card
 */
export async function searchAdmissionPublic(query: string) {
  try {
    const adminClient = await createAdminClient();
    const { data: firstMadrasa } = await adminClient
      .from("madrasas")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    const madrasaId = firstMadrasa?.id || "default_madrasa_id";
    const meta = await getMadrasaMetadata(madrasaId);
    const list: AdmissionApplication[] = meta.admissions || getDefaultAdmissionsSeed(madrasaId);

    const q = query.trim().toLowerCase();
    const normalizedQPhone = normalizePhoneNumber(q);

    const results = list.filter((item) => {
      const appNo = (item.application_no || "").toLowerCase();
      const rollNo = (item.roll_number || "").toLowerCase();
      const rawPhone = item.guardian_phone || "";
      const normItemPhone = normalizePhoneNumber(rawPhone);
      const nameBn = (item.applicant_name_bn || "").toLowerCase();

      return (
        appNo === q ||
        rollNo === q ||
        (normalizedQPhone && normItemPhone.includes(normalizedQPhone)) ||
        rawPhone.trim() === q ||
        (q.length >= 3 && nameBn.includes(q))
      );
    });

    return results;
  } catch (err) {
    console.error("Error in searchAdmissionPublic:", err);
    return [];
  }
}

/**
 * Submit online admission (Public & Dashboard)
 */
export async function submitAdmissionApplication(formData: {
  applicant_name_bn: string;
  applicant_name_en?: string;
  date_of_birth: string;
  gender: "MALE" | "FEMALE";
  blood_group?: string;
  birth_reg_no?: string;
  photo_url?: string;
  father_name: string;
  father_occupation?: string;
  mother_name?: string;
  guardian_name: string;
  guardian_relation: string;
  guardian_phone: string;
  emergency_phone?: string;
  email?: string;
  present_address: string;
  permanent_address?: string;
  target_class_id: string;
  target_class_name: string;
  residential_status: "আবাসিক" | "অনাবাসিক" | "ডে-কেয়ার";
  previous_institution?: string;
  previous_class_or_para?: string;
  department_category?: "hifz" | "kitab" | "general";
  hifz_para_memorized?: string;
  hifz_tajweed_quality?: string;
  kitab_previous_kitab?: string;
  kitab_previous_grade?: string;
  session_name?: string;
  academic_year?: string;
  status?: "PENDING" | "ADMIT_ISSUED";
  exam_date?: string;
  exam_time?: string;
  venue?: string;
  room_no?: string;
}) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const adminClient = await createAdminClient();

    let madrasaId: string | null = null;
    if (user) {
      madrasaId = await getAuthMadrasaId(supabase, user);
    }
    if (!madrasaId) {
      const { data: firstMadrasa } = await adminClient
        .from("madrasas")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
      madrasaId = firstMadrasa?.id || "default_madrasa_id";
    }

    const safeMadrasaId = madrasaId || "default_madrasa_id";
    const meta = await getMadrasaMetadata(safeMadrasaId);
    const currentList: AdmissionApplication[] = meta.admissions || getDefaultAdmissionsSeed(safeMadrasaId);

    const seq = currentList.length + 1;
    const year = 2026;
    const application_no = generateApplicationNumber(seq, year);
    const roll_number = generateExamRollNumber(seq);
    const now = new Date().toISOString();

    const applicationStatus = formData.status || "PENDING";
    const hasExamSchedule = applicationStatus === "ADMIT_ISSUED" || Boolean(formData.exam_date);

    const newApplication: AdmissionApplication = {
      id: `adm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      madrasa_id: safeMadrasaId,
      application_no,
      roll_number,
      session_name: formData.session_name || "১৪৪৭-৪৮ হিজরি (২০২৬-২৭)",
      academic_year: formData.academic_year || "২০২৬-২৭",
      applicant_name_bn: formData.applicant_name_bn.trim(),
      applicant_name_en: formData.applicant_name_en?.trim() || formData.applicant_name_bn.trim(),
      date_of_birth: formData.date_of_birth,
      gender: formData.gender || "MALE",
      blood_group: formData.blood_group || "",
      birth_reg_no: formData.birth_reg_no || "",
      photo_url: formData.photo_url || "",
      father_name: formData.father_name.trim(),
      father_occupation: formData.father_occupation || "",
      mother_name: formData.mother_name || "",
      guardian_name: formData.guardian_name.trim() || formData.father_name.trim(),
      guardian_relation: formData.guardian_relation || "পিতা",
      guardian_phone: formData.guardian_phone.trim(),
      emergency_phone: formData.emergency_phone || "",
      email: formData.email || "",
      present_address: formData.present_address.trim(),
      permanent_address: formData.permanent_address?.trim() || formData.present_address.trim(),
      target_class_id: formData.target_class_id,
      target_class_name: formData.target_class_name,
      residential_status: formData.residential_status || "আবাসিক",
      previous_institution: formData.previous_institution || "",
      previous_class_or_para: formData.previous_class_or_para || "",
      department_category: formData.department_category || "general",
      hifz_para_memorized: formData.hifz_para_memorized || "",
      hifz_tajweed_quality: formData.hifz_tajweed_quality || "",
      kitab_previous_kitab: formData.kitab_previous_kitab || "",
      kitab_previous_grade: formData.kitab_previous_grade || "",
      status: applicationStatus,
      exam_schedule: hasExamSchedule
        ? {
            exam_date: formData.exam_date || "২০২৬-০৫-১৫",
            exam_time: formData.exam_time || "সকাল ০৯:৩০ ঘটিকা",
            venue: formData.venue || "মাদরাসা কেন্দ্রীয় ক্যাম্পাস ও অডিটোরিয়াম",
            room_no: formData.room_no || "১০১ (একাডেমিক ভবন)",
            reporting_time: "পরীক্ষা শুরুর ৩০ মিনিট পূর্বে",
            instructions: DEFAULT_EXAM_INSTRUCTIONS,
          }
        : undefined,
      created_at: now,
      updated_at: now,
    };

    meta.admissions = [newApplication, ...currentList];
    const saved = await saveMadrasaMetadata(safeMadrasaId, meta);

    if (!saved) {
      return { error: "তথ্য সংরক্ষণ করা যায়নি, পুনরায় চেষ্টা করুন।" };
    }

    revalidatePath("/dashboard/admissions");
    revalidatePath("/admission");

    return {
      success: true,
      application: newApplication,
      application_no,
      roll_number,
    };
  } catch (err: any) {
    console.error("Error creating admission:", err);
    return { error: err.message || "ভর্তি ফরম প্রক্রিয়াকরণে সমস্যা হয়েছে।" };
  }
}

/**
 * Approve application and issue Admit Card with customized exam schedule
 */
export async function approveAdmissionSchedule(
  id: string,
  schedule: {
    exam_date: string;
    exam_time: string;
    venue: string;
    room_no: string;
    instructions?: string[];
  }
) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);

    const meta = await getMadrasaMetadata(madrasaId);
    let list: AdmissionApplication[] = meta.admissions || [];

    const idx = list.findIndex((x) => x.id === id);
    if (idx === -1) {
      return { error: "আবেদন খুঁজে পাওয়া যায়নি।" };
    }

    list[idx] = {
      ...list[idx],
      status: "ADMIT_ISSUED",
      exam_schedule: {
        exam_date: schedule.exam_date || "২০২৬-০৫-১৫",
        exam_time: schedule.exam_time || "সকাল ০৯:৩০ ঘটিকা",
        venue: schedule.venue || "মাদরাসা কেন্দ্রীয় ক্যাম্পাস ও অডিটোরিয়াম",
        room_no: schedule.room_no || "১০১ (একাডেমিক ভবন)",
        reporting_time: "পরীক্ষা শুরুর ৩০ মিনিট পূর্বে",
        instructions: schedule.instructions && schedule.instructions.length > 0
          ? schedule.instructions
          : DEFAULT_EXAM_INSTRUCTIONS,
      },
      updated_at: new Date().toISOString(),
    };

    meta.admissions = list;
    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/admissions");
    revalidatePath("/admission");
    revalidatePath(`/admission/card/${id}`);

    return { success: true, application: list[idx] };
  } catch (err: any) {
    return { error: err.message || "প্রবেশপত্র অনুমোদনে ত্রুটি হয়েছে।" };
  }
}

/**
 * Update application info
 */
export async function updateAdmissionApplication(id: string, updates: Partial<AdmissionApplication>) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);

    const meta = await getMadrasaMetadata(madrasaId);
    let list: AdmissionApplication[] = meta.admissions || [];

    const idx = list.findIndex((item) => item.id === id);
    if (idx === -1) {
      return { error: "আবেদন খুঁজে পাওয়া যায়নি।" };
    }

    list[idx] = {
      ...list[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    meta.admissions = list;
    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/admissions");
    revalidatePath("/admission");
    return { success: true, application: list[idx] };
  } catch (err: any) {
    return { error: err.message };
  }
}

/**
 * Submit / Update Entry Test Evaluation
 */
export async function evaluateAdmissionTest(
  id: string,
  evaluation: {
    subjects?: Array<{
      id: string;
      name: string;
      max_marks: number;
      obtained_marks: number;
    }>;
    written_marks?: number;
    oral_marks?: number;
    quran_tilawat_marks?: number;
    total_marks?: number;
    total_max_marks?: number;
    pass_cutoff?: number;
    evaluated_by?: string;
    evaluator_designation?: string;
    remarks?: string;
  }
) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);

    const meta = await getMadrasaMetadata(madrasaId);
    let list: AdmissionApplication[] = meta.admissions || [];

    const idx = list.findIndex((item) => item.id === id);
    if (idx === -1) {
      return { error: "আবেদন খুঁজে পাওয়া যায়নি।" };
    }

    let total = 0;
    let totalMax = 100;
    let written = Number(evaluation.written_marks || 0);
    let oral = Number(evaluation.oral_marks || 0);
    let quran = Number(evaluation.quran_tilawat_marks || 0);

    if (evaluation.subjects && evaluation.subjects.length > 0) {
      total = evaluation.subjects.reduce((sum, s) => sum + Number(s.obtained_marks || 0), 0);
      totalMax = evaluation.subjects.reduce((sum, s) => sum + Number(s.max_marks || 0), 0) || 100;
      
      // Map to legacy fields for backward compatibility if names match
      const wSub = evaluation.subjects.find(s => s.name.includes("লিখিত"));
      const oSub = evaluation.subjects.find(s => s.name.includes("মৌখিক"));
      const qSub = evaluation.subjects.find(s => s.name.includes("তিলাওয়াত") || s.name.includes("হিফজ") || s.name.includes("কুরআন"));
      if (wSub) written = wSub.obtained_marks;
      if (oSub) oral = oSub.obtained_marks;
      if (qSub) quran = qSub.obtained_marks;
    } else {
      total = written + oral + quran;
      totalMax = 100;
    }

    const percentage = totalMax > 0 ? Math.round((total / totalMax) * 100) : 0;
    const cutoff = evaluation.pass_cutoff ?? 50;
    const is_passed = total >= cutoff;

    const testEval = {
      subjects: evaluation.subjects,
      written_marks: written,
      oral_marks: oral,
      quran_tilawat_marks: quran,
      total_marks: total,
      total_max_marks: totalMax,
      pass_marks: cutoff,
      percentage,
      is_passed,
      evaluated_by: evaluation.evaluated_by || "পরীক্ষক প্যানেল",
      evaluator_designation: evaluation.evaluator_designation || "নাজেমে তা'লীমাত / পরীক্ষক",
      evaluated_at: new Date().toISOString().split("T")[0],
      remarks: evaluation.remarks || (is_passed ? "উত্তীর্ণ" : "অনুপযুক্ত"),
      merit_position: list[idx].test_evaluation?.merit_position,
    };

    const newStatus = is_passed ? "MERIT_SELECTED" : "REJECTED";

    list[idx] = {
      ...list[idx],
      test_evaluation: testEval,
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    meta.admissions = list;
    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/admissions");
    revalidatePath("/admission");
    return { success: true, application: list[idx] };
  } catch (err: any) {
    return { error: err.message };
  }
}

/**
 * Auto rank students on merit list based on test scores
 */
export async function autoRankMeritList(classId?: string, passCutoff = 50) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);

    const meta = await getMadrasaMetadata(madrasaId);
    let list: AdmissionApplication[] = meta.admissions || [];

    // Filter target class or all
    const targetGroup = list.filter((item) => {
      if (item.is_archived) return false;
      if (classId && classId !== "all" && item.target_class_id !== classId) return false;
      return item.test_evaluation && item.test_evaluation.total_marks !== undefined;
    });

    // Sort descending by total marks
    targetGroup.sort((a, b) => {
      const markA = a.test_evaluation?.total_marks || 0;
      const markB = b.test_evaluation?.total_marks || 0;
      return markB - markA;
    });

    // Assign merit rank
    let rank = 1;
    for (const cand of targetGroup) {
      const idx = list.findIndex((x) => x.id === cand.id);
      if (idx !== -1 && list[idx].test_evaluation) {
        const isPassed = (list[idx].test_evaluation!.total_marks || 0) >= passCutoff;
        list[idx].test_evaluation!.merit_position = isPassed ? rank++ : undefined;
        list[idx].test_evaluation!.is_passed = isPassed;
        if (list[idx].status !== "CONFIRMED") {
          list[idx].status = isPassed ? "MERIT_SELECTED" : "WAITING_LIST";
        }
      }
    }

    meta.admissions = list;
    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/admissions");
    return { success: true, count: targetGroup.length };
  } catch (err: any) {
    return { error: err.message };
  }
}

/**
 * Confirm Admission: Automatically converts merit-selected candidate into a full permanent student!
 */
export async function confirmAdmissionToStudent(params: {
  admissionId: string;
  assignedClassId: string;
  assignedRoll?: string;
  remarks?: string;
}) {
  try {
    const adminClient = await createAdminClient();
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);

    const meta = await getMadrasaMetadata(madrasaId);
    let list: AdmissionApplication[] = meta.admissions || [];

    const adm = list.find((x) => x.id === params.admissionId);
    if (!adm) {
      return { error: "ভর্তি আবেদন রেকর্ড পাওয়া যায়নি।" };
    }

    if (adm.status === "CONFIRMED" && adm.confirmed_student_id) {
      return { error: "এই শিক্ষার্থীর ভর্তি ইতিমধ্যে নিশ্চিত করা হয়েছে।" };
    }

    // 1. Determine Target Class and Roll
    const targetClassId = params.assignedClassId || adm.target_class_id;
    let finalRoll = (params.assignedRoll || "").trim();

    if (!finalRoll) {
      const { nextRoll } = await getNextClassRoll(targetClassId);
      finalRoll = nextRoll || "1";
    }

    const { data: clsData } = await adminClient
      .from("classes")
      .select("id, name")
      .eq("id", targetClassId)
      .single();

    const className = clsData?.name || adm.target_class_name;

    // 2. Prepare names
    const names = adm.applicant_name_bn.trim().split(" ");
    const firstName = names[0] || adm.applicant_name_bn.trim();
    const lastName = names.slice(1).join(" ") || "আহমদ";

    // 3. Insert student record into students table
    const studentPayload: any = {
      madrasa_id: madrasaId,
      first_name: firstName,
      last_name: lastName,
      roll_number: finalRoll,
      class_id: targetClassId,
      class_name: className,
      father_name: adm.father_name || "",
      parent_phone: adm.guardian_phone || "",
      address: adm.present_address || "",
      photo_url: adm.photo_url || null,
    };

    if (adm.date_of_birth) studentPayload.date_of_birth = adm.date_of_birth;
    if (adm.blood_group) studentPayload.blood_group = adm.blood_group;

    let { data: newStudent, error: insertError } = await adminClient
      .from("students")
      .insert(studentPayload)
      .select()
      .single();

    // If blood_group or date_of_birth column does not exist in schema cache, gracefully retry without them
    if (
      insertError &&
      (insertError.message?.includes("blood_group") ||
        insertError.message?.includes("date_of_birth") ||
        insertError.message?.includes("schema cache") ||
        insertError.code === "PGRST204")
    ) {
      delete studentPayload.blood_group;
      delete studentPayload.date_of_birth;
      const retryResult = await adminClient
        .from("students")
        .insert(studentPayload)
        .select()
        .single();
      newStudent = retryResult.data;
      insertError = retryResult.error;
    }

    if (insertError || !newStudent) {
      console.error("Error creating permanent student from admission:", insertError);
      return { error: `শিক্ষার্থী প্রোফাইল তৈরিতে ত্রুটি: ${insertError?.message || "অজানা ত্রুটি"}` };
    }

    // 4. Populate Extended Student Profile in Metadata
    if (!meta.student_profiles) {
      meta.student_profiles = {};
    }

    const isBoarding = adm.residential_status === "আবাসিক";
    meta.student_profiles[newStudent.id] = {
      first_name: firstName,
      last_name: lastName,
      roll_number: finalRoll,
      class_id: targetClassId,
      class_name: className,
      father_name: adm.father_name || "",
      father_occupation: adm.father_occupation || "",
      mother_name: adm.mother_name || "",
      guardian_name: adm.guardian_name || adm.father_name || "",
      guardian_relation: adm.guardian_relation || "পিতা",
      parent_phone: adm.guardian_phone || "",
      emergency_contact: adm.emergency_phone || adm.guardian_phone || "",
      address: adm.present_address || "",
      photo_url: adm.photo_url || "",
      residential_status: adm.residential_status || "আবাসিক",
      is_boarding: isBoarding,
      boarding_type: isBoarding ? "সাধারণ পেইং" : "অনাবাসিক",
      nid_or_birth_cert: adm.birth_reg_no || "",
      previous_madrasa: adm.previous_institution || "",
      student_status: "ACTIVE",
      date_of_birth: adm.date_of_birth || "",
      blood_group: adm.blood_group || "",
    };

    // 5. Auto enroll student into current active academic session
    try {
      const { getDefaultSessions } = await import("@/lib/sessions");
      const sessions = meta.sessions || getDefaultSessions(madrasaId);
      const currentSession = sessions.find((s: any) => s.is_current) || sessions[0];
      if (currentSession) {
        const enrollments = meta.enrollments || [];
        const existingIdx = enrollments.findIndex(
          (e: any) => e.student_id === newStudent.id && e.session_id === currentSession.id
        );
        const newEnrollment = {
          id: `enr_${newStudent.id}_${currentSession.id}`,
          madrasa_id: madrasaId,
          student_id: newStudent.id,
          session_id: currentSession.id,
          class_id: targetClassId,
          class_name: className,
          roll_number: finalRoll,
          status: "ACTIVE" as const,
          enrollment_date: new Date().toISOString().split("T")[0],
          created_at: new Date().toISOString(),
        };
        if (existingIdx >= 0) {
          enrollments[existingIdx] = newEnrollment;
        } else {
          enrollments.push(newEnrollment);
        }
        meta.enrollments = enrollments;
      }
    } catch (enrollErr) {
      console.warn("Auto enrollment error on admission confirm:", enrollErr);
    }

    // 6. Update admission record
    const idx = list.findIndex((x) => x.id === params.admissionId);
    list[idx] = {
      ...list[idx],
      status: "CONFIRMED",
      confirmed_student_id: newStudent.id,
      assigned_permanent_roll: finalRoll,
      assigned_class_id: targetClassId,
      assigned_class_name: className,
      updated_at: new Date().toISOString(),
    };

    meta.admissions = list;
    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/admissions");
    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/academic/sessions");
    return {
      success: true,
      student: newStudent,
      message: `${adm.applicant_name_bn}-এর ভর্তি সফলভাবে নিশ্চিত হয়েছে এবং রোল নং ${finalRoll} নির্ধারিত হয়েছে।`,
    };
  } catch (err: any) {
    console.error("Exception in confirmAdmissionToStudent:", err);
    return { error: err.message || "ভর্তি নিশ্চিতকরণে ব্যর্থ হয়েছে।" };
  }
}

/**
 * Bulk Confirm Admissions for merit selected candidates with sequential class rolls
 */
export async function bulkConfirmAdmissions(admissionIds: string[]) {
  try {
    let successCount = 0;

    // Load admissions
    const applicationsToConfirm: AdmissionApplication[] = [];
    for (const id of admissionIds) {
      const adm = await getAdmissionById(id);
      if (adm && adm.status !== "CONFIRMED") {
        applicationsToConfirm.push(adm);
      }
    }

    // Group by class to assign realistic consecutive rolls
    const classGroups: Record<string, AdmissionApplication[]> = {};
    for (const app of applicationsToConfirm) {
      const clsId = app.target_class_id || "default";
      if (!classGroups[clsId]) classGroups[clsId] = [];
      classGroups[clsId].push(app);
    }

    for (const clsId of Object.keys(classGroups)) {
      const group = classGroups[clsId];
      const { nextRoll } = await getNextClassRoll(clsId);
      let currentRollNum = parseInt(nextRoll || "1", 10);
      if (isNaN(currentRollNum) || currentRollNum <= 0) currentRollNum = 1;

      for (const adm of group) {
        const assignedRoll = String(currentRollNum++);
        const res = await confirmAdmissionToStudent({
          admissionId: adm.id,
          assignedClassId: adm.target_class_id,
          assignedRoll,
        });
        if (res.success) successCount++;
      }
    }

    revalidatePath("/dashboard/admissions");
    revalidatePath("/dashboard/students");
    return { success: true, confirmedCount: successCount };
  } catch (err: any) {
    return { error: err.message };
  }
}

/**
 * Delete or Archive application
 */
export async function deleteAdmissionApplication(id: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);

    const meta = await getMadrasaMetadata(madrasaId);
    let list: AdmissionApplication[] = meta.admissions || [];

    meta.admissions = list.filter((item) => item.id !== id);
    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/admissions");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function archiveAdmissionApplication(id: string, isArchived = true) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);

    const meta = await getMadrasaMetadata(madrasaId);
    let list: AdmissionApplication[] = meta.admissions || [];

    const idx = list.findIndex((item) => item.id === id);
    if (idx !== -1) {
      list[idx].is_archived = isArchived;
      list[idx].updated_at = new Date().toISOString();
      meta.admissions = list;
      await saveMadrasaMetadata(madrasaId, meta);
    }

    revalidatePath("/dashboard/admissions");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
