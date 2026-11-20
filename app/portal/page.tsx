import { toDhakaDateStringFrom, toDhakaDateString } from "@/lib/date-utils";
import { AlertCircle } from "lucide-react";
import { getStudentAssignments } from "@/app/actions/assignments";
import { getStudentFeeProfile, getFeeMetadata } from "@/app/actions/fee-management";
import { getPortalStudentData } from "@/lib/portal-data";
import { getMadrasaMetadata, type MadrasaMetaWithSessions } from "@/lib/sessions";
import { getExamSettingsBundle } from "@/lib/structured-config";
import { parseRoutineItem } from "@/lib/routine-helper";
import {
  computeStudentExamSummary,
  computeClassMeritPosition,
  normalizeGradingConfig,
  type ExamEvaluationOptions,
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
  const sqlPublishMap: Record<string, any> = {};
  if (madrasaId) {
    try {
      const { data: pubRows } = await adminClient
        .from("exam_settings")
        .select("scope_key, setting_value")
        .eq("madrasa_id", madrasaId)
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

  const publishedExamsList = (exams || []).filter((e: any) => {
    const pub = sqlPublishMap[e.id] || publishedMap[e.id];
    return Boolean(pub?.is_published || e.status === "Published");
  });

  let latestExam: DashboardLatestExamInfo | null = null;

  if (publishedExamsList.length > 0) {
    const latestPublished = publishedExamsList[0];

    let effectiveClassId: string | null = classId || null;
    if (!effectiveClassId && child.id) {
      try {
        const { data: enrollment } = await adminClient
          .from("student_enrollments")
          .select("class_id")
          .eq("student_id", child.id)
          .order("enrollment_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (enrollment?.class_id) {
          effectiveClassId = String(enrollment.class_id);
        }
      } catch {
        // Optional table fallback
      }
    }

    const settingsBundle = madrasaId
      ? await getExamSettingsBundle(madrasaId, latestPublished.id)
      : null;
    const gradingConfig =
      settingsBundle?.gradingConfig ||
      normalizeGradingConfig(madrasaMeta?.exam_grading_config || madrasaMeta?.exam_grade_scale);

    // Fetch student's own marks and classmates' marks for true merit position
    const classmateIdSet = new Set<string>([String(child.id)]);
    let examSubjects: any[] = [];

    if (effectiveClassId) {
      const [classmatesRes, enrolledRes, subjectsRes] = await Promise.all([
        adminClient
          .from("students")
          .select("id")
          .eq("madrasa_id", madrasaId)
          .eq("class_id", effectiveClassId),
        adminClient
          .from("student_enrollments")
          .select("student_id")
          .eq("madrasa_id", madrasaId)
          .eq("class_id", effectiveClassId)
          .then((res: any) => res)
          .catch(() => ({ data: [] })),
        adminClient
          .from("exam_subjects")
          .select("class_id, subject_name, total_marks, pass_marks, is_compulsory")
          .eq("exam_id", latestPublished.id)
          .then((res: any) => res)
          .catch(() => ({ data: [] })),
      ]);

      for (const c of classmatesRes?.data || []) {
        if (c?.id) classmateIdSet.add(String(c.id));
      }
      for (const e of enrolledRes?.data || []) {
        if (e?.student_id) classmateIdSet.add(String(e.student_id));
      }
      examSubjects = subjectsRes?.data || [];
    }

    const { data: classExamRows } = await adminClient
      .from("exam_results")
      .select("*")
      .eq("exam_id", latestPublished.id)
      .in("student_id", Array.from(classmateIdSet));

    const allRows = classExamRows || [];
    const ownRows = allRows.filter((r: any) => String(r.student_id) === String(child.id));

    const evalOptions: ExamEvaluationOptions = {
      failPolicy: settingsBundle?.evaluationRules?.fail_policy || "compulsory_subject_fail",
      compulsorySubjects: settingsBundle?.compulsorySubjects || {},
      examSubjects,
      classId: effectiveClassId,
    };

    const summary = computeStudentExamSummary(ownRows, gradingConfig, evalOptions);
    const merit = computeClassMeritPosition(
      String(child.id),
      allRows,
      gradingConfig,
      evalOptions
    );

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
