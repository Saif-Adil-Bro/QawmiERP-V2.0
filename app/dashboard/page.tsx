import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getStaffMetadataFull } from "@/app/actions/staff";
import { getMadrasaMetadata } from "@/lib/sessions";
import ReportingCharts from "./components/ReportingCharts";
import { getEarlyWarningAlerts } from "@/app/actions/early-warning";
import EarlyWarningWidget from "@/components/EarlyWarningWidget";
import { getPortalRedirectUrl } from "@/lib/role-redirect";
import { getFunds } from "@/app/actions/zakat";
import { BookOpen, CheckSquare, ArrowRight } from "lucide-react";



export default async function DashboardPage() {
  const supabase = await createClient();
  
  // Timeout wrapper for Supabase queries
  async function withTimeout<T>(promise: any, ms: number = 8000, context: string = "Request"): Promise<T> {
    const timeout = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`${context} timed out after ${ms}ms. Please check database configuration.`)), ms)
    );
    return Promise.race([promise, timeout]);
  }

  let user = await getAuthUser(supabase);

  if (!user) {
    return <div className="p-8">ড্যাশবোর্ডে প্রবেশ করতে অনুগ্রহ করে লগইন করুন।</div>;
  }

  // Fetch the user profile and madrasa info
  let profile, error;

  // 1. First verify user profile and portal destination
  const { data: userProfileData } = await supabase
    .from("users")
    .select("*, madrasas(name)")
    .eq("id", user.id)
    .maybeSingle();

  profile = userProfileData;

  // Direct teachers, parents, and students to their designated portal
  const targetUrl = getPortalRedirectUrl(profile?.role || user.user_metadata?.role);
  if (targetUrl !== "/dashboard") {
    redirect(targetUrl);
  }

  let studentsCount = 0;
  let teachersCount = 0;
  let classesCount = 0;
  let todayPresent = 0;
  let todayAbsent = 0;
  let totalIncome = 0;
  let totalExpense = 0;
  let expensesSum = 0;
  let bazarSum = 0;
  let incomeExpenseData: any[] = [];
  let attendanceData: any[] = [];
  let todayAttendanceData: any[] = [];
  let examPassRateData: any[] = [];
  let earlyWarningData: any = { attendance_alerts: [], exam_drop_alerts: [], total_critical_students: 0, checked_at: "" };

  try {
    const alerts = await getEarlyWarningAlerts();
    earlyWarningData = alerts;

    if (profile?.madrasa_id) {
      const today = new Date().toISOString().split('T')[0];

      const [
        { count: sCount }, 
        { count: tCount },
        { count: cCount },
        { count: presentCount },
        { count: absentCount },
        { count: leaveCount },
        { count: lateCount },

        { data: feesData },
        { data: donationsData },
        { data: expensesData },
        { data: bazarData },
        { data: attendanceAllData },
        { data: examResultsData },
        staffFullData,
        madrasaMeta,
        fundsData

      ] = await Promise.all([
        supabase.from("students").select("*", { count: "exact", head: true }).eq("madrasa_id", profile.madrasa_id),
        supabase.from("teachers").select("*", { count: "exact", head: true }).eq("madrasa_id", profile.madrasa_id),
        supabase.from("classes").select("*", { count: "exact", head: true }).eq("madrasa_id", profile.madrasa_id),
        supabase.from("attendance").select("*", { count: "exact", head: true }).eq("madrasa_id", profile.madrasa_id).eq("date", today).eq("status", "Present"),
        supabase.from("attendance").select("*", { count: "exact", head: true }).eq("madrasa_id", profile.madrasa_id).eq("date", today).eq("status", "Absent"),
        supabase.from("attendance").select("*", { count: "exact", head: true }).eq("madrasa_id", profile.madrasa_id).eq("date", today).eq("status", "Leave"),
        supabase.from("attendance").select("*", { count: "exact", head: true }).eq("madrasa_id", profile.madrasa_id).eq("date", today).eq("status", "Late"),

        supabase.from("fees").select("amount, payment_date").eq("madrasa_id", profile.madrasa_id),
        supabase.from("donations").select("amount, donation_date").eq("madrasa_id", profile.madrasa_id),
        supabase.from("expenses").select("amount, expense_date").eq("madrasa_id", profile.madrasa_id),
        supabase.from("bazar_expenses").select("amount, expense_date").eq("madrasa_id", profile.madrasa_id),
        supabase.from("attendance").select("status").eq("madrasa_id", profile.madrasa_id).gte("date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]).lte("date", today),
        supabase.from("exam_results").select("marks_obtained, total_marks, exams(title)").eq("madrasa_id", profile.madrasa_id),
        getStaffMetadataFull(),
        getMadrasaMetadata(profile.madrasa_id),
        getFunds()
      ]);

      studentsCount = sCount || 0;
      const staffMembers = staffFullData?.staff_members || [];
      teachersCount = Math.max(tCount || 0, staffMembers.length);
      classesCount = cCount || 0;
      todayPresent = presentCount || 0;
      todayAbsent = absentCount || 0;


      const feesSum = (feesData || []).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
      const donationsSum = (donationsData || []).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
      
      // Calculate definitive Total Income directly from funds source of truth
      const fundsTotalCollected = (fundsData || []).reduce((sum: number, f: any) => sum + Number(f.total_collected || 0), 0);
      totalIncome = fundsTotalCollected;

      expensesSum = (expensesData || []).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
      bazarSum = (bazarData || []).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
      totalExpense = expensesSum + bazarSum;

      // Sets to track IDs, receipt numbers, and transaction IDs to strictly avoid double counting
      const trackedFeeKeys = new Set<string>();
      (feesData || []).forEach((f: any) => {
        if (f.id) trackedFeeKeys.add(f.id);
        if (f.receipt_no) trackedFeeKeys.add(f.receipt_no);
        const rMatch = f.notes?.match(/\[(?:রিসিট|অনলাইন পেমেন্ট):\s*([^\]|]+)/)?.[1];
        if (rMatch) trackedFeeKeys.add(rMatch.trim());
      });

      const trackedDonationKeys = new Set<string>();
      (donationsData || []).forEach((d: any) => {
        if (d.id) trackedDonationKeys.add(d.id);
        if (d.receipt_no) trackedDonationKeys.add(d.receipt_no);
        const rMatch = d.notes?.match(/\[(?:চালান|রিসিট|কুরবানির চামড়া বিক্রয়|দানবাক্স কালেকশন):\s*([^\]|,]+)/)?.[1];
        if (rMatch) trackedDonationKeys.add(rMatch.trim());
      });

      // Process Monthly Income/Expense
      const monthlyData: Record<string, { income: number; expense: number }> = {};
      const addMonthly = (dateStr: string, amount: number, type: 'income' | 'expense') => {
        if (!dateStr || amount <= 0) return;
        const cleanDate = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.trim();
        const month = cleanDate.substring(0, 7); // YYYY-MM
        if (!monthlyData[month]) monthlyData[month] = { income: 0, expense: 0 };
        monthlyData[month][type] += Number(amount);
      };

      (feesData || []).forEach((f: any) => addMonthly(f.payment_date, f.amount, 'income'));
      (donationsData || []).forEach((d: any) => addMonthly(d.donation_date, d.amount, 'income'));
      (expensesData || []).forEach((e: any) => addMonthly(e.expense_date, e.amount, 'expense'));
      (bazarData || []).forEach((b: any) => addMonthly(b.expense_date, b.amount, 'expense'));

      // Include all Madrasa Metadata Live Collections ONLY if not already tracked in DB tables
      const meta = madrasaMeta || {};

      // 1. Fee management payments from metadata (untracked in fees table)
      (meta.payments || []).forEach((p: any) => {
        if (
          p.status === "COMPLETED" &&
          !trackedFeeKeys.has(p.id) &&
          !trackedFeeKeys.has(p.db_fee_id) &&
          !trackedFeeKeys.has(p.receipt_no)
        ) {
          const amt = Number(p.total_amount_received || 0);
          const dt = p.payment_date || (p.created_at ? p.created_at.split("T")[0] : "");
          if (amt > 0) {
            totalIncome += amt;
            addMonthly(dt, amt, 'income');
          }
        }
      });

      // 2. Mahfil Receipt Books & Direct Transactions (untracked)
      const mahfils = meta.mahfils || [];
      mahfils.forEach((m: any) => {
        // Check if Mahfil is settled or has a surplus deposit in donations table
        const isSettled = Boolean(m.settlement || (m.settlements && m.settlements.length > 0));

        // If Mahfil is settled, its surplus is already recorded as a donation in the donations DB table.
        // To prevent double counting settled Mahfil funds, skip internal books/transactions if settled or tracked.
        if (!isSettled) {
          (m.receipt_books || []).forEach((bk: any) => {
            if (Array.isArray(bk.deposit_history) && bk.deposit_history.length > 0) {
              bk.deposit_history.forEach((dep: any) => {
                const amt = Number(dep.amount || 0);
                const recNo = dep.receipt_no || bk.receipt_no || dep.id;
                if (amt > 0 && !trackedDonationKeys.has(recNo)) {
                  totalIncome += amt;
                  addMonthly(dep.date, amt, 'income');
                }
              });
            } else if (Number(bk.total_collected || 0) > 0) {
              const amt = Number(bk.total_collected || 0);
              const dt = bk.return_date || bk.issued_date || m.start_date || "";
              const recNo = bk.receipt_no || bk.id;
              if (!trackedDonationKeys.has(recNo)) {
                totalIncome += amt;
                addMonthly(dt, amt, 'income');
              }
            }
          });
        }

        (m.transactions || []).forEach((t: any) => {
          const amt = Number(t.amount || 0);
          const dt = t.date || m.start_date || "";
          const tKey = t.id || t.voucher_no;
          const isInternalSettlement = 
            (t.id && t.id.startsWith("txn_settle")) ||
            (t.category && (t.category.includes("উদ্বৃত্ত") || t.category.includes("স্থানান্তর"))) ||
            (t.description && (t.description.includes("উদ্বৃত্ত") || t.description.includes("স্থানান্তর")));

          // Ignore internal balancing settlement transactions
          if (isInternalSettlement) return;

          if (amt > 0) {
            if (t.type === "INCOME" && !isSettled && !trackedDonationKeys.has(tKey)) {
              totalIncome += amt;
              addMonthly(dt, amt, 'income');
            } else if (t.type === "EXPENSE" && !isSettled) {
              totalExpense += amt;
              addMonthly(dt, amt, 'expense');
            }
          }
        });
      });

      // 3. Regular Donor / Life Member Payments (untracked)
      (meta.donor_subscription_payments || []).forEach((p: any) => {
        const amt = Number(p.amount || 0);
        const dt = p.payment_date || p.date || (p.created_at ? p.created_at.split("T")[0] : "");
        const pKey = p.id || p.receipt_no;
        if (amt > 0 && !trackedDonationKeys.has(pKey)) {
          totalIncome += amt;
          addMonthly(dt, amt, 'income');
        }
      });

      // 4. Donation Box Collections (untracked)
      (meta.donation_box_logs || []).forEach((l: any) => {
        const amt = Number(l.amount || 0);
        const dt = l.collection_date || l.date || (l.created_at ? l.created_at.split("T")[0] : "");
        const lKey = l.receipt_no || l.id;
        if (amt > 0 && !trackedDonationKeys.has(lKey)) {
          totalIncome += amt;
          addMonthly(dt, amt, 'income');
        }
      });

      // 5. Online Donations (untracked)
      (meta.online_donations || []).forEach((d: any) => {
        if (d.status === "COMPLETED" || d.status === "VERIFIED" || d.status === "SUCCESS") {
          const amt = Number(d.amount || 0);
          const dt = d.payment_date || (d.created_at ? d.created_at.split("T")[0] : "");
          const dKey = d.receipt_no || d.transaction_id || d.id;
          if (amt > 0 && !trackedDonationKeys.has(dKey)) {
            totalIncome += amt;
            addMonthly(dt, amt, 'income');
          }
        }
      });

      // 6. Qurbani Leather Records (untracked)
      const leatherRecords = meta.qurbani_leather_records || meta.leather_batches || [];
      leatherRecords.forEach((r: any) => {
        const inc = Number(r.received_amount || r.total_sale_price || r.total_sale_amount || 0);
        const exp = Number(r.transport_labour_cost || r.transport_labor_cost || 0);
        const dt = r.collection_date || r.sale_date || r.date || (r.created_at ? r.created_at.split("T")[0] : "");
        const rKey = r.receipt_no || r.id;
        if (!trackedDonationKeys.has(rKey)) {
          if (inc > 0) {
            totalIncome += inc;
            addMonthly(dt, inc, 'income');
          }
          if (exp > 0) {
            totalExpense += exp;
            addMonthly(dt, exp, 'expense');
          }
        }
      });

      // Ensure Total Income is the definitive sum of all funds collections
      totalIncome = fundsTotalCollected;

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
    <div className="space-y-6">
      <div className="bg-white p-6 sm:p-8 rounded-xl border shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">স্বাগতম, {profile?.full_name || 'এডমিন'}</h2>
          <p className="text-slate-600 text-sm">
            আপনি <span className="font-semibold text-slate-900">{profile?.madrasas?.name || 'আপনার মাদ্রাসা'}</span>-এ <span className="font-semibold capitalize text-slate-900">{profile?.role?.replace("_", " ") || 'সুপার এডমিন'}</span> হিসেবে লগইন করেছেন।
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/dashboard/assignments"
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition flex items-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            <span>দৈনিক পড়া ও অ্যাসাইনমেন্ট</span>
          </Link>
          <Link
            href="/dashboard/attendance/students"
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl transition flex items-center gap-2"
          >
            <CheckSquare className="w-4 h-4" />
            <span>হাজিরা গ্রহণ</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-red-700 text-sm">
          ডাটাবেস কানেকশন সমস্যা।
          <br/>
          Error: {error.message}
        </div>
      )}

      {/* Early Warning System Alert Widget */}
      <EarlyWarningWidget initialData={earlyWarningData} isTeacherView={false} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/dashboard/students" className="bg-white p-6 rounded-xl border shadow-sm hover:border-emerald-300 hover:shadow transition block group">
          <h3 className="text-slate-500 text-sm font-medium group-hover:text-emerald-700 transition">মোট শিক্ষার্থী</h3>
          <p className="text-3xl font-bold text-slate-800 mt-2">{studentsCount}</p>
        </Link>
        <Link href="/dashboard/staff" className="bg-white p-6 rounded-xl border shadow-sm hover:border-emerald-300 hover:shadow transition block group">
          <h3 className="text-slate-500 text-sm font-medium group-hover:text-emerald-700 transition">মোট শিক্ষক ও স্টাফ</h3>
          <p className="text-3xl font-bold text-slate-800 mt-2">{teachersCount}</p>
        </Link>
        <Link href="/dashboard/classes" className="bg-white p-6 rounded-xl border shadow-sm hover:border-emerald-300 hover:shadow transition block group">
          <h3 className="text-slate-500 text-sm font-medium group-hover:text-emerald-700 transition">সক্রিয় জামাত (ক্লাস)</h3>
          <p className="text-3xl font-bold text-slate-800 mt-2">{classesCount}</p>
        </Link>
        <Link href="/dashboard/attendance/students" className="bg-white p-6 rounded-xl border shadow-sm hover:border-emerald-300 hover:shadow transition block group">
          <h3 className="text-slate-500 text-sm font-medium group-hover:text-emerald-700 transition">আজকের উপস্থিতি (শিক্ষার্থী)</h3>
          <p className="text-3xl font-bold text-slate-800 mt-2 text-emerald-600">{todayPresent}</p>
          <p className="text-sm text-rose-500 mt-1">অনুপস্থিত: {todayAbsent}</p>
        </Link>
        
        <Link href="/dashboard/accounting/income" className="bg-white p-6 rounded-xl border shadow-sm lg:col-span-2 hover:border-emerald-400 hover:shadow-md transition block group">
          <div className="flex items-center justify-between">
            <h3 className="text-slate-500 text-sm font-medium group-hover:text-emerald-700 transition">মোট আয় (ফান্ড কালেকশন)</h3>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 group-hover:bg-emerald-100 transition">
              <span>আয় হিস্ট্রি দেখুন</span>
              <ArrowRight className="w-3 h-3" />
            </span>
          </div>
          <p className="text-3xl font-bold text-emerald-600 mt-2">৳ {totalIncome.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-400 mt-1 font-medium">সকল ফান্ডের সর্বমোট কালেকশন</p>
        </Link>
        <Link href="/dashboard/accounting/expenses" className="bg-white p-6 rounded-xl border shadow-sm lg:col-span-2 hover:border-emerald-300 hover:shadow transition block group">
          <div className="flex items-center justify-between">
            <h3 className="text-slate-500 text-sm font-medium group-hover:text-emerald-700 transition">মোট ব্যয়</h3>
            {bazarSum > 0 && (
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                বোর্ডিং বাজার সহ
              </span>
            )}
          </div>
          <p className="text-3xl font-bold text-rose-600 mt-2">৳ {totalExpense.toLocaleString('en-IN')}</p>
          {bazarSum > 0 && (
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span>বোর্ডিং বাজার: ৳ {bazarSum.toLocaleString('en-IN')}</span>
              {expensesSum > 0 && <span>• সাধারণ খরচ: ৳ {expensesSum.toLocaleString('en-IN')}</span>}
            </p>
          )}
        </Link>
      </div>

      <ReportingCharts 
        incomeExpenseData={incomeExpenseData} 
        attendanceData={attendanceData} 
        todayAttendanceData={todayAttendanceData}
        examPassRateData={examPassRateData} 
      />
    </div>
  );

}
