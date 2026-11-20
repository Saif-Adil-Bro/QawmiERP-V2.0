import { toDhakaDateStringFrom, toDhakaDateString } from "@/lib/date-utils";
import { AlertCircle } from "lucide-react";
import { getStudentAssignments } from "@/app/actions/assignments";
import { getStudentFeeProfile, getFeeMetadata } from "@/app/actions/fee-management";
import { getPortalStudentData } from "@/lib/portal-data";
import { getMadrasaMetadata, type MadrasaMetaWithSessions } from "@/lib/sessions";
import { parseRoutineItem } from "@/lib/routine-helper";
import {
  computeStudentExamSummary,
  computeClassMeritPosition,
  normalizeGradingConfig,
} from "@/lib/exam-grading";
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

  const classId =
    child.class_id || (Array.isArray(child.classes) ? child.classes[0]?.id : child.classes?.id);

  // Parallel server fetches
  const [
    { data: attendanceList },
    { data: latestHifz },
    feeProfile,
    feeMeta,
    { data: feesList },
    { data: exams },
    madrasaMeta,
    { data: notices },
    childAssignments,
    { data: rawRoutines },
  ] = await Promise.all([
    adminClient
      .from("attendance")
      .select("*")
      .eq("student_id", child.id)
      .order("date", { ascending: false }),
    adminClient
      .from("hifz_logs")
      .select("*")
      .eq("student_id", child.id)
      .order("log_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getStudentFeeProfile(child.id),
    madrasaId ? getFeeMetadata(madrasaId) : null,
    adminClient
      .from("fees")
      .select("*")
      .eq("student_id", child.id)
      .order("payment_date", { ascending: false }),
    adminClient
      .from("exams")
      .select("id, title, year, start_date, status")
      .eq("madrasa_id", madrasaId)
      .order("start_date", { ascending: false }),
    madrasaId
      ? getMadrasaMetadata(madrasaId)
      : Promise.resolve({} as MadrasaMetaWithSessions),
    supabase
      .from("notices")
      .select("*")
      .eq("madrasa_id", madrasaId)
      .order("created_at", { ascending: false })
      .limit(3),
    getStudentAssignments(child.id, classId),
    classId
      ? adminClient
          .from("routines")
          .select("*, subjects(name), teachers(first_name, last_name)")
          .eq("madrasa_id", madrasaId)
          .eq("class_id", classId)
          .order("start_time", { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
  ]);

  // Payment totals & deduplication
  const metadataPayments = (feeMeta?.payments || []).filter(
    (p: any) => p.student_id === child.id && p.status !== "REVERSED"
  );

  const extractReceiptNo = (notes?: string | null): string | null => {
    if (!notes) return null;
    const match = notes.match(/\[(?:রিসিট|অনলাইন পেমেন্ট|Receipt|রসিদ):\s*([A-Za-z0-9-_]+)/i);
    return match ? match[1].trim() : null;
  };

  const combinedPayments: any[] = [...metadataPayments];
  if (feesList) {
    feesList.forEach((sf: any) => {
      const extractedReceipt = extractReceiptNo(sf.notes);
      const sfReceiptNo = sf.receipt_number || extractedReceipt;
      const sfAmount = Number(sf.amount_paid) || Number(sf.amount) || 0;

      const isDuplicate = combinedPayments.some((p) => {
        if (p.id === sf.id || p.db_fee_id === sf.id) return true;
        if (
          sfReceiptNo &&
          p.receipt_no &&
          p.receipt_no.trim().toUpperCase() === sfReceiptNo.trim().toUpperCase()
        ) {
          return true;
        }
        if (
          p.payment_date &&
          sf.payment_date &&
          toDhakaDateStringFrom(p.payment_date) === toDhakaDateStringFrom(sf.payment_date) &&
          Math.abs((Number(p.total_amount_received) || 0) - sfAmount) < 0.01
        ) {
          return true;
        }
        return false;
      });

      if (!isDuplicate) {
        combinedPayments.push({
          id: sf.id,
          receipt_no: sfReceiptNo || `REC-${sf.id.slice(0, 6).toUpperCase()}`,
          total_amount_received: sfAmount,
          payment_date: sf.payment_date,
        });
      }
    });
  }

  const totalPaid = combinedPayments.reduce(
    (acc, curr) => acc + (Number(curr.total_amount_received) || 0),
    0
  );
  const totalDue = Number((feeProfile as any)?.total_due ?? (feeProfile as any)?.totalDue ?? 0);
  const latestReceiptNo =
    combinedPayments[0]?.receipt_no ||
    extractReceiptNo(feesList?.[0]?.notes) ||
    feesList?.[0]?.receipt_number ||
    "স্বয়ংক্রিয় রসিদ";

  // Compute REAL latest published exam summary & class-wide merit position
  const publishedMap = madrasaMeta?.published_exams || {};
  const gradingConfig = normalizeGradingConfig(madrasaMeta?.exam_grade_scale);
  const publishedExamsList = (exams || []).filter((e: any) =>
    Boolean(publishedMap[e.id]?.is_published || e.status === "Published")
  );

  let latestExam: DashboardLatestExamInfo | null = null;

  if (publishedExamsList.length > 0) {
    const latestPublished = publishedExamsList[0];

    // Fetch student's own marks and classmates' marks for true merit position
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

    const { data: classExamRows } = await adminClient
      .from("exam_results")
      .select("id, student_id, exam_id, subject_name, marks_obtained, total_marks")
      .eq("exam_id", latestPublished.id)
      .in("student_id", classmateIds);

    const allRows = classExamRows || [];
    const ownRows = allRows.filter((r: any) => r.student_id === child.id);
    const summary = computeStudentExamSummary(ownRows, gradingConfig);
    const merit = computeClassMeritPosition(child.id, allRows, gradingConfig);

    latestExam = {
      examId: latestPublished.id,
      examTitle: latestPublished.title || (latestPublished as any).name || "সাময়িক পরীক্ষা",
      examYear: latestPublished.year || null,
      hasMarks: summary.hasMarks,
      gradeLabel: summary.gradeLabel,
      gpa: summary.gpa,
      percentage: summary.percentage,
      totalObtained: summary.totalObtained,
      totalMax: summary.totalMax,
      isPassed: summary.isPassed,
      statusLabel: summary.statusLabel,
      meritPosition: merit.meritPosition,
      meritLabel: merit.formattedPosition,
      totalCandidates: merit.totalCandidates,
    };
  }

  const parsedRoutines = (rawRoutines || []).map(parseRoutineItem);
  const activeHolidays = (madrasaMeta?.academic_holidays || [])
    .filter((h) => !h.is_archived && h.publish_to_portal !== false)
    .map((h) => ({
      id: h.id,
      title: h.title,
      start_date: h.start_date,
      end_date: h.end_date,
    }));

  return (
    <PortalDashboardClient
      students={students}
      child={child}
      attendanceList={attendanceList || []}
      latestHifz={latestHifz || null}
      totalPaid={totalPaid}
      totalDue={totalDue}
      latestReceiptNo={latestReceiptNo}
      feesList={feesList || []}
      latestExam={latestExam}
      notices={notices || []}
      childAssignments={childAssignments || []}
      routines={parsedRoutines}
      holidays={activeHolidays}
      todayDateStr={toDhakaDateString()}
    />
  );
}
