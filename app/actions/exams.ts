"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";
import { getMadrasaMetadata, saveMadrasaMetadata, MadrasaMetaWithSessions, hydrateStudentWithMetadata } from "@/lib/sessions";

function computeExamStatus(
  startDate?: string | null,
  routines?: { exam_date: string }[] | null,
  manualStatus?: string,
  endDate?: string | null
): {
  status: "Upcoming" | "Ongoing" | "Completed";
  statusTextBangla: string;
  effectiveStartDate: string | null;
  effectiveEndDate: string | null;
  totalRoutineDays: number;
} {
  // Extract all valid routine dates sorted chronologically
  const routineDates = (routines || [])
    .map(r => r.exam_date)
    .filter(Boolean)
    .sort();

  const minRoutineDate = routineDates.length > 0 ? routineDates[0] : null;
  const maxRoutineDate = routineDates.length > 0 ? routineDates[routineDates.length - 1] : null;

  // Effective Start Date: if startDate provided, use it, else minRoutineDate
  const effectiveStartDate = startDate || minRoutineDate;
  // Effective End Date: if endDate provided, use it; else if routine exists, maxRoutineDate; else startDate
  const effectiveEndDate = endDate || maxRoutineDate || startDate || null;

  if (!effectiveStartDate) {
    return {
      status: "Upcoming",
      statusTextBangla: "আসন্ন",
      effectiveStartDate: null,
      effectiveEndDate: null,
      totalRoutineDays: routineDates.length,
    };
  }

  // Current date string in YYYY-MM-DD format (Asia/Dhaka timezone)
  let todayStr: string;
  try {
    todayStr = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Dhaka', 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).format(new Date());
  } catch {
    todayStr = new Date().toISOString().split('T')[0];
  }

  const startStr = effectiveStartDate.split('T')[0];
  const endStr = (effectiveEndDate || effectiveStartDate).split('T')[0];

  let status: "Upcoming" | "Ongoing" | "Completed";
  let statusTextBangla: string;

  if (todayStr < startStr) {
    status = "Upcoming";
    statusTextBangla = "আসন্ন";
  } else if (todayStr >= startStr && todayStr <= endStr) {
    status = "Ongoing";
    statusTextBangla = "চলমান";
  } else {
    status = "Completed";
    statusTextBangla = "সম্পন্ন";
  }

  return {
    status,
    statusTextBangla,
    effectiveStartDate,
    effectiveEndDate,
    totalRoutineDays: routineDates.length,
  };
}

export async function getExams() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return [];

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return [];

  const { data: exams, error } = await supabase
    .from("exams")
    .select("*")
    .eq('madrasa_id', finalMadrasaId)
    .order("start_date", { ascending: false });

  if (error || !exams) {
    console.error("Error fetching exams:", error);
    return [];
  }

  const examIds = exams.map(e => e.id);
  const [{ data: routines }, madrasaMeta] = await Promise.all([
    examIds.length > 0
      ? supabase
          .from("exam_routines")
          .select("id, exam_id, exam_date")
          .in("exam_id", examIds)
      : Promise.resolve({ data: [] }),
    getMadrasaMetadata(finalMadrasaId),
  ]);

  const publishedExams = madrasaMeta?.published_exams || {};
  const examEndDates = madrasaMeta?.exam_end_dates || {};

  const routinesByExam = new Map<string, any[]>();
  (routines || []).forEach(r => {
    if (!routinesByExam.has(r.exam_id)) {
      routinesByExam.set(r.exam_id, []);
    }
    routinesByExam.get(r.exam_id)!.push(r);
  });

  return exams.map(exam => {
    const examRoutines = routinesByExam.get(exam.id) || [];
    const effectiveStoredEndDate = exam.end_date || examEndDates[exam.id] || null;
    const computed = computeExamStatus(exam.start_date, examRoutines, exam.status, effectiveStoredEndDate);
    const publishInfo = publishedExams[exam.id];
    const isPublished = Boolean(publishInfo?.is_published || exam.status === "Published");

    return {
      ...exam,
      end_date: effectiveStoredEndDate,
      status: isPublished ? "Published" : computed.status,
      computed_status: computed.status,
      dynamic_status: computed.status,
      dynamic_status_bangla: computed.statusTextBangla,
      is_published: isPublished,
      published_at: publishInfo?.published_at || null,
      published_by: publishInfo?.published_by || null,
      publish_note: publishInfo?.note || null,
      effective_start_date: computed.effectiveStartDate,
      effective_end_date: computed.effectiveEndDate,
      routine_count: computed.totalRoutineDays,
      last_routine_date: computed.effectiveEndDate,
    };
  });
}

