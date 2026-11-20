import { NextRequest } from "next/server";
import { authenticateMobileRequest, mobileError, mobileSuccess } from "@/lib/mobile-api";
import { getMadrasaMetadata } from "@/lib/sessions";
import { getExamSettingsBundle } from "@/lib/structured-config";
import {
  computeClassMeritPosition,
  computeStudentExamSummary,
  normalizeGradingConfig,
  type ExamEvaluationOptions,
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
    const sqlPublishMap: Record<string, any> = {};
    if (auth.ctx.madrasaId) {
      try {
        const { data: pubRows } = await auth.adminClient
          .from("exam_settings")
          .select("scope_key, setting_value")
          .eq("madrasa_id", auth.ctx.madrasaId)
          .eq("setting_key", "publish_info");
        for (const row of pubRows || []) {
          if (row?.scope_key && row?.setting_value) {
            sqlPublishMap[String(row.scope_key)] = row.setting_value;
          }
        }
      } catch {
        // Optional table fallback
      }
    }

    const defaultGradingConfig = normalizeGradingConfig(
      (madrasaMeta as any)?.exam_grading_config || (madrasaMeta as any)?.exam_grade_scale
    );

    const enrichedExams = (examsRes.data || []).map((ex: any) => {
      const pub = sqlPublishMap[ex.id] || publishedExamsMap[ex.id];
      const isPublished = Boolean(pub?.is_published || ex.status === "Published");
      return {
        ...ex,
        is_published: isPublished,
        published_at: pub?.published_at || null,
        publish_note: pub?.note || null,
      };
    });

    // Resolve classId + classmates (including student_enrollments fallback)
    let effectiveClassId: string | null = classId || null;
    if (!effectiveClassId && activeStudent.id) {
      try {
        const { data: enrollment } = await auth.adminClient
          .from("student_enrollments")
          .select("class_id")
          .eq("student_id", activeStudent.id)
          .order("enrollment_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (enrollment?.class_id) effectiveClassId = String(enrollment.class_id);
      } catch {
        // Optional table fallback
      }
    }

    const classmateIdSet = new Set<string>([String(activeStudent.id)]);
    if (effectiveClassId) {
      const [classmatesRes, enrolledRes] = await Promise.all([
        auth.adminClient
          .from("students")
          .select("id")
          .eq("madrasa_id", auth.ctx.madrasaId)
          .eq("class_id", effectiveClassId),
        (async () => {
          try {
            return await auth.adminClient
              .from("student_enrollments")
              .select("student_id")
              .eq("madrasa_id", auth.ctx.madrasaId)
              .eq("class_id", effectiveClassId);
          } catch {
            return { data: [] as any[] };
          }
        })(),
      ]);
      for (const c of classmatesRes?.data || []) {
        if (c?.id) classmateIdSet.add(String(c.id));
      }
      for (const e of enrolledRes?.data || []) {
        if (e?.student_id) classmateIdSet.add(String(e.student_id));
      }
    }
    const classStudentIds = Array.from(classmateIdSet);

    const publishedExamIds = enrichedExams
      .filter((e: any) => e.is_published)
      .map((e: any) => e.id);

    let allClassExamRows: any[] = [];
    let allExamSubjects: any[] = [];
    if (publishedExamIds.length > 0 && classStudentIds.length > 0) {
      const [classMarksRes, exSubsRes] = await Promise.all([
        auth.adminClient
          .from("exam_results")
          .select("*")
          .in("exam_id", publishedExamIds)
          .in("student_id", classStudentIds),
        (async () => {
          try {
            return await auth.adminClient
              .from("exam_subjects")
              .select("exam_id, class_id, subject_name, total_marks, pass_marks, is_compulsory")
              .in("exam_id", publishedExamIds);
          } catch {
            return { data: [] as any[] };
          }
        })(),
      ]);
      allClassExamRows = classMarksRes?.data || [];
      allExamSubjects = exSubsRes?.data || [];
    }

    const examSummaries = await Promise.all(
      enrichedExams.map(async (ex: any) => {
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
            merit_label: "অপেক্ষমাণ",
            formatted_merit: "অপেক্ষমাণ",
            total_candidates: 0,
          };
        }

        const bundle = auth.ctx.madrasaId
          ? await getExamSettingsBundle(auth.ctx.madrasaId, ex.id)
          : null;
        const examGradingConfig = bundle?.gradingConfig || defaultGradingConfig;
        const evalOptions: ExamEvaluationOptions = {
          failPolicy: bundle?.evaluationRules?.fail_policy || "compulsory_subject_fail",
          compulsorySubjects: bundle?.compulsorySubjects || {},
          examSubjects: allExamSubjects.filter((s: any) => s.exam_id === ex.id),
          classId: effectiveClassId,
        };

        const studentRows = (examRes.data || []).filter((r: any) => r.exam_id === ex.id);
        const classRows = allClassExamRows.filter((r: any) => r.exam_id === ex.id);
        const summary = computeStudentExamSummary(studentRows, examGradingConfig, evalOptions);
        const merit = computeClassMeritPosition(
          String(activeStudent.id),
          classRows.length > 0 ? classRows : studentRows,
          examGradingConfig,
          evalOptions
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
          merit_label: merit.formattedPosition,
          formatted_merit: merit.formattedPosition,
          total_candidates: merit.totalCandidates,
          subjects: summary.subjects,
        };
      })
    );

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
