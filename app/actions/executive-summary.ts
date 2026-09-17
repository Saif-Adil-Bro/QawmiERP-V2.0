"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";
import { getMadrasaMetadata } from "@/lib/sessions";
import { getFeeMetadata } from "./fee-management";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import { getFunds } from "./zakat";
import { isTransactionInFund, parseExpenseFund, FundItem } from "@/lib/fund-utils";
import { getSyllabusDashboardData } from "./syllabus";

export interface MonthlyExecutiveSummaryData {
  monthStr: string; // YYYY-MM
  monthNameBn: string;
  generatedAt: string;
  madrasaInfo: {
    name: string;
    address: string;
    phone: string;
    email: string;
    regNo: string;
    principalName?: string;
    slogan?: string;
  };
  metrics: {
    // Academic & Students
    totalStudents: number;
    activeClasses: number;
    totalTeachers: number;
    totalStaff: number;

    // Attendance
    attendanceRate: number;
    totalWorkingDays: number;
    totalPresents: number;
    totalAbsents: number;
    totalLeaves: number;
    topAttendanceClass: string;

    // Hifz & Academic Progress
    hifzStudentsCount: number;
    hifzKhatamCount: number;
    hifzParasCompletedTotal: number;
    syllabusCompletionRate: number;

    // Financial
    totalIncome: number;
    feeCollection: number;
    zakatCollection: number;
    generalDonations: number;
    mahfilCollection: number;

    totalExpense: number;
    generalExpenses: number;
    boardingBazarExpense: number;

    netBalance: number; // Surplus or Deficit

    // Due & Arrears
    totalDueAmount: number;
    studentsWithDueCount: number;

    // Leaves & Admin
    leavesCount: number;
    earlyWarningAlertCount: number;
  };
  fundsBreakdown: {
    fundId: string;
    fundName: string;
    code: string;
    category: string;
    income: number;
    expense: number;
    balance: number;
    totalReserve: number;
  }[];
}

const MONTH_NAMES_BN: Record<string, string> = {
  "01": "জানুয়ারি",
  "02": "ফেব্রুয়ারি",
  "03": "মার্চ",
  "04": "এপ্রিল",
  "05": "মে",
  "06": "জুন",
  "07": "জুলাই",
  "08": "আগস্ট",
  "09": "সেপ্টেম্বর",
  "10": "অক্টোবর",
  "11": "নভেম্বর",
  "12": "ডিসেম্বর",
};

