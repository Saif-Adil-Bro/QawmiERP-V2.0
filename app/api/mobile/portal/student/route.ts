import { NextRequest } from "next/server";
import { authenticateMobileRequest, mobileError, mobileSuccess } from "@/lib/mobile-api";
import { getMadrasaMetadata } from "@/lib/sessions";
import {
  computeClassMeritPosition,
  computeStudentExamSummary,
  normalizeGradingConfig,
} from "@/lib/exam-grading";
import { parseRoutineItem } from "@/lib/routine-helper";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateMobileRequest(req, {
    requireWrite: false,
    allowPortalRoles: true,
  });
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const requestedStudentId = searchParams.get("student_id");
    const phone = String(auth.ctx.userRow?.phone || auth.ctx.user?.user_metadata?.phone || "").replace(/[^0-9]/g, "");

    let studentsQuery = auth.adminClient
      .from("students")
      .select("*, classes(id, name)")
      .eq("madrasa_id", auth.ctx.madrasaId);

    if (requestedStudentId) {
      studentsQuery = studentsQuery.eq("id", requestedStudentId);
    } else if (phone.length >= 6) {
      studentsQuery = studentsQuery.ilike("parent_phone", `%${phone.slice(-10)}%`);
    }

    const { data: students } = await studentsQuery.limit(10);
    const activeStudent = students?.[0] || null;

    if (!activeStudent) {
      return mobileSuccess(
        {
          students: [],
          active_student: null,
          attendance: [],
          fees: [],
          exams: [],
          exam_results: [],
          exam_summaries: [],
          hifz_logs: [],
          kitab_logs: [],
          routines: [],
          notices: [],
        },
        "কোনো শিক্ষার্থী সংযুক্ত পাওয়া যায়নি।",
        undefined,
        200,
        req
      );
    }

    const classId =
      activeStudent.class_id ||
      (Array.isArray(activeStudent.classes) ? activeStudent.classes[0]?.id : activeStudent.classes?.id);

    const [
      attRes,
      feeRes,
      examsRes,
      examRes,
      hifzRes,
      kitabRes,
      noticeRes,
      routinesRes,
      madrasaMeta,
    ] = await Promise.all([
      auth.adminClient
        .from("attendance")
        .select("*")
        .eq("student_id", activeStudent.id)
        .order("date", { ascending: false })
        .limit(60),
      auth.adminClient
        .from("fees")
        .select("*")
        .eq("student_id", activeStudent.id)
        .order("payment_date", { ascending: false })
        .limit(40),
      auth.adminClient
        .from("exams")
        .select("id, title, year, start_date, status")
        .eq("madrasa_id", auth.ctx.madrasaId)
        .order("start_date", { ascending: false })
        .limit(20),
      auth.adminClient
        .from("exam_results")
        .select("*, exams(id, title, year, status)")
        .eq("student_id", activeStudent.id)
        .order("created_at", { ascending: false })
        .limit(100),
      auth.adminClient
        .from("hifz_logs")
        .select("*")
        .eq("student_id", activeStudent.id)
        .order("log_date", { ascending: false })
        .limit(20),
      auth.adminClient
        .from("kitab_logs")
        .select("*")
        .eq("student_id", activeStudent.id)
        .order("date", { ascending: false })
        .limit(20),
      auth.adminClient
        .from("notices")
        .select("*")
        .eq("madrasa_id", auth.ctx.madrasaId)
        .order("created_at", { ascending: false })
        .limit(20),
      classId
        ? auth.adminClient
            .from("routines")
            .select("*, subjects(name), teachers(first_name, last_name)")
            .eq("madrasa_id", auth.ctx.madrasaId)
            .eq("class_id", classId)
            .order("start_time", { ascending: true })
        : Promise.resolve({ data: [] }),
      auth.ctx.madrasaId ? getMadrasaMetadata(auth.ctx.madrasaId) : Promise.resolve({} as any),
    ]);

    const publishedExamsMap = (madrasaMeta as any)?.published_exams || {};
    const gradingConfig = normalizeGradingConfig((madrasaMeta as any)?.exam_grade_scale);

    const enrichedExams = (examsRes.data || []).map((ex: any) => {
      const pub = publishedExamsMap[ex.id];
      const isPublished = Boolean(pub?.is_published || ex.status === "Published");
      return {
        ...ex,
        is_published: isPublished,
        published_at: pub?.published_at || null,
        publish_note: pub?.note || null,
      };
    });

    // Compute accurate exam summaries + class-wide merit position for published exams
    let classStudentIds: string[] = [activeStudent.id];
    if (classId) {
      const { data: classmates } = await auth.adminClient
        .from("students")
        .select("id")
        .eq("class_id", classId);
      if (classmates && classmates.length > 0) {
        classStudentIds = classmates.map((c: any) => String(c.id));
      }
    }

    const publishedExamIds = enrichedExams
      .filter((e: any) => e.is_published)
      .map((e: any) => e.id);

    let allClassExamRows: any[] = [];
    if (publishedExamIds.length > 0 && classStudentIds.length > 0) {
      const { data: classMarks } = await auth.adminClient
        .from("exam_results")
        .select("id, exam_id, student_id, subject_name, marks_obtained, total_marks")
        .in("exam_id", publishedExamIds)
        .in("student_id", classStudentIds);
      allClassExamRows = classMarks || [];
    }

    const examSummaries = enrichedExams.map((ex: any) => {
      if (!ex.is_published) {
        return {
          id: `${activeStudent.id}_${ex.id}`,
          exam_id: ex.id,
          student_id: activeStudent.id,
          exam_title: ex.title || "পরীক্ষা",
          exam_year: ex.year || "",
          is_published: false,
          publish_note: ex.publish_note || null,
          has_marks: false,
          merit_position: null,
          formatted_merit: "প্রকাশের অপেক্ষায়",
          total_candidates: 0,
        };
      }

      const studentRows = (examRes.data || []).filter((r: any) => r.exam_id === ex.id);
      const classRows = allClassExamRows.filter((r: any) => r.exam_id === ex.id);
      const summary = computeStudentExamSummary(studentRows, gradingConfig);
      const merit = computeClassMeritPosition(
        activeStudent.id,
        classRows.length > 0 ? classRows : studentRows,
        gradingConfig
      );

      return {
        id: `${activeStudent.id}_${ex.id}`,
        exam_id: ex.id,
        student_id: activeStudent.id,
        exam_title: ex.title || "পরীক্ষা",
        exam_year: ex.year || "",
        is_published: true,
        publish_note: ex.publish_note || null,
        has_marks: summary.hasMarks,
        total_obtained: summary.totalObtained,
        total_max: summary.totalMax,
        percentage: summary.percentage,
        gpa: summary.gpa,
        grade_label: summary.gradeLabel,
        grade_color: summary.gradeColor,
        is_passed: summary.isPassed,
        status_label: summary.statusLabel,
        failed_subject_count: summary.failedSubjectCount,
        merit_position: merit.meritPosition,
        formatted_merit: merit.formattedPosition,
        total_candidates: merit.totalCandidates,
        subjects: summary.subjects,
      };
    });

    const parsedRoutines = (routinesRes.data || []).map(parseRoutineItem);

    return mobileSuccess(
      {
        students: students || [],
        active_student: activeStudent,
        attendance: attRes.data || [],
        fees: feeRes.data || [],
        exams: enrichedExams,
        exam_results: (examRes.data || []).filter((r: any) => publishedExamIds.includes(r.exam_id)),
        exam_summaries: examSummaries,
        hifz_logs: hifzRes.data || [],
        kitab_logs: kitabRes.data || [],
        routines: parsedRoutines,
        notices: noticeRes.data || [],
      },
      "Success",
      undefined,
      200,
      req
    );
  } catch (err: any) {
    return mobileError(err?.message || "Server error", 500, "INTERNAL_ERROR");
  }
}
