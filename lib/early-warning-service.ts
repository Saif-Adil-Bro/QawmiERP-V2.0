import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError, logAuditEvent } from "@/lib/audit-log";
import {
  getStructuredMadrasaSetting,
  saveStructuredMadrasaSetting,
} from "@/lib/structured-config";
import { toDhakaDateString, toDhakaDateStringFrom } from "@/lib/date-utils";
import { computeStudentRiskScore } from "@/lib/early-warning-engine";
import { dispatchNotification } from "@/lib/notifications/orchestrator";
import type {
  AttendanceDropAlert,
  EarlyWarningSummary,
  ExamScoreDropAlert,
  InterventionStatus,
  RiskDistribution,
  RiskLevel,
  StudentRiskInput,
  StudentRiskScoreRecord,
} from "@/lib/early-warning";
import { toBanglaNumber } from "@/lib/numberToBangla";

const FALLBACK_NAMESPACE = "analytics";
const FALLBACK_KEY = "student_risk_scores";

function resolveClassName(cls: unknown, fallbackClassName?: string | null): string {
  if (fallbackClassName) return fallbackClassName;
  if (!cls) return "সাধারণ জামাত";
  if (Array.isArray(cls)) return String((cls[0] as any)?.name || "সাধারণ জামাত");
  return String((cls as any)?.name || "সাধারণ জামাত");
}