export async function getMonthlyExecutiveSummary(
  targetMonth?: string // Format: "YYYY-MM" (e.g. "2026-09")
): Promise<MonthlyExecutiveSummaryData> {
  const currentMonth = targetMonth || new Date().toISOString().substring(0, 7);
  const [yearStr, monthNumStr] = currentMonth.split("-");
  const monthNameBn = `${MONTH_NAMES_BN[monthNumStr] || monthNumStr} ${yearStr}`;

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const adminClient = await createAdminClient();
  const madrasaId = await getAuthMadrasaId(supabase, user);

  // 1. Fetch Madrasa info & metadata
  const [madrasaInfoRaw, meta, feeMeta, allFundsList] = await Promise.all([
    getMadrasaInfo(madrasaId),
    getMadrasaMetadata(madrasaId),
    getFeeMetadata(madrasaId),
    getFunds(),
  ]);

  // 2. Concurrently fetch all core database entities
  const [
    studentsRes,
    classesRes,
    teachersRes,
    staffRes,
    attendanceRes,
    expensesRes,
    donationsRes,
    dbFeesRes,
    hifzLogsRes,
  ] = await Promise.all([
    adminClient.from("students").select("id, class_id, is_active").eq("madrasa_id", madrasaId),
    adminClient.from("classes").select("id, name").eq("madrasa_id", madrasaId),
    adminClient.from("teachers").select("id, first_name, last_name, is_active").eq("madrasa_id", madrasaId),
    adminClient.from("staff").select("id, designation, role, is_active").eq("madrasa_id", madrasaId),
    adminClient
      .from("attendance")
      .select("status, date, class_id, student_id")
      .eq("madrasa_id", madrasaId)
      .gte("date", `${currentMonth}-01`)
      .lte("date", `${currentMonth}-31`),
    adminClient
      .from("expenses")
      .select("id, amount, expense_date, category, description, voucher_no")
      .eq("madrasa_id", madrasaId)
      .gte("expense_date", `${currentMonth}-01`)
      .lte("expense_date", `${currentMonth}-31`),
    adminClient
      .from("donations")
      .select("id, amount, donation_date, category, donation_type, donor_name, donor_id, receipt_no, notes")
      .eq("madrasa_id", madrasaId)
      .gte("donation_date", `${currentMonth}-01`)
      .lte("donation_date", `${currentMonth}-31`),
    adminClient.from("fees").select("*").eq("madrasa_id", madrasaId),
    adminClient.from("hifz_logs").select("student_id, sabak_para, saboki_para, amukhta_para, log_date").eq("madrasa_id", madrasaId),
  ]);

  const students = studentsRes.data || [];
  const classes = classesRes.data || [];
  const teachers = teachersRes.data || [];
  const staff = staffRes.data || [];
  const attendance = attendanceRes.data || [];
  const dbExpenses = expensesRes.data || [];
  const dbDonations = donationsRes.data || [];
  const dbFees = dbFeesRes.data || [];
  const hifzLogs = hifzLogsRes.data || [];

  // Active counts
  const totalStudents = students.filter((s: any) => s.is_active !== false).length || students.length;
  const activeClasses = classes.length;
  
  // Real Teacher count (from teachers table + teaching staff)
  const teacherIdSet = new Set(teachers.map((t: any) => t.id));
  staff.forEach((s: any) => {
    const des = (s.designation || "").toLowerCase();
    const role = (s.role || "").toLowerCase();
    if (des.includes("শিক্ষক") || des.includes("মুহাদ্দিস") || des.includes("উস্তাদ") || des.includes("মুফতি") || role.includes("teacher")) {
      teacherIdSet.add(s.id);
    }
  });
  const totalTeachers = teacherIdSet.size || teachers.length;
  const totalStaff = staff.length || teachers.length;

  // 3. Attendance Analytics for Target Month
  let totalPresents = 0;
  let totalAbsents = 0;
  let totalLeaves = 0;
  const uniqueDates = new Set<string>();
  const classAttendanceMap: Record<string, { present: number; total: number }> = {};

  attendance.forEach((a: any) => {
    if (a.date) uniqueDates.add(a.date);
    if (a.status === "Present" || a.status === "উপস্থিত") totalPresents++;
    else if (a.status === "Absent" || a.status === "অনুপস্থিত") totalAbsents++;
    else if (a.status === "Leave" || a.status === "ছুটি") totalLeaves++;

    if (a.class_id) {
      if (!classAttendanceMap[a.class_id]) classAttendanceMap[a.class_id] = { present: 0, total: 0 };
      classAttendanceMap[a.class_id].total++;
      if (a.status === "Present" || a.status === "উপস্থিত") classAttendanceMap[a.class_id].present++;
    }
  });

  const totalAttendanceEntries = totalPresents + totalAbsents + totalLeaves;
  const attendanceRate = totalAttendanceEntries > 0 ? Math.round((totalPresents / totalAttendanceEntries) * 100) : 0;

  let topAttendanceClass = totalAttendanceEntries > 0 ? "সকল জামাত স্বাভাবিক" : "হাজিরা এন্ট্রি নেই";
  let highestRatio = -1;
  Object.keys(classAttendanceMap).forEach((cId) => {
    const entry = classAttendanceMap[cId];
    if (entry.total >= 1) {
      const ratio = entry.present / entry.total;
      if (ratio > highestRatio) {
        highestRatio = ratio;
        const cl = classes.find((c: any) => c.id === cId);
        if (cl) topAttendanceClass = `${cl.name} (${Math.round(ratio * 100)}%)`;
      }
    }
  });

  // 4. Hifz & Academic Progress
  const hifzClassIds = new Set(
    classes.filter((c: any) => (c.name || "").includes("হিফজ") || (c.name || "").includes("তাহফিজ")).map((c: any) => c.id)
  );
  const hifzStudentIds = new Set<string>();
  students.forEach((s: any) => {
    if (s.class_id && hifzClassIds.has(s.class_id)) hifzStudentIds.add(s.id);
  });
  hifzLogs.forEach((l: any) => {
    if (l.student_id) hifzStudentIds.add(l.student_id);
  });
  (meta.hifz_records || []).forEach((hr: any) => {
    if (hr.student_id || hr.id) hifzStudentIds.add(hr.student_id || hr.id);
  });

  const hifzStudentsCount = hifzStudentIds.size;
  let hifzParasCompletedTotal = 0;
  let hifzKhatamCount = 0;

  // Calculate max paras per student from logs or meta records
  const studentMaxParaMap = new Map<string, number>();
  (meta.hifz_records || []).forEach((h: any) => {
    const p = Number(h.current_para || h.total_paras || 0);
    const sId = h.student_id || h.id;
    if (sId) {
      studentMaxParaMap.set(sId, Math.max(studentMaxParaMap.get(sId) || 0, p));
    }
    if (h.is_hafez || p >= 30) hifzKhatamCount++;
  });

  hifzLogs.forEach((l: any) => {
    const p = Number(l.sabak_para || l.saboki_para || l.amukhta_para || 0);
    if (l.student_id && p > 0) {
      studentMaxParaMap.set(l.student_id, Math.max(studentMaxParaMap.get(l.student_id) || 0, p));
    }
  });

  studentMaxParaMap.forEach((maxP) => {
    hifzParasCompletedTotal += maxP;
    if (maxP >= 30 && !hifzKhatamCount) hifzKhatamCount++;
  });

  // Calculate real syllabus completion rate
  let syllabusCompletionRate = 0;
  try {
    const syllabusRes = await getSyllabusDashboardData();
    if (syllabusRes && syllabusRes.success && syllabusRes.data) {
      syllabusCompletionRate = Math.round(syllabusRes.data.overallProgress || 0);
    }
  } catch {
    syllabusCompletionRate = 0;
  }

  // 5. 100% Dynamic Financial & Funds Calculations for Selected Month
  const fundsList: FundItem[] = allFundsList && allFundsList.length > 0 ? allFundsList : [];
  
  // Track fund inflows and outflows for the month
  const monthlyFundInflowMap = new Map<string, number>();
  const monthlyFundOutflowMap = new Map<string, number>();
  fundsList.forEach((f) => {
    monthlyFundInflowMap.set(f.id, 0);
    monthlyFundOutflowMap.set(f.id, 0);
  });

  let feeCollection = 0;
  let zakatCollection = 0;
  let generalDonations = 0;
  let mahfilCollection = 0;
  let totalDueAmount = 0;
  let studentsWithDueCount = 0;

  // A. Student Fee Payments in current month
  const allPayments = feeMeta.payments || [];
  allPayments.forEach((p: any) => {
    if (p.status === "REVERSED" || p.status === "VOID") return;
    const pDate = p.payment_date || (p.created_at ? p.created_at.split("T")[0] : "");
    if (pDate.startsWith(currentMonth)) {
      const totalRec = Number(p.total_amount_received || 0);
      feeCollection += totalRec;

      if (p.allocations && p.allocations.length > 0) {
        p.allocations.forEach((alloc: any) => {
          const allocAmt = Number(alloc.allocated_amount || 0);
          if (allocAmt > 0) {
            const targetFund = fundsList.find((f) =>
              isTransactionInFund(f, alloc.fund_id, alloc.fund_name || alloc.fee_type_name, fundsList)
            ) || fundsList[0];
            if (targetFund) {
              monthlyFundInflowMap.set(
                targetFund.id,
                (monthlyFundInflowMap.get(targetFund.id) || 0) + allocAmt
              );
            }
          }
        });
      } else {
        const targetFund = fundsList.find((f) =>
          isTransactionInFund(f, p.fund_id, p.fund_name, fundsList)
        ) || fundsList[0];
        if (targetFund) {
          monthlyFundInflowMap.set(
            targetFund.id,
            (monthlyFundInflowMap.get(targetFund.id) || 0) + totalRec
          );
        }
      }
    }
  });

  // Calculate real student due amounts
  const studentFees = feeMeta.student_fees || [];
  studentFees.forEach((fee: any) => {
    const due = Number(fee.due_amount || 0);
    if (due > 0 && fee.status !== "PAID") {
      totalDueAmount += due;
      studentsWithDueCount++;
    }
  });

  // B. Real Donations & Zakat in current month
  dbDonations.forEach((d: any) => {
    const amt = Number(d.amount || 0);
    const cat = (d.category || d.donation_type || "").toLowerCase();
    const isZakat = cat.includes("zakat") || cat.includes("যাকাত") || cat.includes("lillah") || cat.includes("লিল্লাহ") || cat.includes("fitra") || cat.includes("ফিতরা");
    if (isZakat) {
      zakatCollection += amt;
    } else {
      generalDonations += amt;
    }

    const targetFund = fundsList.find((f) =>
      isTransactionInFund(f, (d as any).fund_id, d.donation_type || d.category, fundsList)
    ) || fundsList[0];

    if (targetFund) {
      monthlyFundInflowMap.set(
        targetFund.id,
        (monthlyFundInflowMap.get(targetFund.id) || 0) + amt
      );
    }
  });

  // Donor subscription payments in metadata
  (meta.donor_subscription_payments || []).forEach((sp: any) => {
    const spDate = sp.date || sp.created_at || "";
    if (spDate.startsWith(currentMonth)) {
      const amt = Number(sp.amount || 0);
      generalDonations += amt;
      const targetFund = fundsList.find((f) =>
        isTransactionInFund(f, sp.fund_id, sp.fund_name, fundsList)
      ) || fundsList[0];
      if (targetFund) {
        monthlyFundInflowMap.set(
          targetFund.id,
          (monthlyFundInflowMap.get(targetFund.id) || 0) + amt
        );
      }
    }
  });

  // Online verified donations in metadata
  (meta.online_donations || []).forEach((od: any) => {
    const odDate = od.date || od.created_at || "";
    if (odDate.startsWith(currentMonth) && (od.status === "VERIFIED" || od.status === "COMPLETED" || od.status === "SUCCESS")) {
      const amt = Number(od.amount || 0);
      generalDonations += amt;
      const targetFund = fundsList.find((f) =>
        isTransactionInFund(f, od.fund_id, od.fund_category || od.fund_name || od.purpose, fundsList)
      ) || fundsList[0];
      if (targetFund) {
        monthlyFundInflowMap.set(
          targetFund.id,
          (monthlyFundInflowMap.get(targetFund.id) || 0) + amt
        );
      }
    }
  });

  // Mahfil collections in current month
  (meta.mahfils || []).forEach((m: any) => {
    (m.receipt_books || []).forEach((b: any) => {
      (b.deposit_history || []).forEach((dep: any) => {
        if (dep.date && dep.date.startsWith(currentMonth)) {
          const amt = Number(dep.amount || 0);
          mahfilCollection += amt;
          const targetFund = fundsList.find((f) => isTransactionInFund(f, undefined, "সাধারণ ফান্ড", fundsList)) || fundsList[0];
          if (targetFund) {
            monthlyFundInflowMap.set(
              targetFund.id,
              (monthlyFundInflowMap.get(targetFund.id) || 0) + amt
            );
          }
        }
      });
    });
  });

  const totalIncome = feeCollection + zakatCollection + generalDonations + mahfilCollection;

  // C. Expenses Calculations in current month
  let generalExpenses = 0;
  let boardingBazarExpense = 0;

  dbExpenses.forEach((e: any) => {
    const amt = Number(e.amount || 0);
    const cat = (e.category || "").toLowerCase();
    const desc = (e.description || "").toLowerCase();
    const isBazar = cat.includes("বাজার") || cat.includes("বোর্ডিং") || cat.includes("খাবার") || desc.includes("বাজার") || desc.includes("খাবার");
    
    if (isBazar) {
      boardingBazarExpense += amt;
    } else {
      generalExpenses += amt;
    }

    const parsed = parseExpenseFund(e.description);
    const targetFund = fundsList.find((f) =>
      isTransactionInFund(f, parsed.fundId, parsed.fundName || e.category, fundsList)
    ) || (isBazar ? fundsList.find(f => f.code === "LIL" || f.name.includes("লিল্লাহ")) : fundsList[0]);

    if (targetFund) {
      monthlyFundOutflowMap.set(
        targetFund.id,
        (monthlyFundOutflowMap.get(targetFund.id) || 0) + amt
      );
    }
  });

  // Boarding bazar logs from metadata
  (meta.boarding_bazar_logs || []).forEach((b: any) => {
    if (b.date && b.date.startsWith(currentMonth)) {
      const amt = Number(b.amount || b.total_cost || 0);
      boardingBazarExpense += amt;
      const lillahFund = fundsList.find(f => f.code === "LIL" || f.name.includes("লিল্লাহ")) || fundsList[0];
      if (lillahFund) {
        monthlyFundOutflowMap.set(
          lillahFund.id,
          (monthlyFundOutflowMap.get(lillahFund.id) || 0) + amt
        );
      }
    }
  });

  const totalExpense = generalExpenses + boardingBazarExpense;
  const netBalance = totalIncome - totalExpense;

  // D. Construct Real Dynamic Funds Breakdown
  const fundsBreakdown = fundsList.map((fund) => {
    const mIncome = monthlyFundInflowMap.get(fund.id) || 0;
    const mExpense = monthlyFundOutflowMap.get(fund.id) || 0;
    const mBalance = mIncome - mExpense;
    return {
      fundId: fund.id,
      fundName: fund.name,
      code: fund.code,
      category: fund.category,
      income: mIncome,
      expense: mExpense,
      balance: mBalance,
      totalReserve: Number(fund.current_balance || 0),
    };
  });

  // Calculate leaves in target month
  const leavesCount = (meta.leaves || []).filter((l: any) => {
    const d = l.start_date || l.date || "";
    return d.startsWith(currentMonth);
  }).length;

  const earlyWarningAlertCount = (meta.early_warnings || []).length;

  return {
    monthStr: currentMonth,
    monthNameBn,
    generatedAt: new Date().toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" }),
    madrasaInfo: {
      name: madrasaInfoRaw?.name || "কওমি মাদরাসা",
      address: madrasaInfoRaw?.address || "মাদরাসা প্রাঙ্গণ",
      phone: madrasaInfoRaw?.phone || "০১৭০০-০০০০০০",
      email: madrasaInfoRaw?.email || "info@madrasa.org",
      regNo: madrasaInfoRaw?.reg_no || madrasaInfoRaw?.registration_no || "কওমি-রেজি-২০২৪",
      principalName: madrasaInfoRaw?.principal_name || "মুহতামিম সাহেব",
      slogan: madrasaInfoRaw?.slogan || "ইলমে ওহীর আদর্শ শিক্ষাকেন্দ্র",
    },
    metrics: {
      totalStudents: totalStudents || 0,
      activeClasses: activeClasses || 0,
      totalTeachers: totalTeachers || 0,
      totalStaff: totalStaff || 0,

      attendanceRate,
      totalWorkingDays: uniqueDates.size || (attendance.length > 0 ? uniqueDates.size : 0),
      totalPresents,
      totalAbsents,
      totalLeaves,
      topAttendanceClass,

      hifzStudentsCount,
      hifzKhatamCount,
      hifzParasCompletedTotal,
      syllabusCompletionRate,

      totalIncome,
      feeCollection,
      zakatCollection,
      generalDonations,
      mahfilCollection,

      totalExpense,
      generalExpenses,
      boardingBazarExpense,

      netBalance,

      totalDueAmount,
      studentsWithDueCount,

      leavesCount,
      earlyWarningAlertCount,
    },
    fundsBreakdown,
  };
}
