import { portalExams, studentExam } from '@/lib/portal/exams';
import { getPortalStudentData } from '@/lib/portal-data';
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

  const enrichedExams = await portalExams(adminClient,madrasaId,portalData.meta);
  const currentExam = params.exam_id ? enrichedExams.find(e=>e.id===params.exam_id) : enrichedExams.find(e=>e.is_published) || enrichedExams[0];
  const selectedExamId = currentExam?.id ?? null;
  const isCurrentExamPublished = !!currentExam?.is_published;
  const {summary, merit} = await studentExam(adminClient,madrasaId,currentExam,child.id,portalData.meta);
  return (
    <PortalExamsClient
      students={students}
      child={child}
      enrichedExams={enrichedExams}
      selectedExamId={selectedExamId}
      currentExam={currentExam}
      isCurrentExamPublished={isCurrentExamPublished}
      summary={summary}
      merit={merit}
    />
  );
}

