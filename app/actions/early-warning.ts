"use server";
import {getMadrasaMetadata} from '@/lib/sessions';
import {getFeeMetadata} from '@/lib/fee-store';
import {studentRoles} from '@/lib/portal/rules';
import {webIdentity,hasRole,webTeacher} from '@/lib/portal/identity';

import {
  createClient,
  createAdminClient,
  getAuthUser,
} from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import {
  EarlyWarningSummary,
  InterventionStatus,
  StudentRiskScoreRecord,
} from "@/lib/early-warning";
import {
  getCurrentUserMaskingContext,
  maskPhoneNumber,
} from "@/lib/data-access-guards";
import { writeGuard } from "@/lib/action-authorization";
import {
  getStudentRiskScores,
  recalculateStudentRiskScores,
  updateRiskIntervention,
} from "@/lib/early-warning-service";

function applyPhoneMaskingToSummary(
  summary: EarlyWarningSummary,
  allowUnmasked: boolean
): EarlyWarningSummary {
  if (allowUnmasked) return summary;
  return {
    ...summary,
    attendance_alerts: summary.attendance_alerts.map((a) => ({
      ...a,
      parent_phone: a.parent_phone ? maskPhoneNumber(a.parent_phone) : "",
    })),
    exam_drop_alerts: summary.exam_drop_alerts.map((e) => ({
      ...e,
      parent_phone: e.parent_phone ? maskPhoneNumber(e.parent_phone) : "",
    })),
    risk_scores: summary.risk_scores?.map((r) => ({
      ...r,
      parent_phone: r.parent_phone ? maskPhoneNumber(r.parent_phone) : null,
    })),
  };
}