export async function getExamById(id: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const finalMadrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

  const { data, error } = await supabase
    .from("exams")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("Error fetching exam:", error);
    return null;
  }

  const madrasaId = finalMadrasaId || data.madrasa_id;
  const [{ data: routines }, madrasaMeta] = await Promise.all([
    supabase
      .from("exam_routines")
      .select("id, exam_id, exam_date")
      .eq("exam_id", id),
    madrasaId ? getMadrasaMetadata(madrasaId) : Promise.resolve({} as MadrasaMetaWithSessions),
  ]);

  const examEndDates = madrasaMeta?.exam_end_dates || {};
  const effectiveStoredEndDate = data.end_date || examEndDates[id] || null;
  const computed = computeExamStatus(data.start_date, routines, data.status, effectiveStoredEndDate);
  const publishInfo = madrasaMeta?.published_exams?.[id];
  const isPublished = Boolean(publishInfo?.is_published || data.status === "Published");

  return {
    ...data,
    end_date: effectiveStoredEndDate,
    status: isPublished ? "Published" : computed.status,
    computed_status: computed.status,
    dynamic_status: computed.status,
    dynamic_status_bangla: computed.statusTextBangla,
    is_published: isPublished,
    published_at: publishInfo?.published_at || null,
    published_by: publishInfo?.published_by || null,
    publish_note: publishInfo?.note || null,
    effective_start_date: computed.effectiveStartDate,
    effective_end_date: computed.effectiveEndDate,
    routine_count: computed.totalRoutineDays,
    last_routine_date: computed.effectiveEndDate,
  };
}

export async function toggleExamPublish(examId: string, isPublished: boolean, note?: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুগ্রহ করে পুনরায় লগইন করুন।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসার তথ্য খুঁজে পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);
    if (!meta.published_exams) {
      meta.published_exams = {};
    }

    const { data: userData } = await supabase
      .from("users")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    const publisherName = userData?.full_name || userData?.email || "কর্তৃপক্ষ";

    meta.published_exams[examId] = {
      is_published: isPublished,
      published_at: new Date().toISOString(),
      published_by: publisherName,
      note: note || "",
    };

    const saved = await saveMadrasaMetadata(madrasaId, meta);
    if (!saved) {
      return { error: "ফলাফলের অবস্থা সংরক্ষণ করা যায়নি।" };
    }

    // Update status in exams table as well
    const adminClient = await createAdminClient();
    await adminClient
      .from("exams")
      .update({
        status: isPublished ? "Published" : "Completed",
      })
      .eq("id", examId);

    revalidatePath("/dashboard/exams");
    revalidatePath(`/dashboard/exams/${examId}/results`);
    revalidatePath(`/dashboard/exams/${examId}/merit-list`);
    revalidatePath(`/dashboard/exams/${examId}/report-cards`);
    revalidatePath("/portal/exams");
    revalidatePath("/portal", "layout");

    return {
      success: true,
      is_published: isPublished,
      message: isPublished
        ? "পরীক্ষার ফলাফল আনুষ্ঠানিকভাবে সফলভাবে প্রকাশিত হয়েছে! অভিভাবক ও শিক্ষার্থীরা এখন পোর্টালে রেজাল্ট ও মার্কশিট দেখতে পাবেন।"
        : "পরীক্ষার ফলাফল স্থগিত/অপ্রকাশিত করা হয়েছে। পোর্টাল থেকে ফলাফল লুকানো হয়েছে।",
    };
  } catch (err: any) {
    console.error("toggleExamPublish error:", err);
    return { error: err.message || "একটি ত্রুটি হয়েছে" };
  }
}