function diffDays(dateA: string, dateB: string): number {
  const a = new Date(`${dateA.slice(0, 10)}T00:00:00Z`).getTime();
  const b = new Date(`${dateB.slice(0, 10)}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((a - b) / (1000 * 60 * 60 * 24)));
}

function isAbsentStatus(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase().trim();
  return s.includes("absent") || s.includes("অনুপস্থিত");
}

function isPoorRating(rating: string | null | undefined): boolean {
  const r = (rating || "").toLowerCase().trim();
  return r === "poor" || r === "weak" || r.includes("দুর্বল");
}

function computeDistribution(records: StudentRiskScoreRecord[]): RiskDistribution {
  const dist: RiskDistribution = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
    total: records.length,
  };
  for (const r of records) {
    if (r.risk_level === "CRITICAL") dist.CRITICAL++;
    else if (r.risk_level === "HIGH") dist.HIGH++;
    else if (r.risk_level === "MEDIUM") dist.MEDIUM++;
    else dist.LOW++;
  }
  return dist;
}

async function readFallbackRiskScores(
  madrasaId: string
): Promise<StudentRiskScoreRecord[]> {
  const res = await getStructuredMadrasaSetting<StudentRiskScoreRecord[]>(
    madrasaId,
    FALLBACK_NAMESPACE,
    FALLBACK_KEY
  );
  return Array.isArray(res.value) ? res.value : [];
}

async function writeFallbackRiskScores(
  madrasaId: string,
  records: StudentRiskScoreRecord[]
): Promise<void> {
  await saveStructuredMadrasaSetting(
    madrasaId,
    FALLBACK_NAMESPACE,
    FALLBACK_KEY,
    records
  );
}

/**
 * Recalculates composite 0–100 dropout & fee-default risk scores for all students
 * in the given madrasa (or filtered by classId) and persists them to `student_risk_scores`
 * (with `isMissingTableError` fallback to `madrasa_settings`).
 */
export async function recalculateStudentRiskScores(
  madrasaId: string,
  opts?: { classId?: string; sectionId?: string }
): Promise<EarlyWarningSummary> {
  const nowIso = new Date().toISOString();
  const todayStr = toDhakaDateString();

  const summary: EarlyWarningSummary = {
    attendance_alerts: [],
    exam_drop_alerts: [],
    total_critical_students: 0,
    checked_at: nowIso,
    risk_scores: [],
    risk_distribution: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0, total: 0 },
  };

  if (!madrasaId) return summary;

  const admin = await createAdminClient();

  // 1. Fetch Students
  let studentQuery = admin
    .from("students")
    .select(
      "id, first_name, last_name, roll_number, class_id, class_name, parent_phone, created_at, classes(id, name)"
    )
    .eq("madrasa_id", madrasaId);

  if (opts?.classId && opts.classId !== "All" && opts.classId !== "all") {
    studentQuery = studentQuery.eq("class_id", opts.classId);
  }
  if (opts?.sectionId && opts.sectionId !== "All" && opts.sectionId !== "all") {
    studentQuery = studentQuery.eq("section_id", opts.sectionId);
  }

  const { data: students, error: studentsErr } = await studentQuery;
  if (studentsErr || !students || students.length === 0) {
    return summary;
  }

  const studentIds = students.map((s) => String(s.id));

  // 2. Parallel Data Fetching (using ONLY verified SQL columns)
  const [
    attendanceRes,
    examResultsRes,
    studentFeesRes,
    waiversRes,
    hifzRes,
    kitabRes,
    madrasaMetaRes,
    existingScoresRes,
  ] = await Promise.all([
    admin
      .from("attendance")
      .select("student_id, date, status")
      .eq("madrasa_id", madrasaId)
      .order("date", { ascending: false }),
    admin
      .from("exam_results")
      .select("exam_id, student_id, marks_obtained, total_marks")
      .eq("madrasa_id", madrasaId),
    admin
      .from("student_fees")
      .select(
        "id, student_id, payable_amount, paid_amount, due_amount, due_date, status"
      )
      .eq("madrasa_id", madrasaId),
    admin
      .from("fee_discount_waivers")
      .select("student_id, discount_type, status")
      .eq("madrasa_id", madrasaId),
    admin
      .from("hifz_logs")
      .select("student_id, log_date, sabak_para, performance_rating")
      .eq("madrasa_id", madrasaId)
      .order("log_date", { ascending: false }),
    admin
      .from("kitab_logs")
      .select("student_id, log_date, performance_rating")
      .eq("madrasa_id", madrasaId)
      .order("log_date", { ascending: false }),
    admin
      .from("madrasas")
      .select("metadata")
      .eq("id", madrasaId)
      .maybeSingle(),
    admin
      .from("student_risk_scores")
      .select("student_id, intervention_status, intervention_notes, intervened_by, intervened_at")
      .eq("madrasa_id", madrasaId),
  ]);

  // Preserve existing intervention tracking
  const existingInterventionMap = new Map<
    string,
    {
      intervention_status: InterventionStatus;
      intervention_notes?: string | null;
      intervened_by?: string | null;
      intervened_at?: string | null;
    }
  >();
  if (!existingScoresRes.error && Array.isArray(existingScoresRes.data)) {
    for (const row of existingScoresRes.data) {
      existingInterventionMap.set(String(row.student_id), {
        intervention_status: (row.intervention_status || "PENDING") as InterventionStatus,
        intervention_notes: row.intervention_notes || null,
        intervened_by: row.intervened_by || null,
        intervened_at: row.intervened_at || null,
      });
    }
  } else if (existingScoresRes.error && isMissingTableError(existingScoresRes.error)) {
    const fbExisting = await readFallbackRiskScores(madrasaId);
    for (const row of fbExisting) {
      existingInterventionMap.set(String(row.student_id), {
        intervention_status: row.intervention_status || "PENDING",
        intervention_notes: row.intervention_notes || null,
        intervened_by: row.intervened_by || null,
        intervened_at: row.intervened_at || null,
      });
    }
  }

  // Group attendance by student
  const attendanceByStudent = new Map<string, { date: string; status: string }[]>();
  for (const rec of attendanceRes.data || []) {
    const sid = String(rec.student_id);
    if (!attendanceByStudent.has(sid)) attendanceByStudent.set(sid, []);
    attendanceByStudent.get(sid)!.push({ date: String(rec.date), status: String(rec.status || "") });
  }

  // Group exam results by student using latest 2 exams
  const allExamResults = examResultsRes.data || [];
  let currentExam: { id: string; title: string } | null = null;
  let previousExam: { id: string; title: string } | null = null;
  const studentExamStats = new Map<
    string,
    { prevPct?: number; currPct?: number; count: number }
  >();

  if (allExamResults.length > 0) {
    const examIds = Array.from(new Set(allExamResults.map((r) => String(r.exam_id))));
    const { data: exams } = await admin
      .from("exams")
      .select("id, title, start_date, created_at")
      .in("id", examIds)
      .order("created_at", { ascending: false });

    const countByStudent = new Map<string, number>();
    for (const r of allExamResults) {
      const sid = String(r.student_id);
      countByStudent.set(sid, (countByStudent.get(sid) || 0) + 1);
    }

    if (exams && exams.length >= 1) {
      currentExam = { id: String(exams[0].id), title: String(exams[0].title || "সাম্প্রতিক পরীক্ষা") };
      if (exams.length >= 2) {
        previousExam = { id: String(exams[1].id), title: String(exams[1].title || "পূর্ববর্তী পরীক্ষা") };
      }

      const calcPctMap = (examId: string) => {
        const totals = new Map<string, { obt: number; max: number }>();
        for (const r of allExamResults) {
          if (String(r.exam_id) !== examId) continue;
          const sid = String(r.student_id);
          const cur = totals.get(sid) || { obt: 0, max: 0 };
          cur.obt += Number(r.marks_obtained || 0);
          cur.max += Number(r.total_marks || 100);
          totals.set(sid, cur);
        }
        const pct = new Map<string, number>();
        totals.forEach((v, k) => {
          if (v.max > 0) pct.set(k, (v.obt / v.max) * 100);
        });
        return pct;
      };

      const currPctMap = calcPctMap(currentExam.id);
      const prevPctMap = previousExam ? calcPctMap(previousExam.id) : new Map<string, number>();

      for (const sid of studentIds) {
        studentExamStats.set(sid, {
          currPct: currPctMap.get(sid),
          prevPct: prevPctMap.get(sid),
          count: countByStudent.get(sid) || 0,
        });
      }
    }
  }

  // Group fees & waivers by student
  const waivedStudents = new Set<string>();
  for (const w of waiversRes.data || []) {
    const status = String(w.status || "").toUpperCase();
    const dtype = String(w.discount_type || "").toUpperCase();
    if (status === "APPROVED" && dtype === "FULL_WAIVER") {
      waivedStudents.add(String(w.student_id));
    }
  }

  const feeStatsByStudent = new Map<
    string,
    { overdueCount: number; overdueAmount: number; totalPayable: number; maxOverdueDays: number; allPaid: boolean }
  >();
  for (const f of studentFeesRes.data || []) {
    const sid = String(f.student_id);
    const cur = feeStatsByStudent.get(sid) || {
      overdueCount: 0,
      overdueAmount: 0,
      totalPayable: 0,
      maxOverdueDays: 0,
      allPaid: true,
    };
    const payable = Number(f.payable_amount || 0);
    const due = Number(f.due_amount ?? Math.max(0, payable - Number(f.paid_amount || 0)));
    const status = String(f.status || "").toUpperCase();
    cur.totalPayable += payable;

    if (status !== "PAID" && status !== "WAIVED" && due > 0) {
      cur.allPaid = false;
      const dueDateStr = f.due_date ? String(f.due_date).slice(0, 10) : "";
      const daysOverdue = dueDateStr && dueDateStr < todayStr ? diffDays(todayStr, dueDateStr) : 0;
      if (daysOverdue > 0 || status === "OVERDUE" || status === "UNPAID" || status === "PARTIAL") {
        cur.overdueCount += 1;
        cur.overdueAmount += due;
        if (daysOverdue > cur.maxOverdueDays) cur.maxOverdueDays = daysOverdue;
      }
    }
    feeStatsByStudent.set(sid, cur);
  }

  // Group Hifz & Kitab logs by student
  const hifzByStudent = new Map<string, { sabakPaused: boolean; poorCount: number }>();
  for (const h of hifzRes.data || []) {
    const sid = String(h.student_id);
    const cur = hifzByStudent.get(sid) || { sabakPaused: false, poorCount: 0 };
    if (h.sabak_para === null || h.sabak_para === undefined || Number(h.sabak_para) === 0) {
      cur.sabakPaused = true;
    }
    if (isPoorRating(h.performance_rating)) {
      cur.poorCount += 1;
    }
    hifzByStudent.set(sid, cur);
  }

  const kitabByStudent = new Map<string, { poorCount: number }>();
  for (const k of kitabRes.data || []) {
    const sid = String(k.student_id);
    const cur = kitabByStudent.get(sid) || { poorCount: 0 };
    if (isPoorRating(k.performance_rating)) {
      cur.poorCount += 1;
    }
    kitabByStudent.set(sid, cur);
  }

  const nooraniMap: Record<string, any> =
    (madrasaMetaRes.data?.metadata as any)?.noorani_progress || {};

  // 3. Compute Risk Score per Student
  const computedRecords: StudentRiskScoreRecord[] = [];
  const attAlerts: AttendanceDropAlert[] = [];
  const examAlerts: ExamScoreDropAlert[] = [];

  for (const student of students) {
    const sid = String(student.id);
    const fullName = `${student.first_name || ""} ${student.last_name || ""}`.trim() || "নামহীন শিক্ষার্থী";
    const className = resolveClassName(student.classes, student.class_name);
    const createdDateStr = student.created_at ? toDhakaDateStringFrom(student.created_at) : todayStr;
    const daysSinceAdmission = diffDays(todayStr, createdDateStr);

    // Attendance metrics
    const logs = (attendanceByStudent.get(sid) || []).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
    let consecutiveAbsences = 0;
    const absentDates: string[] = [];
    let lastPresentDate: string | undefined;
    for (const entry of logs) {
      if (isAbsentStatus(entry.status)) {
        consecutiveAbsences++;
        absentDates.push(entry.date);
      } else {
        lastPresentDate = entry.date;
        break;
      }
    }

    const last30Logs = logs.filter((l) => diffDays(todayStr, l.date) <= 30);
    const absentDays30d = last30Logs.filter((l) => isAbsentStatus(l.status)).length;
    const attendanceRate30d =
      last30Logs.length > 0
        ? ((last30Logs.length - absentDays30d) / last30Logs.length) * 100
        : null;

    if (consecutiveAbsences >= 3) {
      attAlerts.push({
        student_id: sid,
        student_name: fullName,
        roll_number: student.roll_number || "",
        class_id: student.class_id || undefined,
        class_name: className,
        parent_phone: student.parent_phone || "",
        consecutive_absent_days: consecutiveAbsences,
        last_absent_dates: absentDates.slice(0, 5),
        last_present_date: lastPresentDate,
        alert_level: consecutiveAbsences >= 5 ? "CRITICAL" : "HIGH",
        remarks: `পরপর ${toBanglaNumber(consecutiveAbsences)} দিন মাদরাসায় অনুপস্থিত। অভিভাবকের সাথে অবিলম্বে যোগাযোগ প্রয়োজন।`,
      });
    }

    // Exam metrics
    const ex = studentExamStats.get(sid);
    if (
      ex &&
      ex.prevPct !== undefined &&
      ex.currPct !== undefined &&
      currentExam &&
      previousExam
    ) {
      const drop = ex.prevPct - ex.currPct;
      if (drop >= 15) {
        examAlerts.push({
          student_id: sid,
          student_name: fullName,
          roll_number: student.roll_number || "",
          class_id: student.class_id || undefined,
          class_name: className,
          parent_phone: student.parent_phone || "",
          previous_exam_id: previousExam.id,
          previous_exam_title: previousExam.title,
          previous_percentage: Number(ex.prevPct.toFixed(1)),
          current_exam_id: currentExam.id,
          current_exam_title: currentExam.title,
          current_percentage: Number(ex.currPct.toFixed(1)),
          drop_percentage: Number(drop.toFixed(1)),
          alert_level: drop >= 25 ? "CRITICAL" : "HIGH",
        });
      }
    }

    // Fee metrics
    const fee = feeStatsByStudent.get(sid);
    const isWaived = waivedStudents.has(sid);

    // Hifz / Kitab / Noorani metrics
    const hifz = hifzByStudent.get(sid);
    const kitab = kitabByStudent.get(sid);
    const noorani = nooraniMap[sid];
    const nooraniStalledDays = noorani?.updatedAt
      ? diffDays(todayStr, toDhakaDateStringFrom(noorani.updatedAt))
      : 0;
    const nooraniWeakCount = Array.isArray(noorani?.makhrajWeaknesses)
      ? noorani.makhrajWeaknesses.length
      : 0;

    const riskInput: StudentRiskInput = {
      studentId: sid,
      studentName: fullName,
      daysSinceAdmission,
      consecutiveAbsences,
      attendanceRate30d,
      absentDays30d,
      attendanceRecordsCount: logs.length,
      previousExamAvg: ex?.prevPct ?? null,
      recentExamAvg: ex?.currPct ?? null,
      examRecordsCount: ex?.count ?? 0,
      hifzSabakPaused: hifz?.sabakPaused ?? false,
      hifzPoorRatingCount: hifz?.poorCount ?? 0,
      kitabPoorRatingCount: kitab?.poorCount ?? 0,
      nooraniStalledDays: noorani ? nooraniStalledDays : 0,
      nooraniMakhrajWeaknessCount: nooraniWeakCount,
      overdueInvoiceCount: fee?.overdueCount ?? 0,
      overdueDays: fee?.maxOverdueDays ?? 0,
      overdueAmount: fee?.overdueAmount ?? 0,
      totalPayableAmount: fee?.totalPayable ?? 0,
      isWaived,
      feeStatus: isWaived ? "WAIVED" : fee?.allPaid ? "PAID" : undefined,
    };

    const computed = computeStudentRiskScore(riskInput);
    const prevIntervention = existingInterventionMap.get(sid);

    computedRecords.push({
      madrasa_id: madrasaId,
      student_id: sid,
      class_id: student.class_id || null,
      class_name: className,
      student_name: fullName,
      roll_number: student.roll_number || null,
      parent_phone: student.parent_phone || null,
      composite_score: computed.compositeScore,
      risk_level: computed.riskLevel,
      attendance_score: computed.attendanceScore,
      academic_score: computed.academicScore,
      fee_score: computed.feeScore,
      factors: computed.factors,
      recommendations: computed.recommendations,
      intervention_status: prevIntervention?.intervention_status || "PENDING",
      intervention_notes: prevIntervention?.intervention_notes || null,
      intervened_by: prevIntervention?.intervened_by || null,
      intervened_at: prevIntervention?.intervened_at || null,
      last_calculated_at: nowIso,
      updated_at: nowIso,
    });
  }

  // Sort descending by composite_score
  computedRecords.sort((a, b) => b.composite_score - a.composite_score);

  // 4. Persist to `student_risk_scores` (with `isMissingTableError` fallback)
  try {
    const upsertRows = computedRecords.map((r) => ({
      madrasa_id: r.madrasa_id,
      student_id: r.student_id,
      class_id: r.class_id || null,
      class_name: r.class_name || null,
      student_name: r.student_name || null,
      roll_number: r.roll_number || null,
      parent_phone: r.parent_phone || null,
      composite_score: r.composite_score,
      risk_level: r.risk_level,
      attendance_score: r.attendance_score,
      academic_score: r.academic_score,
      fee_score: r.fee_score,
      factors: r.factors,
      recommendations: r.recommendations,
      intervention_status: r.intervention_status,
      last_calculated_at: r.last_calculated_at,
      updated_at: r.updated_at,
    }));

    if (upsertRows.length > 0) {
      const { error: upsertErr } = await admin
        .from("student_risk_scores")
        .upsert(upsertRows, { onConflict: "madrasa_id,student_id" });

      if (upsertErr) {
        if (isMissingTableError(upsertErr)) {
          await writeFallbackRiskScores(madrasaId, computedRecords);
        } else {
          console.error("Failed to upsert student_risk_scores:", upsertErr.message);
        }
      }
    }
  } catch (err) {
    console.warn("student_risk_scores persistence fallback:", err);
    await writeFallbackRiskScores(madrasaId, computedRecords);
  }

  const distribution = computeDistribution(computedRecords);
  const criticalSet = new Set([
    ...attAlerts.map((a) => a.student_id),
    ...examAlerts.map((e) => e.student_id),
    ...computedRecords
      .filter((r) => r.risk_level === "CRITICAL" || r.risk_level === "HIGH")
      .map((r) => r.student_id),
  ]);

  summary.attendance_alerts = attAlerts;
  summary.exam_drop_alerts = examAlerts;
  summary.risk_scores = computedRecords;
  summary.risk_distribution = distribution;
  summary.total_critical_students = criticalSet.size;

  return summary;
}

/**
 * Fetches persisted student risk scores for a single madrasa, sorted descending by composite_score.
 */
export async function getStudentRiskScores(
  madrasaId: string,
  filters?: { riskLevel?: string; classId?: string; limit?: number }
): Promise<StudentRiskScoreRecord[]> {
  if (!madrasaId) return [];

  try {
    const admin = await createAdminClient();
    let query = admin
      .from("student_risk_scores")
      .select("*")
      .eq("madrasa_id", madrasaId)
      .order("composite_score", { ascending: false });

    if (filters?.riskLevel && filters.riskLevel !== "ALL") {
      query = query.eq("risk_level", filters.riskLevel.toUpperCase());
    }
    if (filters?.classId && filters.classId !== "All" && filters.classId !== "all") {
      query = query.eq("class_id", filters.classId);
    }
    if (filters?.limit && filters.limit > 0) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((row: any) => ({
        ...row,
        composite_score: Number(row.composite_score || 0),
        attendance_score: Number(row.attendance_score || 0),
        academic_score: Number(row.academic_score || 0),
        fee_score: Number(row.fee_score || 0),
        factors: Array.isArray(row.factors) ? row.factors : [],
        recommendations: Array.isArray(row.recommendations) ? row.recommendations : [],
        intervention_status: (row.intervention_status || "PENDING") as InterventionStatus,
      }));
    }

    if (error && !isMissingTableError(error)) {
      console.error("getStudentRiskScores error:", error.message);
    }
  } catch {
    // fallback below
  }

  let list = await readFallbackRiskScores(madrasaId);
  list = list.filter((r) => r.madrasa_id === madrasaId);

  if (list.length === 0 && (!filters?.riskLevel || filters.riskLevel === "ALL")) {
    try {
      const recalc = await recalculateStudentRiskScores(madrasaId, {
        classId: filters?.classId,
      });
      list = Array.isArray(recalc.risk_scores) ? [...recalc.risk_scores] : [];
    } catch (e) {
      console.error("Auto recalculateStudentRiskScores failed:", e);
    }
  }

  if (filters?.riskLevel && filters.riskLevel !== "ALL") {
    const target = filters.riskLevel.toUpperCase();
    list = list.filter((r) => r.risk_level === target);
  }
  if (filters?.classId && filters.classId !== "All" && filters.classId !== "all") {
    list = list.filter((r) => r.class_id === filters.classId);
  }
  list.sort((a, b) => b.composite_score - a.composite_score);
  if (filters?.limit && filters.limit > 0) {
    list = list.slice(0, filters.limit);
  }
  return list;
}

/**
 * Resolves a `student_id` from a `student_risk_scores` row ID, strictly scoped to `madrasaId`,
 * with fallback store support when `student_risk_scores` table is missing.
 */
export async function resolveStudentIdByRiskScoreId(
  madrasaId: string,
  riskScoreId: string
): Promise<string | null> {
  if (!madrasaId || !riskScoreId) return null;

  const admin = await createAdminClient();
  try {
    const { data, error } = await admin
      .from("student_risk_scores")
      .select("student_id")
      .eq("madrasa_id", madrasaId)
      .eq("id", riskScoreId)
      .maybeSingle();

    if (!error && data?.student_id) {
      return String(data.student_id);
    }
    if (error && !isMissingTableError(error)) {
      return null;
    }
  } catch {
    // fallback below
  }

  const fb = await readFallbackRiskScores(madrasaId);
  const match = fb.find(
    (r) => r.madrasa_id === madrasaId && r.id === riskScoreId
  );
  return match?.student_id ? String(match.student_id) : null;
}

/**
 * Updates intervention status/notes for a student's risk record, optionally dispatches
 * a Bangla guardian notification via the Feature 2.2 orchestrator, and logs an audit event.
 */
export async function updateRiskIntervention(
  madrasaId: string,
  studentId: string,
  update: {
    status: InterventionStatus;
    notes?: string;
    actorId?: string | null;
    actorName?: string | null;
    notifyGuardian?: boolean;
  }
): Promise<{
  ok: boolean;
  record?: StudentRiskScoreRecord;
  notificationSent?: boolean;
  error?: string;
}> {
  if (!madrasaId || !studentId) {
    return { ok: false, error: "মাদ্রাসা ও শিক্ষার্থী আইডি প্রয়োজন।" };
  }

  const nowIso = new Date().toISOString();
  const admin = await createAdminClient();
  let updatedRecord: StudentRiskScoreRecord | undefined;

  try {
    const { data, error } = await admin
      .from("student_risk_scores")
      .update({
        intervention_status: update.status,
        intervention_notes: update.notes ?? null,
        intervened_by: update.actorId || null,
        intervened_at: nowIso,
        updated_at: nowIso,
      })
      .eq("madrasa_id", madrasaId)
      .eq("student_id", studentId)
      .select("*")
      .maybeSingle();

    if (!error && data) {
      updatedRecord = {
        ...data,
        composite_score: Number(data.composite_score || 0),
        attendance_score: Number(data.attendance_score || 0),
        academic_score: Number(data.academic_score || 0),
        fee_score: Number(data.fee_score || 0),
        factors: Array.isArray(data.factors) ? data.factors : [],
        recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
      } as StudentRiskScoreRecord;
    } else if (error && isMissingTableError(error)) {
      const fb = await readFallbackRiskScores(madrasaId);
      const idx = fb.findIndex(
        (r) => r.madrasa_id === madrasaId && r.student_id === studentId
      );
      if (idx >= 0) {
        fb[idx] = {
          ...fb[idx],
          intervention_status: update.status,
          intervention_notes: update.notes ?? fb[idx].intervention_notes ?? null,
          intervened_by: update.actorId || null,
          intervened_at: nowIso,
          updated_at: nowIso,
        };
        updatedRecord = fb[idx];
        await writeFallbackRiskScores(madrasaId, fb);
      }
    } else if (error) {
      return { ok: false, error: error.message };
    }
  } catch (err: any) {
    return { ok: false, error: err?.message || "ইন্টারভেনশন আপডেট ব্যর্থ হয়েছে।" };
  }

  // Fallback: fetch student details if record was not in student_risk_scores yet
  if (!updatedRecord) {
    const { data: student } = await admin
      .from("students")
      .select("id, first_name, last_name, roll_number, class_id, class_name, parent_phone")
      .eq("madrasa_id", madrasaId)
      .eq("id", studentId)
      .maybeSingle();

    if (student) {
      updatedRecord = {
        madrasa_id: madrasaId,
        student_id: studentId,
        class_id: student.class_id || null,
        class_name: student.class_name || "সাধারণ জামাত",
        student_name: `${student.first_name || ""} ${student.last_name || ""}`.trim(),
        roll_number: student.roll_number || null,
        parent_phone: student.parent_phone || null,
        composite_score: 0,
        risk_level: "LOW",
        attendance_score: 0,
        academic_score: 0,
        fee_score: 0,
        factors: [],
        recommendations: [],
        intervention_status: update.status,
        intervention_notes: update.notes || null,
        intervened_by: update.actorId || null,
        intervened_at: nowIso,
        last_calculated_at: nowIso,
      };
    }
  }

  let notificationSent = false;
  if (update.notifyGuardian && updatedRecord?.parent_phone) {
    const studentName = updatedRecord.student_name || "শিক্ষার্থী";
    const factorsText =
      updatedRecord.factors?.slice(0, 2).join(" এবং ") ||
      "নিয়মিত উপস্থিতি ও পড়াশোনার অগ্রগতি";
    const message = `সম্মানিত অভিভাবক, আপনার সন্তান ${studentName} (${updatedRecord.class_name || "মাদরাসা"}) সম্পর্কে জরুরি সতর্কতা: ${factorsText}। অনুগ্রহ করে মাদরাসা কর্তৃপক্ষের সাথে যোগাযোগ করুন।`;

    const dispatchRes = await dispatchNotification("early_warning_alert", {
      madrasaId,
      recipientStudentId: studentId,
      recipientPhone: updatedRecord.parent_phone,
      subject: "শিক্ষার্থী আর্লি ওয়ার্নিং সতর্কবার্তা",
      body: message,
      variables: {
        StudentName: studentName,
        ClassName: updatedRecord.class_name || "",
        RiskLevel: updatedRecord.risk_level,
      },
      actorId: update.actorId || null,
      metadata: {
        source: "early_warning_intervention",
        riskLevel: updatedRecord.risk_level,
        compositeScore: updatedRecord.composite_score,
      },
    });
    notificationSent = dispatchRes.ok;
  }

  await logAuditEvent({
    madrasaId,
    actorId: update.actorId || null,
    actorName: update.actorName || null,
    module: "analytics",
    action: "EARLY_WARNING_INTERVENTION",
    entityType: "student_risk_scores",
    entityId: studentId,
    entityLabel: updatedRecord?.student_name || studentId,
    summary: `শিক্ষার্থী ইন্টারভেনশন আপডেট (${update.status})${notificationSent ? " ও অভিভাবককে নোটিফিকেশন পাঠানো হয়েছে" : ""}`,
    metadata: {
      status: update.status,
      notes: update.notes || null,
      notifyGuardian: Boolean(update.notifyGuardian),
      notificationSent,
    },
    severity: "INFO",
  });

  return { ok: true, record: updatedRecord, notificationSent };
}
