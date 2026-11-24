import HifzSummaryWidget from "@/components/widgets/HifzSummaryWidget";
import {dashboardHifzSummary} from "@/lib/hifz/widget";
import type {HifzSummary} from "@/lib/hifz-utils";
import { toDhakaDateString } from "@/lib/date-utils";
import { redirect } from "next/navigation";
import { webIdentity } from "@/lib/portal/identity";
import { createClient } from "@/lib/supabase/server";
import { getStaffRoster } from "@/app/actions/staff";
import { getFeeMetadata } from "@/app/actions/fee-management";
import ReportingCharts from "./components/ReportingCharts";
import { getEarlyWarningAlerts } from "@/app/actions/early-warning";
import EarlyWarningWidget from "@/components/EarlyWarningWidget";
import { getPortalRedirectUrl } from "@/lib/role-redirect";
import {readBooks} from "@/lib/finance/read-books";
import {canReadSchoolFinance} from "@/lib/action-authorization";
import {dashboardFinance} from "@/lib/finance/dashboard";
import DashboardViewSwitcher from "./components/DashboardViewSwitcher";
import PremiumDashboardClient from "./components/PremiumDashboardClient";
import { getFinancialAnomalies, type FinancialAnomalyRecord } from "@/lib/anomaly-detection-service";
import FinancialAnomalyBanner from "@/components/anomalies/FinancialAnomalyBanner";
import SickStudentsWidget from "@/components/widgets/SickStudentsWidget";
import { healthWidget } from "@/lib/student-health/staff";
import { getTenantWidgets } from "@/lib/widgets/service";
import type { WidgetConfigItem } from "@/lib/widgets/types";



