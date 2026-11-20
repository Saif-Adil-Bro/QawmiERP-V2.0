import { getMadrasaMetadata, type MadrasaMetaWithSessions } from "@/lib/sessions";
import { getPortalStudentData } from "@/lib/portal-data";
import {
  normalizeGradingConfig,
  computeStudentExamSummary,
  computeClassMeritPosition,
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

  const [{ data: exams }, madrasaMeta] = await Promise.all([
    adminClient
      .from("exams")
      .select("id, title, year, start_date, status")
      .eq("madrasa_id", madrasaId)
      .order("start_date", { ascending: false }),
    madrasaId
      ? getMadrasaMetadata(madrasaId)
      : Promise.resolve({} as MadrasaMetaWithSessions),
  ]);

  const publishedExams = madrasaMeta?.published_exams || {};
  const gradingConfig = normalizeGradingConfig(madrasaMeta?.exam_grade_scale);

  const enrichedExams = (exams || []).map((e: any) => {
    const publishInfo = publishedExams[e.id];
    const isPublished = Boolean(publishInfo?.is_published || e.status === "Published");
    return {
      ...e,
      is_published: isPublished,
      published_at: publishInfo?.published_at || null,
      publish_note: publishInfo?.note || null,
    };
  });

  const selectedExamId = params.exam_id || enrichedExams?.[0]?.id || null;
  const currentExam = enrichedExams?.find((e: any) => e.id === selectedExamId) || null;
  const isCurrentExamPublished = Boolean(currentExam?.is_published);

  const classId =
    child.class_id || (Array.isArray(child.classes) ? child.classes[0]?.id : child.classes?.id);

  let ownResults: any[] = [];
  let allClassRows: any[] = [];

  if (isCurrentExamPublished && selectedExamId) {
    let classmateIds: string[] = [child.id];
    if (classId) {
      const { data: classmates } = await adminClient
        .from("students")
        .select("id")
        .eq("madrasa_id", madrasaId)
        .eq("class_id", classId);
      if (classmates && classmates.length > 0) {
        classmateIds = Array.from(new Set([child.id, ...classmates.map((c: any) => c.id)]));
      }
    }

    const { data: classExamData } = await adminClient
      .from("exam_results")
      .select("*, exams(id, title, year, start_date, status)")
      .eq("exam_id", selectedExamId)
      .in("student_id", classmateIds);

    allClassRows = classExamData || [];
    ownResults = allClassRows.filter((r: any) => r.student_id === child.id);
  }

  const summary = computeStudentExamSummary(ownResults, gradingConfig);
  const merit = computeClassMeritPosition(child.id, allClassRows, gradingConfig);

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
    />
  );
}