export async function getExamPublishStatus(examId: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { isPublished: false };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { isPublished: false };

    const meta = await getMadrasaMetadata(madrasaId);
    const publishInfo = meta?.published_exams?.[examId];

    return {
      isPublished: Boolean(publishInfo?.is_published),
      publishedAt: publishInfo?.published_at || null,
      publishedBy: publishInfo?.published_by || null,
      note: publishInfo?.note || null,
    };
  } catch (err) {
    console.error("getExamPublishStatus error:", err);
    return { isPublished: false };
  }
}

export async function createExam(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  let title = (formData.get("title") as string)?.trim();
  const custom_title = (formData.get("custom_title") as string)?.trim();
  const year = (formData.get("year") as string)?.trim();
  const start_date = formData.get("start_date") as string;
  const end_date = formData.get("end_date") as string;

  if (title === "অন্যান্য" || title === "অন্যান্য (Custom)" || title === "custom") {
    title = custom_title || "অন্যান্য পরীক্ষা";
  }

  if (!title || !year) {
    return { error: "পরীক্ষার নাম এবং বছর আবশ্যক।" };
  }

  // Calculate dynamic status initially
  const computed = computeExamStatus(start_date, null, undefined, end_date);

  let insertPayload: any = {
    madrasa_id: finalMadrasaId,
    title,
    year,
    start_date: start_date || null,
    end_date: end_date || null,
    status: computed.status
  };

  let newExamId: string | null = null;
  let { data: insertedData, error } = await supabase.from("exams").insert(insertPayload).select("id").single();
  if (insertedData?.id) {
    newExamId = insertedData.id;
  }

  // If DB table doesn't have end_date column, fallback without end_date
  if (error && (error.message?.includes("end_date") || error.code === "PGRST204")) {
    delete insertPayload.end_date;
    const retry = await supabase.from("exams").insert(insertPayload).select("id").single();
    if (retry.data?.id) {
      newExamId = retry.data.id;
    }
    error = retry.error;
  }

  if (error) {
    console.error("Error creating exam:", error);
    return { error: error.message };
  }

  // Always store end_date in madrasa metadata to ensure 100% persistence
  if (newExamId && end_date) {
    try {
      const meta = await getMadrasaMetadata(finalMadrasaId);
      meta.exam_end_dates = meta.exam_end_dates || {};
      meta.exam_end_dates[newExamId] = end_date;
      await saveMadrasaMetadata(finalMadrasaId, meta);
    } catch (metaErr) {
      console.error("Error persisting exam end_date in metadata:", metaErr);
    }
  }

  revalidatePath("/dashboard/exams");
  return { success: true };
}

export async function updateExamDetails(examId: string, data: { title?: string; year?: string; start_date?: string | null; end_date?: string | null }) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);

  const computed = computeExamStatus(data.start_date, null, undefined, data.end_date);

  let updatePayload: any = {
    title: data.title,
    year: data.year,
    start_date: data.start_date || null,
    end_date: data.end_date || null,
    status: computed.status
  };

  let { error } = await supabase.from("exams").update(updatePayload).eq("id", examId);

  if (error && (error.message?.includes("end_date") || error.code === "PGRST204")) {
    delete updatePayload.end_date;
    const retry = await supabase.from("exams").update(updatePayload).eq("id", examId);
    error = retry.error;
  }

  if (error) {
    console.error("Error updating exam:", error);
    return { error: error.message };
  }

  // Update in madrasa metadata
  if (finalMadrasaId && data.end_date !== undefined) {
    try {
      const meta = await getMadrasaMetadata(finalMadrasaId);
      meta.exam_end_dates = meta.exam_end_dates || {};
      if (data.end_date) {
        meta.exam_end_dates[examId] = data.end_date;
      } else {
        delete meta.exam_end_dates[examId];
      }
      await saveMadrasaMetadata(finalMadrasaId, meta);
    } catch (metaErr) {
      console.error("Error updating exam end_date in metadata:", metaErr);
    }
  }

  revalidatePath("/dashboard/exams");
  revalidatePath(`/dashboard/exams/${examId}/setup`);
  return { success: true };
}