export async function getEarlyWarningAlerts(
  classId?: string,
  sectionId?: string
): Promise<EarlyWarningSummary> {
  const result: EarlyWarningSummary = {
    attendance_alerts: [],
    exam_drop_alerts: [],
    total_critical_students: 0,
    checked_at: new Date().toISOString(),
  };

  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);

    const i = await webIdentity();
    if (!i || !madrasaId || hasRole(i,studentRoles)) return result;

    const masking = await getCurrentUserMaskingContext("students", "phone");
    const allowUnmasked = masking.allowUnmasked === true;

    // 1. Fetch Students with Class / Section Filter
    let studentQuery = adminClient
      .from("students")
      .select(
        "*, classes(id, name)"
      )
      .eq("madrasa_id", madrasaId);

    const teacher = await webTeacher();
    if (teacher) {
      if (!teacher.scope.classes.length) return result;
      studentQuery = studentQuery.in('class_id',teacher.scope.classes.map(c=>c.id));
    }
    if (classId && classId !== "All" && classId !== "all") {
      studentQuery = studentQuery.eq("class_id", classId);
    }


    const { data: studentRows, error: studentsError } = await studentQuery;
    const section = sectionId && !['All','all'].includes(sectionId) && sectionId;
    const profiles = section ? (teacher?.scope.meta || await getMadrasaMetadata(madrasaId)).student_profiles : undefined;
    const students = section ? studentRows?.filter(s=>[profiles?.[s.id]?.section_id,profiles?.[s.id]?.section,(s as any).section_id,(s as any).section].includes(section)) : studentRows;

    if (studentsError || !students || students.length === 0) {
      return result;
    }

    const resolveClassName = (cls: any) => {
      if (!cls) return "সাধারণ জামাত";
      if (Array.isArray(cls)) return cls[0]?.name || "সাধারণ জামাত";
      return cls?.name || "সাধারণ জামাত";
    };

    const studentMap = new Map(
      students.map((s) => [
        s.id,
        {
          id: s.id,
          name: `${s.first_name || ""} ${s.last_name || ""}`.trim(),
          roll_number: s.roll_number || "",
          class_id: s.class_id,
          class_name: resolveClassName(s.classes),
          parent_phone: s.parent_phone || "",
        },
      ])
    );

    // 2. Attendance Drop Calculation (Check consecutive 3 or more absent days)
    const { data: recentAttendance } = await adminClient
      .from("attendance")
      .select("date, student_id, status")
      .eq("madrasa_id", madrasaId)
      .order("date", { ascending: false });

    if (recentAttendance && recentAttendance.length > 0) {
      const studentAttendance = new Map<
        string,
        { date: string; status: string }[]
      >();

      for (const rec of recentAttendance) {
        if (!studentAttendance.has(rec.student_id)) {
          studentAttendance.set(rec.student_id, []);
        }
        studentAttendance
          .get(rec.student_id)!
          .push({ date: rec.date, status: rec.status });
      }

      studentAttendance.forEach(
        (logs: { date: string; status: string }[], studentId: string) => {
          const studentInfo = studentMap.get(studentId);
          if (!studentInfo) return;

          logs.sort(
            (a: { date: string }, b: { date: string }) =>
              new Date(b.date).getTime() - new Date(a.date).getTime()
          );

          let consecutiveAbsent = 0;
          const absentDates: string[] = [];
          let lastPresentDate: string | undefined;

          for (const entry of logs) {
            const statusLower = (entry.status || "").toLowerCase().trim();
            if (
              statusLower.includes("absent") ||
              statusLower.includes("অনুপস্থিত")
            ) {
              consecutiveAbsent++;
              absentDates.push(entry.date);
            } else {
              lastPresentDate = entry.date;
              break;
            }
          }

          if (consecutiveAbsent >= 3) {
            result.attendance_alerts.push({
              student_id: studentId,
              student_name: studentInfo.name,
              roll_number: studentInfo.roll_number,
              class_id: studentInfo.class_id,
              class_name: studentInfo.class_name,
              parent_phone: studentInfo.parent_phone,
              consecutive_absent_days: consecutiveAbsent,
              last_absent_dates: absentDates.slice(0, 5),
              last_present_date: lastPresentDate,
              alert_level: consecutiveAbsent >= 5 ? "CRITICAL" : "HIGH",
              remarks: `পরপর ${consecutiveAbsent} দিন মাদরাসায় অনুপস্থিত। অভিভাবকের সাথে অবিলম্বে যোগাযোগ প্রয়োজন।`,
            });
          }
        }
      );
    }

    // 3. Exam Score Drop Calculation
    const { data: allExamResults } = await adminClient
      .from("exam_results")
      .select("exam_id, student_id, marks_obtained, total_marks, subject_name")
      .eq("madrasa_id", madrasaId);

    if (allExamResults && allExamResults.length > 0) {
      const examIdsWithResults = Array.from(
        new Set(allExamResults.map((r) => r.exam_id))
      );

      const { data: exams } = await adminClient
        .from("exams")
        .select("id, title, start_date, created_at")
        .in("id", examIdsWithResults)
        .order("created_at", { ascending: false });

      if (exams && exams.length >= 2) {
        const currentExam = exams[0];
        const previousExam = exams[1];

        const currentResults = allExamResults.filter(
          (r) => r.exam_id === currentExam.id
        );
        const previousResults = allExamResults.filter(
          (r) => r.exam_id === previousExam.id
        );

        if (currentResults.length > 0 && previousResults.length > 0) {
          const prevStats = new Map<
            string,
            { totalObtained: number; totalMax: number }
          >();
          for (const r of previousResults) {
            if (!prevStats.has(r.student_id)) {
              prevStats.set(r.student_id, { totalObtained: 0, totalMax: 0 });
            }
            const s = prevStats.get(r.student_id)!;
            s.totalObtained += Number(r.marks_obtained || 0);
            s.totalMax += Number(r.total_marks || 100);
          }

          const currStats = new Map<
            string,
            { totalObtained: number; totalMax: number }
          >();
          for (const r of currentResults) {
            if (!currStats.has(r.student_id)) {
              currStats.set(r.student_id, { totalObtained: 0, totalMax: 0 });
            }
            const s = currStats.get(r.student_id)!;
            s.totalObtained += Number(r.marks_obtained || 0);
            s.totalMax += Number(r.total_marks || 100);
          }

          prevStats.forEach(
            (
              prev: { totalObtained: number; totalMax: number },
              studentId: string
            ) => {
              const curr = currStats.get(studentId);
              if (!curr || prev.totalMax === 0 || curr.totalMax === 0) return;

              const prevPct = (prev.totalObtained / prev.totalMax) * 100;
              const currPct = (curr.totalObtained / curr.totalMax) * 100;
              const drop = prevPct - currPct;

              if (drop >= 15) {
                const studentInfo = studentMap.get(studentId);
                if (!studentInfo) return;

                result.exam_drop_alerts.push({
                  student_id: studentId,
                  student_name: studentInfo.name,
                  roll_number: studentInfo.roll_number,
                  class_id: studentInfo.class_id,
                  class_name: studentInfo.class_name,
                  parent_phone: studentInfo.parent_phone,
                  previous_exam_id: previousExam.id,
                  previous_exam_title: previousExam.title,
                  previous_percentage: Number(prevPct.toFixed(1)),
                  current_exam_id: currentExam.id,
                  current_exam_title: currentExam.title,
                  current_percentage: Number(currPct.toFixed(1)),
                  drop_percentage: Number(drop.toFixed(1)),
                  alert_level: drop >= 25 ? "CRITICAL" : "HIGH",
                });
              }
            }
          );
        }
      }
    }

    const rollSort = (a: { roll_number?: string }, b: { roll_number?: string }) =>
      (parseInt(a.roll_number || "999999") || 999999) -
      (parseInt(b.roll_number || "999999") || 999999);

    result.attendance_alerts.sort(rollSort);
    result.exam_drop_alerts.sort(rollSort);

    const criticalStudentIds = new Set([
      ...result.attendance_alerts.map((a) => a.student_id),
      ...result.exam_drop_alerts.map((e) => e.student_id),
    ]);
    result.total_critical_students = criticalStudentIds.size;

    // Attach persisted composite risk scores if available
    const allPersistedScores = (await getStudentRiskScores(madrasaId, { classId })).filter((s) =>
      studentMap.has(s.student_id)
    );

    // Also inspect unpaid/overdue fee invoices and SQL/metadata student_fees / fees for students in scope (PB-04 & N11)
    const metaForFees = teacher?.scope.meta || (await getMadrasaMetadata(madrasaId));
    const dueByStudent = new Map<string, number>();

    const scopedIds = Array.from(studentMap.keys());
    const [{ data: studentFeesRows }, { data: sqlFees }, feeBook] = await Promise.all([
      adminClient
        .from("student_fees")
        .select("id, student_id, payable_amount, paid_amount, due_amount, status")
        .eq("madrasa_id", madrasaId)
        .in("student_id", scopedIds),
      adminClient
        .from("fees")
        .select("student_id, amount, paid_amount, status")
        .eq("madrasa_id", madrasaId)
        .in("student_id", scopedIds),
      getFeeMetadata(madrasaId).catch(() => ({ student_fees: [] as any[] })),
    ]);

    const seenFeeIds = new Set<string>();
    for (const sf of studentFeesRows || []) {
      if (!sf?.student_id) continue;
      if (sf.id) seenFeeIds.add(String(sf.id));
      const stStatus = String(sf.status || "").toUpperCase();
      if (stStatus === "PAID" || stStatus === "WAIVED") continue;
      const payable = Number(sf.payable_amount || 0);
      const paid = Number(sf.paid_amount || 0);
      const due = Math.max(0, Number(sf.due_amount ?? payable - paid));
      if (due > 0) {
        dueByStudent.set(sf.student_id, (dueByStudent.get(sf.student_id) || 0) + due);
      }
    }

    // Merge canonical fee-store / metadata student_fees (deduplicated by fee id)
    const metaStudentFees: any[] = Array.isArray((feeBook as any)?.student_fees)
      ? (feeBook as any).student_fees
      : Array.isArray((metaForFees as any)?.student_fees)
        ? (metaForFees as any).student_fees
        : [];
    for (const sf of metaStudentFees) {
      if (!sf?.student_id || !studentMap.has(sf.student_id)) continue;
      if (sf.id && seenFeeIds.has(String(sf.id))) continue;
      if (sf.id) seenFeeIds.add(String(sf.id));
      const stStatus = String(sf.status || "").toUpperCase();
      if (stStatus === "PAID" || stStatus === "WAIVED") continue;
      const payable = Number(sf.payable_amount ?? sf.amount ?? 0);
      const paid = Number(sf.paid_amount ?? 0);
      const due = Math.max(0, Number(sf.due_amount ?? Math.max(0, payable - paid)));
      if (due > 0) {
        dueByStudent.set(sf.student_id, (dueByStudent.get(sf.student_id) || 0) + due);
      }
    }

    const invoices: any[] = Array.isArray(metaForFees?.fee_invoices) ? metaForFees.fee_invoices : [];
    for (const inv of invoices) {
      if (!inv?.student_id || !studentMap.has(inv.student_id)) continue;
      if (inv.status === "PAID" || inv.status === "WAIVED") continue;
      const due = Math.max(
        0,
        Number(inv.due_amount ?? (Number(inv.net_payable ?? inv.total_amount ?? 0) - Number(inv.paid_amount ?? 0)))
      );
      if (due > 0 && !dueByStudent.has(inv.student_id)) {
        dueByStudent.set(inv.student_id, (dueByStudent.get(inv.student_id) || 0) + due);
      }
    }

    for (const f of sqlFees || []) {
      if (!f?.student_id || f.status === "PAID" || f.status === "paid") continue;
      const due = Math.max(0, Number(f.amount || 0) - Number(f.paid_amount || 0));
      if (due > 0 && !dueByStudent.has(f.student_id)) {
        dueByStudent.set(f.student_id, (dueByStudent.get(f.student_id) || 0) + due);
      }
    }

    const nowIso = new Date().toISOString();
    const scoreByStudent = new Map<string, StudentRiskScoreRecord>();
    for (const s of allPersistedScores) {
      const st = studentMap.get(s.student_id);
      scoreByStudent.set(s.student_id, {
        ...s,
        class_name: s.class_name || st?.class_name || null,
        student_name: s.student_name || st?.name || null,
        roll_number: s.roll_number || st?.roll_number || null,
      });
    }

    // Ensure every active student in scope has a baseline record so total analyzed matches active student count (11 for admin, 3 for teacher)
    studentMap.forEach((st, studentId) => {
      if (!scoreByStudent.has(studentId)) {
        scoreByStudent.set(studentId, {
          id: `risk_${studentId}`,
          madrasa_id: madrasaId,
          student_id: studentId,
          student_name: st.name,
          roll_number: st.roll_number || null,
          class_id: st.class_id || null,
          class_name: st.class_name || null,
          parent_phone: st.parent_phone || null,
          attendance_score: 0,
          academic_score: 0,
          fee_score: 0,
          composite_score: 0,
          risk_level: "LOW",
          factors: ["স্বাভাবিক একাডেমিক ও হাজিরা অগ্রগতি"],
          recommendations: ["নিয়মিত পর্যবেক্ষণ অব্যাহত রাখুন।"],
          intervention_status: "PENDING",
          last_calculated_at: nowIso,
        });
      }
    });

    // Apply attendance alerts into composite score
    for (const att of result.attendance_alerts) {
      const existing = scoreByStudent.get(att.student_id);
      if (!existing) continue;
      const attFactor = `টানা ${att.consecutive_absent_days} দিন অনুপস্থিত`;
      const factors = Array.isArray(existing.factors)
        ? existing.factors.filter((f) => f !== "স্বাভাবিক একাডেমিক ও হাজিরা অগ্রগতি")
        : [];
      if (!factors.some((f) => f.includes("অনুপস্থিত"))) {
        factors.unshift(attFactor);
      }
      const attScore = att.consecutive_absent_days >= 5 ? 80 : 60;
      scoreByStudent.set(att.student_id, {
        ...existing,
        attendance_score: Math.max(existing.attendance_score || 0, 35),
        composite_score: Math.max(existing.composite_score || 0, attScore),
        risk_level:
          att.alert_level === "CRITICAL" || existing.risk_level === "CRITICAL"
            ? "CRITICAL"
            : "HIGH",
        factors,
      });
    }

    // Apply exam drop alerts into composite score
    for (const ex of result.exam_drop_alerts) {
      const existing = scoreByStudent.get(ex.student_id);
      if (!existing) continue;
      const exFactor = `পরীক্ষার নম্বর ${ex.drop_percentage}% হ্রাস পেয়েছে`;
      const factors = Array.isArray(existing.factors)
        ? existing.factors.filter((f) => f !== "স্বাভাবিক একাডেমিক ও হাজিরা অগ্রগতি")
        : [];
      if (!factors.some((f) => f.includes("পরীক্ষার নম্বর"))) {
        factors.push(exFactor);
      }
      const exScore = ex.drop_percentage >= 25 ? 78 : 58;
      scoreByStudent.set(ex.student_id, {
        ...existing,
        academic_score: Math.max(existing.academic_score || 0, 30),
        composite_score: Math.max(existing.composite_score || 0, exScore),
        risk_level:
          ex.alert_level === "CRITICAL" || existing.risk_level === "CRITICAL"
            ? "CRITICAL"
            : "HIGH",
        factors,
      });
    }

    // Apply overdue fees into composite score (overrides new-student grace period when due > 0)
    dueByStudent.forEach((totalDue, studentId) => {
      if (totalDue <= 0) return;
      const existing = scoreByStudent.get(studentId);
      if (!existing) return;
      const feeFactor = `বকেয়া ফি: ৳${totalDue.toLocaleString("bn-BD")}`;
      const feeRiskLevel = totalDue >= 5000 ? "HIGH" : "MEDIUM";
      const feeScorePart = totalDue >= 5000 ? 30 : totalDue >= 2000 ? 25 : 15;
      const compositeFloor = totalDue >= 5000 ? 55 : totalDue >= 2000 ? 35 : 25;
      const factors = Array.isArray(existing.factors)
        ? existing.factors.filter(
            (f) =>
              f !== "স্বাভাবিক একাডেমিক ও হাজিরা অগ্রগতি" &&
              !f.includes("প্রাথমিক গ্রেস পিরিয়ড") &&
              !f.includes("নতুন ভর্তি হওয়া শিক্ষার্থী")
          )
        : [];
      if (!factors.some((f) => f.includes("বকেয়া ফি") || f.includes("ফি বকেয়া"))) {
        factors.unshift(feeFactor);
      }
      const recs = Array.isArray(existing.recommendations)
        ? existing.recommendations.filter(
            (r) =>
              r !== "নিয়মিত পর্যবেক্ষণ অব্যাহত রাখুন।" &&
              !r.includes("প্রাথমিক ক্লাস পর্যবেক্ষণ চালু রাখুন")
          )
        : [];
      if (!recs.some((r) => r.includes("বকেয়া ফি") || r.includes("বকেয়া ফি"))) {
        recs.push("অভিভাবকের সাথে যোগাযোগ করে বকেয়া ফি পরিশোধের তাগিদ দিন।");
      }
      const nextFeeScore = Math.max(existing.fee_score || 0, feeScorePart);
      const summedComposite = Math.min(
        100,
        (existing.attendance_score || 0) + (existing.academic_score || 0) + nextFeeScore
      );
      scoreByStudent.set(studentId, {
        ...existing,
        composite_score: Math.max(existing.composite_score || 0, summedComposite, compositeFloor),
        fee_score: nextFeeScore,
        risk_level:
          existing.risk_level === "CRITICAL"
            ? "CRITICAL"
            : feeRiskLevel === "HIGH" || existing.risk_level === "HIGH"
              ? "HIGH"
              : "MEDIUM",
        factors,
        recommendations: recs.length > 0 ? recs : existing.recommendations,
      });
    });

    const combinedScores = Array.from(scoreByStudent.values()).sort(
      (a, b) => (b.composite_score || 0) - (a.composite_score || 0)
    );

    result.risk_scores = combinedScores;
    result.risk_distribution = {
      LOW: combinedScores.filter((s) => s.risk_level === "LOW").length,
      MEDIUM: combinedScores.filter((s) => s.risk_level === "MEDIUM").length,
      HIGH: combinedScores.filter((s) => s.risk_level === "HIGH").length,
      CRITICAL: combinedScores.filter((s) => s.risk_level === "CRITICAL").length,
      total: combinedScores.length,
    };

    for (const s of combinedScores) {
      if (s.risk_level === "CRITICAL" || s.risk_level === "HIGH") {
        criticalStudentIds.add(s.student_id);
      }
    }
    result.total_critical_students = criticalStudentIds.size;

    return applyPhoneMaskingToSummary(result, allowUnmasked);
  } catch (err) {
    console.error("Error generating early warning alerts:", err);
    return result;
  }
}