export default async function DashboardPage() {
  // Reuse the layout's verified session (including secondary roles). A missing
  // or ambiguous raw profile join must not turn a real clinic into an empty dashboard.
  const [identity, supabase] = await Promise.all([webIdentity(), createClient()]);
  if (!identity) return <div className="p-8">ড্যাশবোর্ডে প্রবেশ করতে অনুগ্রহ করে লগইন করুন।</div>;
  const { user, userRow: profile } = identity;
  let madrasaName: string | null = null, error: { message?: string } | undefined;
  const targetUrl = getPortalRedirectUrl(profile.role, identity.perms.roles);
  if (targetUrl !== "/dashboard") {
    redirect(targetUrl);
  }

  const financeAllowed=canReadSchoolFinance([profile.role,identity.perms.profile.primaryRole,...identity.perms.roles],identity.perms.summary.effectivePermissions);
  let studentsCount = 0;
  let teachersCount = 0;
  let classesCount = 0;
  let todayPresent = 0;
  let todayAbsent = 0;
  let financeLoaded=false;
  let todayIncome = 0;
  let todayExpense = 0;
  let totalIncome = 0, fundBalance = 0;
  let totalExpense = 0;
  let expensesSum = 0;
  let bazarSum = 0;
  let incomeExpenseData: any[] = [];
  let attendanceData: any[] = [];
  let todayAttendanceData: any[] = [];
  let examPassRateData: any[] = [];
  let earlyWarningData: any = { attendance_alerts: [], exam_drop_alerts: [], total_critical_students: 0, checked_at: "" };
  let anomaliesData: FinancialAnomalyRecord[] = [];

  let hifzSummary:HifzSummary|null=null;
  let health: Awaited<ReturnType<typeof healthWidget>> = null;
  let dashboardWidgets: WidgetConfigItem[] = [];

  try {
    const today = toDhakaDateString();
    const earlyWarningPromise = getEarlyWarningAlerts().catch(() => ({
      attendance_alerts: [],
      exam_drop_alerts: [],
      total_critical_students: 0,
      checked_at: "",
    }));
    const anomaliesPromise = financeAllowed && profile?.madrasa_id
      ? getFinancialAnomalies(profile.madrasa_id, { limit: 20 }).catch(() => [])
      : Promise.resolve([]);
    const widgetsPromise = profile?.madrasa_id
      ? getTenantWidgets(profile.madrasa_id).catch(() => [])
      : Promise.resolve([]);

    if (profile?.madrasa_id) {
      // Independent widgets remain available even when an unrelated statistics query fails.
      const [widgets, hifzData, healthData, { data: school }, stats] = await Promise.all([
        widgetsPromise,
        dashboardHifzSummary(identity).catch(()=>null),
        healthWidget({ tenant: identity.tenant, actor: user.id }),
        supabase.from("madrasas").select("name").eq("id", identity.tenant).maybeSingle(),
        Promise.all([
          earlyWarningPromise,
          anomaliesPromise,
          supabase.from("students").select("*", { count: "exact", head: true }).eq("madrasa_id", profile.madrasa_id),
          supabase.from("teachers").select("*", { count: "exact", head: true }).eq("madrasa_id", profile.madrasa_id),
          supabase.from("classes").select("*", { count: "exact", head: true }).eq("madrasa_id", profile.madrasa_id),
          supabase.from("attendance").select("*", { count: "exact", head: true }).eq("madrasa_id", profile.madrasa_id).eq("date", today).eq("status", "Present"),
          supabase.from("attendance").select("*", { count: "exact", head: true }).eq("madrasa_id", profile.madrasa_id).eq("date", today).eq("status", "Absent"),
          supabase.from("attendance").select("*", { count: "exact", head: true }).eq("madrasa_id", profile.madrasa_id).eq("date", today).eq("status", "Leave"),
          supabase.from("attendance").select("*", { count: "exact", head: true }).eq("madrasa_id", profile.madrasa_id).eq("date", today).eq("status", "Late"),

          financeAllowed ? readBooks(identity.tenant,getFeeMetadata).then(b=>dashboardFinance(b,today)).catch(()=>null) : null,
          supabase.from("attendance").select("status").eq("madrasa_id", profile.madrasa_id).gte("date", toDhakaDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))).lte("date", today),
          supabase.from("exam_results").select("marks_obtained, total_marks, exams(title)").eq("madrasa_id", profile.madrasa_id),
          getStaffRoster().catch(()=>[]),
        ]).then(data => ({ ok: true as const, data }), error => ({ ok: false as const, error })),
      ]);
      dashboardWidgets = widgets;
      health = healthData; hifzSummary=hifzData;
      madrasaName = school?.name ?? null;
      if (!stats.ok) throw stats.error;
      const [
        alerts,
        anomalies,
        { count: sCount },
        { count: tCount },
        { count: cCount },
        { count: presentCount },
        { count: absentCount },
        { count: leaveCount },
        { count: lateCount },

        finance,
        { data: attendanceAllData },
        { data: examResultsData },
        staffFullData,
      ] = stats.data;
      earlyWarningData = alerts;
      anomaliesData = anomalies;

      studentsCount = sCount || 0;
      const staffMembers = staffFullData;
      teachersCount = Math.max(tCount || 0, staffMembers.length);
      classesCount = cCount || 0;
      todayPresent = presentCount || 0;
      todayAbsent = absentCount || 0;


      financeLoaded=!!finance;
      if (!finance && financeAllowed) error={message:'আর্থিক হিসাব অনুপলব্ধ। নিচের আর্থিক সংখ্যাগুলি ব্যবহার করবেন না।'};
      else if(finance) ({totalIncome,totalExpense,todayIncome,todayExpense,expensesSum,bazarSum,balance:fundBalance}=finance);
      const monthlyData=finance?.monthlyData || {};

      // Process Attendance Rate
      let presentTotal = 0;
      let absentTotal = 0;
      let leaveTotal = 0;
      let lateTotal = 0;
      (attendanceAllData || []).forEach((a: any) => {
        if (a.status === 'Present') presentTotal++;
        else if (a.status === 'Absent') absentTotal++;
        else if (a.status === 'Leave') leaveTotal++;
        else if (a.status === 'Late') lateTotal++;
      });

      // Process Exam Pass Rate
      const examStats: Record<string, { total: number; passed: number }> = {};
      (examResultsData || []).forEach((r: any) => {
        const examName = r.exams?.title || 'অজানা পরীক্ষা';
        if (!examStats[examName]) examStats[examName] = { total: 0, passed: 0 };
        examStats[examName].total++;
        const percent = (Number(r.marks_obtained) / Number(r.total_marks)) * 100;
        if (percent >= 33) {
          examStats[examName].passed++;
        }
      });
      
      incomeExpenseData = Object.keys(monthlyData).sort().map(month => ({
        month,
        income: monthlyData[month].income,
        expense: monthlyData[month].expense
      })).slice(-6); // last 6 months

      todayAttendanceData = [
        { name: 'উপস্থিত', value: todayPresent },
        { name: 'অনুপস্থিত', value: todayAbsent },
        { name: 'ছুটি', value: leaveCount || 0 },
        { name: 'বিলম্ব', value: lateCount || 0 },
      ].filter(d => d.value > 0);

      attendanceData = [
        { name: 'উপস্থিত', value: presentTotal },
        { name: 'ছুটি', value: leaveTotal },
        { name: 'বিলম্ব', value: lateTotal },
        { name: 'অনুপস্থিত', value: absentTotal },
      ].filter(d => d.value > 0);

      examPassRateData = Object.keys(examStats).map(exam => ({
        exam,
        passRate: (examStats[exam].passed / examStats[exam].total) * 100
      }));

    }
  } catch (err: any) {
    error = { message: err?.message };
  }

  return (
    <DashboardViewSwitcher
      stats={{
        studentsCount,
        teachersCount,
        classesCount,
        todayPresent,
        todayAbsent,
        todayIncome,
        todayExpense,
        totalIncome,
        totalExpense,
        expensesSum,
        bazarSum,
      }}
    >
      <PremiumDashboardClient showFinance={financeAllowed && financeLoaded}
        hifzSummaryNode={hifzSummary ? <HifzSummaryWidget summary={hifzSummary}/> : null}
        sickStudentsNode={health && dashboardWidgets.find(w => w.id === "builtin-sick-students")?.enabled !== false ? <SickStudentsWidget summary={health} tenant={profile.madrasa_id} actor={user.id} /> : null}
        profile={{
          full_name: profile?.full_name,
          role: profile?.role,
          madrasa_name: madrasaName,
        }}
        stats={{
          studentsCount,
          teachersCount,
          classesCount,
          todayPresent,
          todayAbsent,
          todayIncome,
          todayExpense,
          totalIncome,
          fundBalance,
          totalExpense,
          expensesSum,
          bazarSum,
        }}
        widgets={dashboardWidgets}
        errorMessage={error?.message || null}
        earlyWarningNode={
          <EarlyWarningWidget initialData={earlyWarningData} isTeacherView={false} />
        }
        anomalyBannerNode={
          <FinancialAnomalyBanner anomalies={anomaliesData} />
        }
        chartsNode={
          <ReportingCharts
            incomeExpenseData={incomeExpenseData}
            attendanceData={attendanceData}
            todayAttendanceData={todayAttendanceData}
            examPassRateData={examPassRateData}
          />
        }
      />
    </DashboardViewSwitcher>
  );

}
