import { NextRequest } from "next/server";
import { authenticateMobileRequest, mobileError, mobileSuccess } from "@/lib/mobile-api";
import { toDhakaDateString, toDhakaDateStringFrom } from "@/lib/date-utils";
import {canReadSchoolFinance} from "@/lib/action-authorization";
import {dashboardFinance} from "@/lib/finance/dashboard";
import {readBooks} from "@/lib/finance/read-books";
import {getFeeMetadata} from "@/lib/fee-store";
import { readJsonStore } from "@/lib/madrasa-store";
import { computeRosterAttendanceTruth } from "@/lib/attendance-truth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateMobileRequest(req, {
    requireWrite: false,
  });
  if (!auth.ok) return auth.response;

  try {
    const madrasaId = auth.ctx.madrasaId;
    const today = toDhakaDateString();
    const thirtyDaysAgo = toDhakaDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    const [
      { data: rosterStudents },
      { count: teachersCount },
      { count: classesCount },
      { data: todayAttRows },
      finance,
      { data: attendance30Data },
      { data: examResultsData },
      metaStore,
    ] = await Promise.all([
      auth.adminClient.from("students").select("id").eq("madrasa_id", madrasaId),
      auth.adminClient.from("teachers").select("*", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      auth.adminClient.from("classes").select("*", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      auth.adminClient.from("attendance").select("student_id, status").eq("madrasa_id", madrasaId).eq("date", today),
      canReadSchoolFinance([auth.ctx.role,...auth.ctx.roles],auth.ctx.permissions) ? readBooks(madrasaId,getFeeMetadata).then(b=>dashboardFinance(b,today)) : null,
      auth.adminClient.from("attendance").select("student_id, status").eq("madrasa_id", madrasaId).gte("date", thirtyDaysAgo).lte("date", today),
      auth.adminClient.from("exam_results").select("marks_obtained, total_marks, exams(title)").eq("madrasa_id", madrasaId),
      readJsonStore(madrasaId, "meta"),
    ]);

    const activeRoster = rosterStudents || [];
    const rosterIdSet = new Set(activeRoster.map((s: any) => String(s.id)));
    const truth = computeRosterAttendanceTruth(activeRoster, todayAttRows || []);

    const staffMembers = Array.isArray(metaStore.staff_members) ? metaStore.staff_members : [];
    const effectiveTeachersCount = Math.max(teachersCount || 0, staffMembers.length);

    const monthlyMap=finance?.monthlyData ?? {};

    const monthly_income_expense = Object.keys(monthlyMap)
      .sort()
      .slice(-6)
      .map((month) => ({
        month,
        income: monthlyMap[month].income,
        expense: monthlyMap[month].expense,
      }));

    // 30-day attendance breakdown (restricted to active roster students)
    const attCounts = { Present: 0, Absent: 0, Leave: 0, Late: 0 };
    (attendance30Data || []).forEach((a: any) => {
      if (rosterIdSet.size > 0 && a.student_id && !rosterIdSet.has(String(a.student_id))) return;
      if (a.status in attCounts) (attCounts as any)[a.status]++;
    });

    // Exam pass rate
    const examStats: Record<string, { total: number; passed: number }> = {};
    (examResultsData || []).forEach((r: any) => {
      const title = r.exams?.title || "পরীক্ষা";
      if (!examStats[title]) examStats[title] = { total: 0, passed: 0 };
      examStats[title].total++;
      if ((Number(r.marks_obtained) / Math.max(1, Number(r.total_marks))) * 100 >= 33) {
        examStats[title].passed++;
      }
    });
    const exam_pass_rate = Object.keys(examStats).map((exam) => ({
      exam,
      passRate: Number(((examStats[exam].passed / examStats[exam].total) * 100).toFixed(1)),
    }));

    return mobileSuccess(
      {
        stats: {
          students_count: truth.totalStudents,
          teachers_count: effectiveTeachersCount,
          classes_count: classesCount || 0,
          today_present: truth.presentCount,
          today_absent: truth.absentCount,
          today_leave: truth.leaveCount,
          today_late: truth.lateCount,
          today_unmarked: truth.unmarkedCount,
          ...(finance ? {today_income:finance.todayIncome,today_expense:finance.todayExpense,total_income:finance.totalIncome,total_expense:finance.totalExpense,
            net_balance:finance.balance,expenses_sum:finance.expensesSum,bazar_sum:finance.bazarSum} : {}),
        },
        charts: {
          ...(finance ? {monthly_income_expense} : {}),
          today_attendance: [
            { name: "উপস্থিত", value: truth.presentCount },
            { name: "অনুপস্থিত", value: truth.absentCount },
            { name: "ছুটি", value: truth.leaveCount },
            { name: "বিলম্ব", value: truth.lateCount },
            { name: "হাজিরা বাকি", value: truth.unmarkedCount },
          ].filter((x) => x.value > 0),
          thirty_day_attendance: [
            { name: "উপস্থিত", value: attCounts.Present },
            { name: "অনুপস্থিত", value: attCounts.Absent },
            { name: "ছুটি", value: attCounts.Leave },
            { name: "বিলম্ব", value: attCounts.Late },
          ].filter((x) => x.value > 0),
          exam_pass_rate,
        },
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
