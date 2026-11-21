import { severities, statuses, dialable } from "@/lib/student-health/model";
// Wire contract shared by full and background sync. [] means an authoritative deletion;
// a missing collection or profile is a failed/incomplete response, not an empty snapshot.
const fields = {
  students: "students",
  classes: "classes",
  attendance: "attendance",
  fees: "fee_invoices",
  feePayments: "fee_payments",
  discounts: "fee_discounts",
  exams: "exams",
  examResults: "exam_results",
  examSummaries: "exam_summaries",
  hifzLogs: "hifz_logs",
  kitabLogs: "kitab_logs",
  healthRecords: "health_records",
  notices: "notices",
  routines: "routines",
  academicCalendar: "holidays",
  homework: "assignments",
} as const;
export function mapPortalSnapshot(
  data: any,
  userId: string,
  tenant: string,
  requested: string,
  portal: "student" | "teacher",
) {
  if (
    data?.version !== 1 ||
    data.profile?.id !== userId ||
    data.profile.madrasa_id !== tenant
  )
    throw new Error("অ্যাকাউন্টের তথ্য মেলেনি।");
  if (requested && data.active_student && data.active_student.id !== requested)
    throw new Error("শিক্ষার্থীর তথ্য মেলেনি।");
  const mapped = {} as Record<keyof typeof fields, any[]>;
  for (const [key, wire] of Object.entries(fields)) {
    if (
      portal === "teacher" &&
      wire === "health_records" &&
      data[wire] === undefined
    ) {
      mapped.healthRecords = [];
      continue;
    }
    if (!Array.isArray(data[wire])) throw new Error(`অসম্পূর্ণ সিঙ্ক: ${wire}`);
    mapped[key as keyof typeof fields] = data[wire];
  }
  if (data.portal !== portal) throw new Error("পোর্টাল মেলেনি।");
  if (
    mapped.students.some((s) => s.madrasa_id && s.madrasa_id !== tenant) ||
    (data.active_student &&
      !mapped.students.some((s) => s.id === data.active_student.id))
  )
    throw new Error("শিক্ষার্থী সংযুক্ত নেই।");
  if (portal === "student") {
    const child = data.active_student?.id;
    for (const key of [
      "attendance",
      "feePayments",
      "fees",
      "discounts",
      "examResults",
      "examSummaries",
      "healthRecords",
      "hifzLogs",
      "kitabLogs",
    ] as const) {
      if (mapped[key].some((r) => !child || r.student_id !== child))
        throw new Error("শিক্ষার্থী মেলেনি।");
    }
  }
  if (
    (portal === "teacher" && mapped.healthRecords.length) ||
    mapped.healthRecords.some(
      (r) =>
        !r.id ||
        !statuses.includes(r.status) ||
        !severities.includes(r.severity) ||
        !Array.isArray(r.timeline),
    )
  )
    throw new Error("অসম্পূর্ণ স্বাস্থ্য নথি।");
  return {
    ...mapped,
    emergencyPhone: dialable(String(data.emergency_phone || "")),
    profile: data.profile,
    activeStudent: data.active_student ?? null,
    totalPaid: Number(data.total_paid ?? 0),
    totalDue: Number(data.total_due ?? 0),
  };
}
export type PortalSnapshotData = ReturnType<typeof mapPortalSnapshot>;