export async function deleteExam(examId: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const finalMadrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

  const { error } = await supabase.from("exams").delete().eq("id", examId);

  if (error) {
    console.error("Error deleting exam:", error);
    return { error: error.message };
  }

  if (finalMadrasaId) {
    try {
      const meta = await getMadrasaMetadata(finalMadrasaId);
      if (meta.exam_end_dates && meta.exam_end_dates[examId]) {
        delete meta.exam_end_dates[examId];
        await saveMadrasaMetadata(finalMadrasaId, meta);
      }
    } catch (metaErr) {
      console.error("Error cleaning exam metadata:", metaErr);
    }
  }

  revalidatePath("/dashboard/exams");
  return { success: true };
}

export async function getStudentsByClass(classId: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return [];

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return [];

  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("madrasa_id", finalMadrasaId)
    .eq("class_id", classId)
    .order("roll_number", { ascending: true });

  let rawStudents = data || [];
  if (error || rawStudents.length === 0) {
    try {
      const adminClient = await createAdminClient();
      const { data: adminData } = await adminClient
        .from("students")
        .select("*")
        .eq("madrasa_id", finalMadrasaId)
        .eq("class_id", classId)
        .order("roll_number", { ascending: true });
      if (adminData && adminData.length > 0) {
        rawStudents = adminData;
      }
    } catch (e) {
      console.warn("Could not query admin client in getStudentsByClass:", e);
    }
  }

  try {
    const meta = await getMadrasaMetadata(finalMadrasaId);
    return rawStudents.map((std: any) => {
      const hydrated: any = hydrateStudentWithMetadata(std, meta);
      const profile: any = meta?.student_profiles?.[std.id];
      const guardianPhone = 
        profile?.parent_phone || 
        profile?.guardian_phone || 
        profile?.emergency_contact || 
        hydrated?.parent_phone || 
        hydrated?.guardian_phone || 
        hydrated?.emergency_contact || 
        std.parent_phone || 
        std.guardian_phone || 
        std.emergency_contact || 
        hydrated?.phone || 
        std.phone || 
        "";
      const photoUrl = profile?.photo_url || hydrated?.photo_url || std.photo_url || "";
      return {
        ...hydrated,
        parent_phone: guardianPhone,
        guardian_phone: guardianPhone,
        phone: guardianPhone,
        photo_url: photoUrl
      };
    });
  } catch (e) {
    return rawStudents;
  }
}

export async function getExamResults(examId: string, classId: string, subjectName: string) {
  const supabase = await createClient();
  
  // Get all students of the class
  const students = await getStudentsByClass(classId);
  if (!students.length) return [];

  // Get marks for these students
  const { data: results, error } = await supabase
    .from("exam_results")
    .select("*")
    .eq("exam_id", examId)
    .eq("subject_name", subjectName)
    .in("student_id", students.map(s => s.id));

  const marksMap = new Map();
  results?.forEach(r => {
    marksMap.set(r.student_id, { marks: r.marks_obtained, total: r.total_marks });
  });

  return students.map(s => ({
    ...s,
    marks_obtained: marksMap.get(s.id)?.marks || '',
    total_marks: marksMap.get(s.id)?.total || 100
  }));
}

export async function saveExamMarks(examId: string, subjectName: string, marksData: { student_id: string, marks_obtained: number, total_marks: number }[]) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  const recordsToUpsert = marksData.map(record => ({
    madrasa_id: finalMadrasaId,
    exam_id: examId,
    student_id: record.student_id,
    subject_name: subjectName,
    marks_obtained: record.marks_obtained,
    total_marks: record.total_marks
  }));

  const { error } = await supabase
    .from("exam_results")
    .upsert(recordsToUpsert, { onConflict: 'exam_id, student_id, subject_name' });

  if (error) {
    console.error("Error saving marks:", error);
    return { error: error.message };
  }

  revalidatePath(`/dashboard/exams/${examId}/marks`);
  return { success: true };
}

