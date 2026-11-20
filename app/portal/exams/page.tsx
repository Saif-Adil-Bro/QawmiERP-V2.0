import { getMadrasaMetadata, type MadrasaMetaWithSessions } from "@/lib/sessions";
import { getPortalStudentData } from "@/lib/portal-data";
import { getExamSettingsBundle } from "@/lib/structured-config";
import {
  normalizeGradingConfig,
  computeStudentExamSummary,
  computeClassMeritPosition,
  type ExamEvaluationOptions,
} from "@/lib/exam-grading";
import PortalExamsClient from "./PortalExamsClient";

export const dynamic = "force-dynamic";

export default async function ParentPortalExams(props: {
  searchParams?: Promise<{ student_id?: string; exam_id?: string }>;
}) {
  const params = props.searchParams ? (await props.searchParams) || {} : {};
  const portalData = await getPortalStudentData(params.student_id);

  if (!portalData || !portalData.user) return null;

  const { students, child, madrasaId, adminClient } = portalData;

  if (students.length === 0 || !child) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
        কোনো শিক্ষার্থী পাওয়া যায়নি।
      </div>
    );
  }

  const [{ data: exams }, madrasaMeta, sqlPublishRes] = await Promise.all([
    adminClient
      .from("exams")
      .select("id, title, year, start_date, status")
      .eq("madrasa_id", madrasaId)
      .order("start_date", { ascending: false }),
    madrasaId
      ? getMadrasaMetadata(madrasaId)
      : Promise.resolve({} as MadrasaMetaWithSessions),
    madrasaId
      ? adminClient
          .from("exam_settings")
          .select("scope_key, setting_value")
          .eq("madrasa_id", madrasaId)
          .eq("setting_key", "publish_info")
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const publishedExams = madrasaMeta?.published_exams || {};
  const sqlPublishMap: Record<string, any> = {};
  for (const row of sqlPublishRes?.data || []) {
    if (row?.scope_key && row?.setting_value) {
      sqlPublishMap[String(row.scope_key)] = row.setting_value;
    }
  }

  const enrichedExams = (exams || []).map((e: any) => {
    const publishInfo = sqlPublishMap[e.id] || publishedExams[e.id];
    const isPublished = Boolean(publishInfo?.is_published || e.status === "Published");
    return {
      ...e,
      is_published: isPublished,
      published_at: publishInfo?.published_at || null,
      publish_note: publishInfo?.note || null,
    };
  });

  // Prefer explicit exam_id param; otherwise default to the latest PUBLISHED exam
  const latestPublishedExam = enrichedExams.find((e: any) => e.is_published);
  const selectedExamId =
    params.exam_id || latestPublishedExam?.id || enrichedExams?.[0]?.id || null;
  const currentExam = enrichedExams?.find((e: any) => e.id === selectedExamId) || null;
  const isCurrentExamPublished = Boolean(currentExam?.is_published);

  // Resolve classId robustly (students.class_id -> joined classes.id -> student_enrollments fallback)
  let classId: string | null =
    child.class_id ||
    (Array.isArray(child.classes) ? child.classes[0]?.id : child.classes?.id) ||
    null;

  if (!classId && child.id) {
    try {
      const { data: enrollment } = await adminClient
        .from("student_enrollments")
        .select("class_id")
        .eq("student_id", child.id)
        .order("enrollment_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (enrollment?.class_id) {
        classId = String(enrollment.class_id);
      }
    } catch {
      // Optional table fallback
    }
  }

  const settingsBundle =
    madrasaId && selectedExamId
      ? await getExamSettingsBundle(madrasaId, selectedExamId)
      : null;

  const gradingConfig =
    settingsBundle?.gradingConfig ||
    normalizeGradingConfig(madrasaMeta?.exam_grading_config || madrasaMeta?.exam_grade_scale);

  let ownResults: any[] = [];
  let allClassRows: any[] = [];
  let examSubjects: any[] = [];

  if (isCurrentExamPublished && selectedExamId) {
    const classmateIdSet = new Set<string>([String(child.id)]);

    if (classId) {
      const [classStudentsRes, enrolledStudentsRes, examSubjectsRes] = await Promise.all([
        adminClient
          .from("students")
          .select("id")
          .eq("madrasa_id", madrasaId)
          .eq("class_id", classId),
        adminClient
          .from("student_enrollments")
          .select("student_id")
          .eq("madrasa_id", madrasaId)
          .eq("class_id", classId)
          .then((res: any) => res)
          .catch(() => ({ data: [] })),
        adminClient
          .from("exam_subjects")
          .select("class_id, subject_name, total_marks, pass_marks, is_compulsory")
          .eq("exam_id", selectedExamId)
          .then((res: any) => res)
          .catch(() => ({ data: [] })),
      ]);

      for (const c of classStudentsRes?.data || []) {
        if (c?.id) classmateIdSet.add(String(c.id));
      }
      for (const e of enrolledStudentsRes?.data || []) {
        if (e?.student_id) classmateIdSet.add(String(e.student_id));
      }
      examSubjects = examSubjectsRes?.data || [];
    } else {
      try {
        const { data: exSubs } = await adminClient
          .from("exam_subjects")
          .select("class_id, subject_name, total_marks, pass_marks, is_compulsory")
          .eq("exam_id", selectedExamId);
        examSubjects = exSubs || [];
      } catch {
        examSubjects = [];
      }
    }

    const classmateIds = Array.from(classmateIdSet);

    const { data: classExamData } = await adminClient
      .from("exam_results")
      .select("*, exams(id, title, year, start_date, status)")
      .eq("exam_id", selectedExamId)
      .in("student_id", classmateIds);

    allClassRows = classExamData || [];
    ownResults = allClassRows.filter((r: any) => String(r.student_id) === String(child.id));
  }

  const evalOptions: ExamEvaluationOptions = {
    failPolicy: settingsBundle?.evaluationRules?.fail_policy || "compulsory_subject_fail",
    compulsorySubjects: settingsBundle?.compulsorySubjects || {},
    examSubjects,
    classId,
  };

  const summary = computeStudentExamSummary(ownResults, gradingConfig, evalOptions);
  const merit = computeClassMeritPosition(
    String(child.id),
    allClassRows,
    gradingConfig,
    evalOptions
  );

  return (
    <PortalExamsClient
      students={students}
      child={child}
      enrichedExams={enrichedExams}
      selectedExamId={selectedExamId}
      currentExam={currentExam}
      isCurrentExamPublished={isCurrentExamPublished}
      rawResults={ownResults}
      summary={summary}
      merit={merit}
      gradingConfig={gradingConfig}
      evalOptions={evalOptions}
    />
  );
}

