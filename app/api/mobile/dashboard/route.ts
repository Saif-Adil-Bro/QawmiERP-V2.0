import { NextRequest } from "next/server";
import { authenticateMobileRequest, mobileError, mobileSuccess } from "@/lib/mobile-api";
import { toDhakaDateString, toDhakaDateStringFrom } from "@/lib/date-utils";
import {canReadSchoolFinance} from "@/lib/action-authorization";
import {dashboardFinance} from "@/lib/finance/dashboard";
import {readBooks} from "@/lib/finance/read-books";
import {getFeeMetadata} from "@/lib/fee-store";
import { readJsonStore } from "@/lib/madrasa-store";

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
      { count: studentsCount },
      { count: teachersCount },
      { count: classesCount },
      { count: todayPresent },
      { count: todayAbsent },
      { count: todayLeave },
      { count: todayLate },
      finance,
      { data: attendance30Data },
      { data: examResultsData },
      metaStore,
    ] = await Promise.all([
      auth.adminClient.from("students").select("*", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      auth.adminClient.from("teachers").select("*", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      auth.adminClient.from("classes").select("*", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      auth.adminClient.from("attendance").select("*", { count: "exact", head: true }).eq("madrasa_id", madrasaId).eq("date", today).eq("status", "Present"),
      auth.adminClient.from("attendance").select("*", { count: "exact", head: true }).eq("madrasa_id", madrasaId).eq("date", today).eq("status", "Absent"),
      auth.adminClient.from("attendance").select("*", { count: "exact", head: true }).eq("madrasa_id", madrasaId).eq("date", today).eq("status", "Leave"),
      auth.adminClient.from("attendance").select("*", { count: "exact", head: true }).eq("madrasa_id", madrasaId).eq("date", today).eq("status", "Late"),
      canReadSchoolFinance([auth.ctx.role,...auth.ctx.roles],auth.ctx.permissions) ? readBooks(madrasaId,getFeeMetadata).then(b=>dashboardFinance(b,today)) : null,
      auth.adminClient.from("attendance").select("status").eq("madrasa_id", madrasaId).gte("date", thirtyDaysAgo).lte("date", today),
      auth.adminClient.from("exam_results").select("marks_obtained, total_marks, exams(title)").eq("madrasa_id", madrasaId),
      readJsonStore(madrasaId, "meta"),
    ]);

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

    // 30-day attendance breakdown
    const attCounts = { Present: 0, Absent: 0, Leave: 0, Late: 0 };
    (attendance30Data || []).forEach((a: any) => {
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
          students_count: studentsCount || 0,
          teachers_count: effectiveTeachersCount,
          classes_count: classesCount || 0,
          today_present: todayPresent || 0,
          today_absent: todayAbsent || 0,
          today_leave: todayLeave || 0,
          today_late: todayLate || 0,
          ...(finance ? {today_income:finance.todayIncome,today_expense:finance.todayExpense,total_income:finance.totalIncome,total_expense:finance.totalExpense,
            net_balance:Math.round((finance.totalIncome-finance.totalExpense)*100)/100,expenses_sum:finance.expensesSum,bazar_sum:finance.bazarSum} : {}),
        },
        charts: {
          ...(finance ? {monthly_income_expense} : {}),
          today_attendance: [
            { name: "উপস্থিত", value: todayPresent || 0 },
            { name: "অনুপস্থিত", value: todayAbsent || 0 },
            { name: "ছুটি", value: todayLeave || 0 },
            { name: "বিলম্ব", value: todayLate || 0 },
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