export async function getStudentReportCard(examId: string, classId?: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return [];

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return [];
  
  let studentsQuery = supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, class_id, classes(name)")
    .eq("madrasa_id", finalMadrasaId);
    
  if (classId) {
    studentsQuery = studentsQuery.eq("class_id", classId);
  }
  
  const { data: students, error: studentsError } = await studentsQuery.order('roll_number');
  
  if (studentsError || !students.length) return [];

  const [{ data: results, error: resultsError }, { data: validSubjects }, madrasaMeta] = await Promise.all([
    supabase
      .from("exam_results")
      .select("*")
      .eq("exam_id", examId)
      .in("student_id", students.map(s => s.id)),
    supabase
      .from("exam_subjects")
      .select("*")
      .eq("exam_id", examId),
    getMadrasaMetadata(finalMadrasaId)
  ]);
    
  if (resultsError) return [];

  // Evaluation rules and per-subject compulsory settings
  const examRules = madrasaMeta?.exam_evaluation_rules?.[examId] || {};
  const failPolicy = examRules?.fail_policy || "compulsory_subject_fail"; // "compulsory_subject_fail" | "any_subject_fail" | "percentage_only"
  const compulsoryMeta = madrasaMeta?.exam_compulsory_subjects?.[examId] || {};

  // Group students by class to resolve complete subject lists
  const classSubjectMap = new Map<string, { subject_name: string; total_marks: number; pass_marks: number; is_compulsory: boolean; exam_type: string }[]>();

  // 1. Populate from exam_subjects setup
  (validSubjects || []).forEach((vs: any) => {
    if (!classSubjectMap.has(vs.class_id)) {
      classSubjectMap.set(vs.class_id, []);
    }
    const isComp = compulsoryMeta[`${vs.class_id}:${vs.subject_name}`] !== undefined 
      ? Boolean(compulsoryMeta[`${vs.class_id}:${vs.subject_name}`])
      : (vs.is_compulsory !== undefined ? Boolean(vs.is_compulsory) : true); // default compulsory

    classSubjectMap.get(vs.class_id)!.push({
      subject_name: vs.subject_name,
      total_marks: Number(vs.total_marks) || 100,
      pass_marks: Number(vs.pass_marks) || 33,
      is_compulsory: isComp,
      exam_type: vs.exam_type || "Written"
    });
  });

  // 2. Fallback: if a class has no exam_subjects setup, discover all distinct subjects from entered results
  students.forEach(student => {
    if (!classSubjectMap.has(student.class_id) || classSubjectMap.get(student.class_id)!.length === 0) {
      const studentClassResults = (results || []).filter(r => {
        const studentRecord = students.find(s => s.id === r.student_id);
        return studentRecord?.class_id === student.class_id;
      });
      const uniqueSubjects = new Map<string, { total_marks: number }>();
      studentClassResults.forEach(r => {
        if (r.subject_name) {
          uniqueSubjects.set(r.subject_name, {
            total_marks: Number(r.total_marks) || 100
          });
        }
      });
      const fallbackList: any[] = [];
      uniqueSubjects.forEach((val, subName) => {
        const isComp = compulsoryMeta[`${student.class_id}:${subName}`] !== undefined 
          ? Boolean(compulsoryMeta[`${student.class_id}:${subName}`])
          : true;
        fallbackList.push({
          subject_name: subName,
          total_marks: val.total_marks,
          pass_marks: 33,
          is_compulsory: isComp,
          exam_type: "Written"
        });
      });
      if (fallbackList.length > 0) {
        classSubjectMap.set(student.class_id, fallbackList);
      }
    }
  });

  // Group results by student ensuring EVERY class subject is present (0-default if unassigned/absent)
  const studentResults = students.map(student => {
    const classSubjects = classSubjectMap.get(student.class_id) || [];
    
    // Construct complete subject-wise marks
    const studentMarks = classSubjects.map(subDef => {
      const existingResult = (results || []).find(r => r.student_id === student.id && r.subject_name === subDef.subject_name);
      
      const marksObtained = existingResult && existingResult.marks_obtained !== null && existingResult.marks_obtained !== undefined
        ? Number(existingResult.marks_obtained)
        : 0; // Default to 0 as required if no marks entered or absent
      
      const totalMarks = Number(existingResult?.total_marks || subDef.total_marks || 100);
      const passMarks = Number(subDef.pass_marks || 33);
      const isFailed = marksObtained < passMarks;

      return {
        id: existingResult?.id || `fallback_${student.id}_${subDef.subject_name}`,
        exam_id: examId,
        student_id: student.id,
        subject_name: subDef.subject_name,
        marks_obtained: marksObtained,
        total_marks: totalMarks,
        pass_marks: passMarks,
        is_compulsory: subDef.is_compulsory,
        is_failed: isFailed,
        has_entered_marks: existingResult !== undefined && existingResult.marks_obtained !== null,
        exam_type: subDef.exam_type
      };
    });
    
    const totalObtained = studentMarks.reduce((sum, r) => sum + Number(r.marks_obtained || 0), 0);
    const totalMax = studentMarks.reduce((sum, r) => sum + Number(r.total_marks || 100), 0);
    const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
    
    // Determine Pass/Fail based on failPolicy and compulsory subjects
    const failedCompulsorySubjects = studentMarks.filter(m => m.is_compulsory && m.is_failed);
    const failedAllSubjects = studentMarks.filter(m => m.is_failed);

    let isOverallFailed = false;
    let failReason = "";

    if (studentMarks.length > 0) {
      if (failPolicy === "any_subject_fail" && failedAllSubjects.length > 0) {
        isOverallFailed = true;
        failReason = `${failedAllSubjects.length}টি বিষয়ে অকৃতকার্য`;
      } else if (failPolicy === "percentage_only") {
        isOverallFailed = percentage < 33;
        failReason = isOverallFailed ? "নম্বর শতকরা ৩৩% এর কম" : "";
      } else {
        // Default "compulsory_subject_fail"
        if (failedCompulsorySubjects.length > 0) {
          isOverallFailed = true;
          failReason = `আবশ্যক বিষয়ে অকৃতকার্য (${failedCompulsorySubjects.map(s => s.subject_name).join(", ")})`;
        } else if (percentage < 33) {
          isOverallFailed = true;
          failReason = "নম্বর শতকরা ৩৩% এর কম";
        }
      }
    }

    const calculatedGrade = isOverallFailed ? "রাসিব (Fail)" : calculateGrade(percentage);

    return {
      ...student,
      class_name: Array.isArray(student.classes) ? student.classes[0]?.name : (student.classes as any)?.name,
      marks: studentMarks,
      totalObtained,
      totalMax,
      percentage: percentage.toFixed(2),
      grade: calculatedGrade,
      is_failed: isOverallFailed,
      fail_reason: failReason,
      failed_compulsory_count: failedCompulsorySubjects.length,
      failed_total_count: failedAllSubjects.length
    };
  });

  return studentResults;
}

