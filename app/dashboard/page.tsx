import { createClient, getAuthUser } from "@/lib/supabase/server";
import ReportingCharts from "./components/ReportingCharts";


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
  let studentsCount = 0;
  let teachersCount = 0;
  let classesCount = 0;
  let todayPresent = 0;
  let todayAbsent = 0;
  let totalIncome = 0;
  let totalExpense = 0;
  let incomeExpenseData: any[] = [];
  let attendanceData: any[] = [];
  let examPassRateData: any[] = [];

  try {
    const response = await withTimeout<any>(
      supabase
        .from("users")
        .select("*, madrasas(name)")
        .eq("id", user.id)
        .single(),
      8000,
      "Fetch user profile"
    );
    profile = response.data;
    error = response.error;

    if (profile?.madrasa_id) {
      const today = new Date().toISOString().split('T')[0];

      const [
        { count: sCount }, 
        { count: tCount },
        { count: cCount },
        { count: presentCount },
        { count: absentCount },

        { data: feesData },
        { data: donationsData },
        { data: expensesData },
        { data: bazarData },
        { data: attendanceAllData },
        { data: examResultsData }

      ] = await Promise.all([
        supabase.from("students").select("*", { count: "exact", head: true }).eq("madrasa_id", profile.madrasa_id),
        supabase.from("teachers").select("*", { count: "exact", head: true }).eq("madrasa_id", profile.madrasa_id),
        supabase.from("classes").select("*", { count: "exact", head: true }).eq("madrasa_id", profile.madrasa_id),
        supabase.from("attendance").select("*", { count: "exact", head: true }).eq("madrasa_id", profile.madrasa_id).eq("date", today).eq("status", "Present"),
        supabase.from("attendance").select("*", { count: "exact", head: true }).eq("madrasa_id", profile.madrasa_id).eq("date", today).eq("status", "Absent"),

        supabase.from("fees").select("amount, payment_date").eq("madrasa_id", profile.madrasa_id),
        supabase.from("donations").select("amount, donation_date").eq("madrasa_id", profile.madrasa_id),
        supabase.from("expenses").select("amount, expense_date").eq("madrasa_id", profile.madrasa_id),
        supabase.from("bazar_expenses").select("amount, expense_date").eq("madrasa_id", profile.madrasa_id),
        supabase.from("attendance").select("status").eq("madrasa_id", profile.madrasa_id).gte("date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
        supabase.from("exam_results").select("marks_obtained, total_marks, exams(title)").eq("madrasa_id", profile.madrasa_id)
      ]);

      studentsCount = sCount || 0;
      teachersCount = tCount || 0;
      classesCount = cCount || 0;
      todayPresent = presentCount || 0;
      todayAbsent = absentCount || 0;


      const feesSum = (feesData || []).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
      const donationsSum = (donationsData || []).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
      totalIncome = feesSum + donationsSum;

      const expensesSum = (expensesData || []).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
      const bazarSum = (bazarData || []).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
      totalExpense = expensesSum + bazarSum;

      // Process Monthly Income/Expense
      const monthlyData: Record<string, { income: number; expense: number }> = {};
      const addMonthly = (dateStr: string, amount: number, type: 'income' | 'expense') => {
        if (!dateStr) return;
        const month = dateStr.substring(0, 7); // YYYY-MM
        if (!monthlyData[month]) monthlyData[month] = { income: 0, expense: 0 };
        monthlyData[month][type] += Number(amount);
      };

      (feesData || []).forEach((f: any) => addMonthly(f.payment_date, f.amount, 'income'));
      (donationsData || []).forEach((d: any) => addMonthly(d.donation_date, d.amount, 'income'));
      (expensesData || []).forEach((e: any) => addMonthly(e.expense_date, e.amount, 'expense'));
      (bazarData || []).forEach((b: any) => addMonthly(b.expense_date, b.amount, 'expense'));

      // Process Attendance Rate
      let presentTotal = 0;
      let absentTotal = 0;
      let leaveTotal = 0;
      (attendanceAllData || []).forEach((a: any) => {
        if (a.status === 'Present') presentTotal++;
        else if (a.status === 'Absent') absentTotal++;
        else if (a.status === 'Leave') leaveTotal++;
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

      attendanceData = [
        { name: 'উপস্থিত', value: presentTotal },
        { name: 'অনুপস্থিত', value: absentTotal },
        { name: 'ছুটি', value: leaveTotal }
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
      <div className="bg-white p-8 rounded-xl border shadow-sm">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">স্বাগতম, {profile?.full_name || 'এডমিন'}</h2>
        <p className="text-slate-600">
          আপনি <span className="font-semibold text-slate-900">{profile?.madrasas?.name || 'আপনার মাদ্রাসা'}</span>-এ <span className="font-semibold capitalize text-slate-900">{profile?.role?.replace("_", " ") || 'সুপার এডমিন'}</span> হিসেবে লগইন করেছেন।
        </p>
      </div>

      {error && (
        <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-red-700 text-sm">
          ডাটাবেস কানেকশন সমস্যা।
          <br/>
          Error: {error.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-slate-500 text-sm font-medium">মোট শিক্ষার্থী</h3>
          <p className="text-3xl font-bold text-slate-800 mt-2">{studentsCount}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-slate-500 text-sm font-medium">মোট শিক্ষক</h3>
          <p className="text-3xl font-bold text-slate-800 mt-2">{teachersCount}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-slate-500 text-sm font-medium">সক্রিয় জামাত (ক্লাস)</h3>
          <p className="text-3xl font-bold text-slate-800 mt-2">{classesCount}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-slate-500 text-sm font-medium">আজকের উপস্থিতি (শিক্ষার্থী)</h3>
          <p className="text-3xl font-bold text-slate-800 mt-2 text-emerald-600">{todayPresent}</p>
          <p className="text-sm text-rose-500 mt-1">অনুপস্থিত: {todayAbsent}</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl border shadow-sm lg:col-span-2">
          <h3 className="text-slate-500 text-sm font-medium">মোট আয়</h3>
          <p className="text-3xl font-bold text-emerald-600 mt-2">৳ {totalIncome.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm lg:col-span-2">
          <h3 className="text-slate-500 text-sm font-medium">মোট ব্যয়</h3>
          <p className="text-3xl font-bold text-rose-600 mt-2">৳ {totalExpense.toLocaleString('en-IN')}</p>
        </div>

      </div>

      <ReportingCharts 
        incomeExpenseData={incomeExpenseData} 
        attendanceData={attendanceData} 
        examPassRateData={examPassRateData} 
      />
    </div>
  );

}