export const getEarlyWarningAnalytics = getEarlyWarningAlerts;

export async function recalculateEarlyWarningAction(classId?: string): Promise<{
  ok: boolean;
  data?: EarlyWarningSummary;
  error?: string;
}> {
  const auth = await writeGuard("analytics");
  if (!auth.allowed) {
    return { ok: false, error: auth.error || "অননুমোদিত অ্যাক্সেস।" };
  }
  if (!auth.madrasaId) {
    return { ok: false, error: "অননুমোদিত অ্যাক্সেস।" };
  }

  const summary = await recalculateStudentRiskScores(auth.madrasaId, {
    classId,
  });
  const masking = await getCurrentUserMaskingContext("students", "phone");
  return {
    ok: true,
    data: applyPhoneMaskingToSummary(summary, masking.allowUnmasked === true),
  };
}

export async function getRiskScoresAction(filters?: {
  riskLevel?: string;
  classId?: string;
  limit?: number;
}): Promise<{
  ok: boolean;
  scores: StudentRiskScoreRecord[];
  error?: string;
}> {
  const auth = await writeGuard("analytics");
  if (!auth.allowed) {
    return { ok: false, scores: [], error: auth.error || "অননুমোদিত অ্যাক্সেস।" };
  }
  if (!auth.madrasaId) {
    return { ok: false, scores: [], error: "অননুমোদিত অ্যাক্সেস।" };
  }

  const scores = await getStudentRiskScores(auth.madrasaId, filters);
  const masking = await getCurrentUserMaskingContext("students", "phone");
  const allowUnmasked = masking.allowUnmasked === true;

  return {
    ok: true,
    scores: allowUnmasked
      ? scores
      : scores.map((s) => ({
          ...s,
          parent_phone: s.parent_phone ? maskPhoneNumber(s.parent_phone) : null,
        })),
  };
}

export async function updateRiskInterventionAction(input: {
  studentId: string;
  status: InterventionStatus;
  notes?: string;
  notifyGuardian?: boolean;
}): Promise<{
  ok: boolean;
  record?: StudentRiskScoreRecord;
  notificationSent?: boolean;
  error?: string;
}> {
  const auth = await writeGuard("analytics");
  if (!auth.allowed) {
    return { ok: false, error: auth.error || "অননুমোদিত অ্যাক্সেস।" };
  }
  if (!auth.madrasaId) {
    return { ok: false, error: "অননুমোদিত অ্যাক্সেস।" };
  }

  const res = await updateRiskIntervention(auth.madrasaId, input.studentId, {
    status: input.status,
    notes: input.notes,
    actorId: auth.userId || null,
    actorName: auth.actorName || null,
    notifyGuardian: input.notifyGuardian,
  });

  if (res.record) {
    const masking = await getCurrentUserMaskingContext("students", "phone");
    if (!masking.allowUnmasked && res.record.parent_phone) {
      res.record = {
        ...res.record,
        parent_phone: maskPhoneNumber(res.record.parent_phone),
      };
    }
  }

  return res;
}