function calculateGrade(percentage: number) {
  if (percentage >= 80) return "মুমতাজ (A+)";
  if (percentage >= 70) return "জায়্যিদ জিদ্দান (A)";
  if (percentage >= 60) return "জায়্যিদ (B)";
  if (percentage >= 45) return "মাকবুল (C)";
  if (percentage >= 33) return "উত্তীর্ণ (D)";
  return "রাসিব (Fail)";
}

export async function getAllExamSubjects(examId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exam_subjects")
    .select("*")
    .eq("exam_id", examId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching all exam subjects:", error);
    return [];
  }
  return data || [];
}

export async function getExamSubjects(examId: string, classId: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const finalMadrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

  const [{ data, error }, madrasaMeta] = await Promise.all([
    supabase
      .from("exam_subjects")
      .select("*")
      .eq("exam_id", examId)
      .eq("class_id", classId)
      .order("created_at", { ascending: true }),
    finalMadrasaId ? getMadrasaMetadata(finalMadrasaId) : Promise.resolve({} as MadrasaMetaWithSessions)
  ]);

  if (error) {
    console.error("Error fetching exam subjects:", error);
    return [];
  }

  const compulsoryMeta = madrasaMeta?.exam_compulsory_subjects?.[examId] || {};

  return (data || []).map((sub: any) => {
    const isComp = compulsoryMeta[`${classId}:${sub.subject_name}`] !== undefined
      ? Boolean(compulsoryMeta[`${classId}:${sub.subject_name}`])
      : (sub.is_compulsory !== undefined ? Boolean(sub.is_compulsory) : true);

    return {
      ...sub,
      is_compulsory: isComp
    };
  });
}

