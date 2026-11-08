const fs = require('fs');

const path = 'app/dashboard/page.tsx';
let code = fs.readFileSync(path, 'utf8');

const importStatement = `import ReportingCharts from "./components/ReportingCharts";\n`;

code = code.replace(`import { createClient } from "@/lib/supabase/server";`, `import { createClient } from "@/lib/supabase/server";\n${importStatement}`);

// We need to fetch data for the charts
const fetchCode = `
        supabase.from("fees").select("amount, payment_date").eq("madrasa_id", profile.madrasa_id),
        supabase.from("donations").select("amount, donation_date").eq("madrasa_id", profile.madrasa_id),
        supabase.from("expenses").select("amount, expense_date").eq("madrasa_id", profile.madrasa_id),
        supabase.from("bazar_expenses").select("amount, expense_date").eq("madrasa_id", profile.madrasa_id),
        supabase.from("attendance").select("status").eq("madrasa_id", profile.madrasa_id).gte("date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
        supabase.from("exam_results").select("marks_obtained, total_marks, exams(name)").eq("madrasa_id", profile.madrasa_id)
`;

code = code.replace(
  `        supabase.from("fees").select("amount").eq("madrasa_id", profile.madrasa_id),
        supabase.from("donations").select("amount").eq("madrasa_id", profile.madrasa_id),
        supabase.from("expenses").select("amount").eq("madrasa_id", profile.madrasa_id),
        supabase.from("bazar_expenses").select("amount").eq("madrasa_id", profile.madrasa_id)
      ]);`,
  `${fetchCode}      ]);`
);

const destructureCode = `
        { data: feesData },
        { data: donationsData },
        { data: expensesData },
        { data: bazarData },
        { data: attendanceAllData },
        { data: examResultsData }
`;
code = code.replace(
  `        { data: feesData },
        { data: donationsData },
        { data: expensesData },
        { data: bazarData }`,
  destructureCode
);

const processDataCode = `
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

      const incomeExpenseData = Object.keys(monthlyData).sort().map(month => ({
        month,
        income: monthlyData[month].income,
        expense: monthlyData[month].expense
      })).slice(-6); // last 6 months

      // Process Attendance Rate
      let presentTotal = 0;
      let absentTotal = 0;
      let leaveTotal = 0;
      (attendanceAllData || []).forEach((a: any) => {
        if (a.status === 'Present') presentTotal++;
        else if (a.status === 'Absent') absentTotal++;
        else if (a.status === 'Leave') leaveTotal++;
      });
      const attendanceData = [
        { name: 'উপস্থিত', value: presentTotal },
        { name: 'অনুপস্থিত', value: absentTotal },
        { name: 'ছুটি', value: leaveTotal }
      ].filter(d => d.value > 0);

      // Process Exam Pass Rate
      const examStats: Record<string, { total: number; passed: number }> = {};
      (examResultsData || []).forEach((r: any) => {
        const examName = r.exams?.name || 'অজানা পরীক্ষা';
        if (!examStats[examName]) examStats[examName] = { total: 0, passed: 0 };
        examStats[examName].total++;
        const percent = (Number(r.marks_obtained) / Number(r.total_marks)) * 100;
        if (percent >= 33) {
          examStats[examName].passed++;
        }
      });
      
      const examPassRateData = Object.keys(examStats).map(exam => ({
        exam,
        passRate: (examStats[exam].passed / examStats[exam].total) * 100
      }));
`;

code = code.replace(
  `      const feesSum = (feesData || []).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
      const donationsSum = (donationsData || []).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
      totalIncome = feesSum + donationsSum;

      const expensesSum = (expensesData || []).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
      const bazarSum = (bazarData || []).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
      totalExpense = expensesSum + bazarSum;`,
  processDataCode
);

// Declare the variables before the try block
code = code.replace(
  `  let totalExpense = 0;`,
  `  let totalExpense = 0;
  let incomeExpenseData: any[] = [];
  let attendanceData: any[] = [];
  let examPassRateData: any[] = [];`
);

// Assign local variables to the outer ones
code = code.replace(
  `      const examPassRateData = Object.keys(examStats).map(exam => ({`,
  `      incomeExpenseData = Object.keys(monthlyData).sort().map(month => ({
        month,
        income: monthlyData[month].income,
        expense: monthlyData[month].expense
      })).slice(-6); // last 6 months

      attendanceData = [
        { name: 'উপস্থিত', value: presentTotal },
        { name: 'অনুপস্থিত', value: absentTotal },
        { name: 'ছুটি', value: leaveTotal }
      ].filter(d => d.value > 0);

      examPassRateData = Object.keys(examStats).map(exam => ({`
);

// We need to clean up the redeclarations in processDataCode
code = code.replace(`const incomeExpenseData = Object.keys(monthlyData).sort()`, `// previously declared incomeExpenseData here`);
code = code.replace(`const attendanceData = [`, `// previously declared attendanceData here`);


const JSXCode = `
      </div>

      <ReportingCharts 
        incomeExpenseData={incomeExpenseData} 
        attendanceData={attendanceData} 
        examPassRateData={examPassRateData} 
      />
    </div>
  );
`;

code = code.replace(
  `      </div>
    </div>
  );`,
  JSXCode
);

fs.writeFileSync(path, code);
