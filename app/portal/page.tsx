import {childLogs,notices as getNotices,routines} from '@/lib/portal/queries';
import {portalHolidays,studentHomework} from '@/lib/portal/rules';
import {studentLedger} from '@/lib/portal/ledger';
import {portalExams,studentExam} from '@/lib/portal/exams';
import {toDhakaDateString} from '@/lib/date-utils';
import {getPortalStudentData} from '@/lib/portal-data';
import {AlertCircle} from 'lucide-react';
import PortalDashboardClient, {
  type DashboardLatestExamInfo,
} from "./PortalDashboardClient";

export const dynamic = "force-dynamic";

export default async function PortalOverview(props: {
  searchParams?: Promise<{ student_id?: string }>;
}) {
  const params = props.searchParams ? (await props.searchParams) || {} : {};
  const portalData = await getPortalStudentData(params.student_id);

  if (!portalData || !portalData.user) return null;

  const { students, child, madrasaId, adminClient, supabase } = portalData;

  if (students.length === 0 || !child) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl shadow-xs border border-slate-200 text-center">
        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mb-3">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-md">
          আপনার অ্যাকাউন্টের সাথে শিক্ষার্থীর প্রোফাইল সংযুক্ত করতে মাদরাসা কর্তৃপক্ষের সাথে যোগাযোগ করুন।
        </p>
      </div>
    );
  }

  const ids = child.class_id ? [child.class_id] : [];
  const meta = portalData.meta;
  const [attendanceList,hifz,ledger,notices,parsedRoutines,exams] = await Promise.all([
    childLogs(adminClient,madrasaId,'attendance',[child.id]), childLogs(adminClient,madrasaId,'hifz_logs',[child.id]),
    studentLedger(adminClient,madrasaId,child.id,meta),getNotices(adminClient,madrasaId,'Students',ids,portalHolidays(meta.academic_holidays,child.classes?[child.classes]:[])),
    routines(adminClient,madrasaId,ids), portalExams(adminClient,madrasaId,meta),
  ]);
  const activeHolidays = portalHolidays(meta.academic_holidays,child.classes ? [child.classes] : []);
  const childAssignments = studentHomework(meta.assignments,child);
  const exam = exams.find(e=>e.is_published);
  let latestExam:DashboardLatestExamInfo|null = null;
  if (exam) {
    const {summary,merit} = await studentExam(adminClient,madrasaId,exam,child.id,meta);
    latestExam = {...summary,...merit,examId:exam.id,examTitle:exam.title,examYear:exam.year,meritLabel:merit.formattedPosition};
  }
  return (
    <PortalDashboardClient
      students={students}
      child={child}
      attendanceList={attendanceList || []}
      latestHifz={hifz[0] || null}
      totalPaid={ledger.total_paid}
      totalDue={ledger.total_due}
      latestReceiptNo={ledger.payments[0]?.receipt_no || '—'}
      feesList={ledger.payments}
      latestExam={latestExam}
      notices={notices.slice(0,3)}
      childAssignments={childAssignments || []}
      routines={parsedRoutines}
      holidays={activeHolidays}
      todayDateStr={toDhakaDateString()}
    />
  );
}