export async function getExamEvaluationSettings(examId: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { fail_policy: "compulsory_subject_fail" };
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { fail_policy: "compulsory_subject_fail" };

  const madrasaMeta = await getMadrasaMetadata(finalMadrasaId);
  return madrasaMeta?.exam_evaluation_rules?.[examId] || { fail_policy: "compulsory_subject_fail" };
}

export async function saveExamEvaluationSettings(examId: string, settings: { fail_policy: string }) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  const madrasaMeta = await getMadrasaMetadata(finalMadrasaId);
  const examRules = madrasaMeta.exam_evaluation_rules || {};
  examRules[examId] = {
    ...(examRules[examId] || {}),
    ...settings,
    updated_at: new Date().toISOString()
  };

  const updatedMeta: MadrasaMetaWithSessions = {
    ...madrasaMeta,
    exam_evaluation_rules: examRules
  };

  const saveRes = await saveMadrasaMetadata(finalMadrasaId, updatedMeta);
  if (!saveRes) {
    return { error: "Failed to save evaluation settings" };
  }

  revalidatePath(`/dashboard/exams/${examId}`);
  return { success: true };
}

export async function saveExamSubjects(examId: string, classId: string, subjectsData: any[], failPolicy?: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  // Delete existing records for this class & exam
  await supabase
    .from("exam_subjects")
    .delete()
    .eq("exam_id", examId)
    .eq("class_id", classId);

  const recordsToInsert = subjectsData.map(record => ({
    madrasa_id: finalMadrasaId,
    exam_id: examId,
    class_id: classId,
    subject_name: record.subject_name,
    total_marks: Number(record.total_marks) || 100,
    pass_marks: Number(record.pass_marks) || 33,
    exam_type: record.exam_type || "Written"
  }));

  if (recordsToInsert.length > 0) {
    const { error } = await supabase
      .from("exam_subjects")
      .insert(recordsToInsert);

    if (error) {
      console.error("Error saving exam subjects:", error);
      return { error: error.message };
    }
  }

  // Persist compulsory flags & fail policy in metadata
  const madrasaMeta = await getMadrasaMetadata(finalMadrasaId);
  const compulsoryMeta = madrasaMeta.exam_compulsory_subjects || {};
  const currentExamCompulsory = compulsoryMeta[examId] || {};

  subjectsData.forEach(sub => {
    currentExamCompulsory[`${classId}:${sub.subject_name}`] = sub.is_compulsory !== false;
  });
  compulsoryMeta[examId] = currentExamCompulsory;

  const examRules = madrasaMeta.exam_evaluation_rules || {};
  if (failPolicy) {
    examRules[examId] = {
      ...(examRules[examId] || {}),
      fail_policy: failPolicy,
      updated_at: new Date().toISOString()
    };
  }

  const updatedMeta: MadrasaMetaWithSessions = {
    ...madrasaMeta,
    exam_compulsory_subjects: compulsoryMeta,
    exam_evaluation_rules: examRules
  };

  await saveMadrasaMetadata(finalMadrasaId, updatedMeta);

  revalidatePath(`/dashboard/exams/${examId}/setup`);
  revalidatePath(`/dashboard/exams/${examId}/results`);
  revalidatePath(`/dashboard/exams/${examId}/merit-list`);
  revalidatePath(`/dashboard/exams/${examId}/report-cards`);
  return { success: true };
}
