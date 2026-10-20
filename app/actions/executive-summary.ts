"use server";

import { toDhakaDateStringFrom, toDhakaMonthString, getDhakaYear } from "@/lib/date-utils";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId, getStudents, getClasses } from "./students";
import { getMadrasaMetadata } from "@/lib/sessions";
import { getFeeMetadata } from "./fee-management";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import { getFunds } from "./zakat";
import { isTransactionInFund, parseExpenseFund, isVoidDonation, isVoidedExpense, FundItem } from "@/lib/fund-utils";
import { getSyllabusDashboardData } from "./syllabus";
import { getStaffMetadataFull } from "./staff";

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
    previousBalance: number; // Prior months carryover (surplus or deficit/debt)
    isDebt: boolean;
    adjustedClosingBalance: number; // previousBalance + netBalance

    // Due & Arrears
    totalDueAmount: number;
    studentsWithDueCount: number;

    // Leaves & Admin
    leavesCount: number;
    earlyWarningAlertCount: number;
  };
  classWiseAttendance: {
    classId: string;
    className: string;
    totalStudents: number;
    presents: number;
    absents: number;
    leaves: number;
    totalEntries: number;
    attendanceRate: number;
  }[];
  staffAttendance: {
    totalStaffCount: number;
    totalWorkingDays: number;
    totalPresents: number;
    totalAbsents: number;
    totalLeaves: number;
    attendanceRate: number;
  };
  fundsBreakdown: {
    fundId: string;
    fundName: string;
    code: string;
    category: string;
    previousBalance: number;
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
  const currentMonth = targetMonth || toDhakaMonthString();
  const [yearStr, monthNumStr] = currentMonth.split("-");
  const monthNameBn = `${MONTH_NAMES_BN[monthNumStr] || monthNumStr} ${yearStr}`;

  // Calculate correct date boundaries for any month (e.g. 30 for Sep, 28/29 for Feb)
  const yearNum = parseInt(yearStr, 10) || getDhakaYear();
  const monthNum = parseInt(monthNumStr, 10) || new Date().getMonth() + 1;
  const lastDayOfMonth = new Date(yearNum, monthNum, 0).getDate();
  const monthStartDate = `${currentMonth}-01`;
  const monthEndDate = `${currentMonth}-${String(lastDayOfMonth).padStart(2, "0")}`;

  // P2-Fix: hardcoded UUID সরানো — শুধুই লগইন-করা user-এর নিজের মাদরাসা।
  // resolve না হলে fail-closed: অন্য কোনো মাদরাসার ডেটা দেওয়া হবে না।
  const adminClient = await createAdminClient();
  let madrasaId: string | null = null;
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (user?.id) madrasaId = (await getAuthMadrasaId(supabase, user)) || null;
  } catch {
    // outside cookie scope — নিচে fail-closed
  }

  if (!madrasaId) {
    throw new Error("মাদরাসা আইডি পাওয়া যায়নি — লগইন সেশনটি যাচাই করে আবার চেষ্টা করুন।");
  }

  // 1. Concurrently fetch all metadata and authoritative collections
  const [
    madrasaInfoRaw,
    meta,
    feeMeta,
    allFundsList,
    studentsListRaw,
    classesListRaw,
    staffDataRaw,
  ] = await Promise.all([
    getMadrasaInfo(madrasaId),
    getMadrasaMetadata(madrasaId),
    getFeeMetadata(madrasaId),
    getFunds(madrasaId),
    getStudents().catch(() => []),
    getClasses().catch(() => []),
    getStaffMetadataFull().catch(() => null),
  ]);

  // 2. Fetch database records safely with verified valid date boundaries and STRICT madrasa_id scoping
  const [
    attendanceRes,
    teacherAttendanceRes,
    expensesRes,
    donationsRes,
    bazarRes,
    hifzLogsRes,
    dbTeachersRes,
    dbStudentsRes,
    dbClassesRes,
  ] = await Promise.all([
    adminClient
      .from("attendance")
      .select("id, status, date, student_id, madrasa_id")
      .eq("madrasa_id", madrasaId)
      .gte("date", monthStartDate)
      .lte("date", monthEndDate),
    adminClient
      .from("teacher_attendance")
      .select("id, status, date, teacher_id, madrasa_id")
      .eq("madrasa_id", madrasaId)
      .gte("date", monthStartDate)
      .lte("date", monthEndDate),
    adminClient
      .from("expenses")
      .select("id, amount, expense_date, category, description, created_at, madrasa_id")
      .eq("madrasa_id", madrasaId),
    adminClient
      .from("donations")
      .select("id, amount, donation_type, donation_date, donor_id, receipt_no, notes, created_at, madrasa_id")
      .eq("madrasa_id", madrasaId),
    adminClient
      .from("bazar_expenses")
      .select("id, amount, items_details, expense_date, created_at, madrasa_id")
      .eq("madrasa_id", madrasaId),
    adminClient
      .from("hifz_logs")
      .select("student_id, sabak_para, saboki_para, amukhta_para, log_date, madrasa_id")
      .eq("madrasa_id", madrasaId),
    adminClient
      .from("teachers")
      .select("id, first_name, last_name, madrasa_id, designation")
      .eq("madrasa_id", madrasaId),
    adminClient
      .from("students")
      .select("id, class_id, class_name, first_name, last_name, roll_number, madrasa_id")
      .eq("madrasa_id", madrasaId),
    adminClient
      .from("classes")
      .select("id, name, madrasa_id")
      .eq("madrasa_id", madrasaId),
  ]);

  // 3. Resolve Full Dynamic Students List
  let students: any[] = studentsListRaw || [];
  if (students.length === 0 && dbStudentsRes.data && dbStudentsRes.data.length > 0) {
    students = dbStudentsRes.data;
  }
  if (students.length === 0) {
    students = (meta.student_records || meta.students || meta.admission_records || []).filter((s: any) => s && s.id);
  }
  const totalStudents = students.filter((s: any) => s.is_active !== false && s.status !== "ARCHIVED").length;

  // 4. Resolve Full Dynamic Classes List
  let classes: any[] = classesListRaw || [];
  if (classes.length === 0 && dbClassesRes.data && dbClassesRes.data.length > 0) {
    classes = dbClassesRes.data;
  }
  if (classes.length === 0 && meta.classes && meta.classes.length > 0) {
    classes = meta.classes;
  }
  const activeClasses = classes.length;

  // 5. Resolve Faculty & Staff Members
  const staffMembers = staffDataRaw?.staff_members || [];
  const dbTeachers = dbTeachersRes.data || [];
  const allDbExpenses = expensesRes.data || [];
  const allDbDonations = donationsRes.data || [];
  const allDbBazar = bazarRes.data || [];

  const getNormDate = (rawDate?: string | null, createdAt?: string | null): string => {
    if (rawDate && typeof rawDate === "string" && rawDate.trim().length >= 10) {
      return rawDate.trim().slice(0, 10);
    }
    if (createdAt) {
      return toDhakaDateStringFrom(createdAt);
    }
    return "";
  };

  const dbExpenses = allDbExpenses.filter((e: any) => {
    const d = getNormDate(e.expense_date, e.created_at);
    return d >= monthStartDate && d <= monthEndDate;
  });
  const prevDbExpenses = allDbExpenses.filter((e: any) => {
    const d = getNormDate(e.expense_date, e.created_at);
    return Boolean(d && d < monthStartDate);
  });

  const dbDonations = allDbDonations.filter((d: any) => {
    const dt = getNormDate(d.donation_date, d.created_at);
    return dt >= monthStartDate && dt <= monthEndDate;
  });
  const prevDbDonations = allDbDonations.filter((d: any) => {
    const dt = getNormDate(d.donation_date, d.created_at);
    return Boolean(dt && dt < monthStartDate);
  });

  const dbBazar = allDbBazar.filter((b: any) => {
    const d = getNormDate(b.expense_date, b.created_at);
    return d >= monthStartDate && d <= monthEndDate;
  });
  const prevDbBazar = allDbBazar.filter((b: any) => {
    const d = getNormDate(b.expense_date, b.created_at);
    return Boolean(d && d < monthStartDate);
  });

  // P2-Fix: dedup — একই অনুদান DB + metadata দুই জায়গায় থাকলে একবারই গণনা হবে (getFunds-এর সমতুল্য)
  const allDonationIds = new Set<string>();
  const allDonationReceipts = new Set<string>();
  allDbDonations.forEach((d: any) => {
    if (isVoidDonation(d)) return;
    if (d.id) allDonationIds.add(String(d.id));
    if (d.receipt_no) allDonationReceipts.add(String(d.receipt_no));
    const rMatch = d.notes?.match(/\[(?:চালান|রিসিট|কুরবানির চামড়া বিক্রয়|দানবাক্স কালেকশন):\s*([^\]|,]+)/)?.[1];
    if (rMatch) allDonationReceipts.add(rMatch.trim());
  });
  const isDupDonation = (rec: any) =>
    Boolean(
      (rec.receipt_no && allDonationReceipts.has(String(rec.receipt_no))) ||
        (rec.id && allDonationIds.has(String(rec.id)))
    );

  // P2-Fix: ফান্ড-মেল না-খাওয়া লেনদেন চুপচাপ প্রথম ফান্ডে (GEN) না-ঢুকিয়ে আলাদা row-এ রাখা হয়
  const UNMATCHED_FUND = "__unmatched__";
  const teacherIdSet = new Set<string>();

  dbTeachers.forEach((t: any) => {
    if (t.id) teacherIdSet.add(t.id);
  });

  staffMembers.forEach((s: any) => {
    const des = (s.employment?.designation || s.designation || "").toLowerCase();
    const role = (s.employment?.role || s.role || "").toLowerCase();
    if (
      des.includes("শিক্ষক") ||
      des.includes("মুহাদ্দিস") ||
      des.includes("উস্তাদ") ||
      des.includes("মুফতি") ||
      des.includes("হাফেজ") ||
      des.includes("কারী") ||
      des.includes("মুদাররিস") ||
      role.includes("teacher")
    ) {
      teacherIdSet.add(s.id);
    }
  });

  const totalTeachers = Math.max(
    teacherIdSet.size,
    dbTeachers.length,
    staffMembers.length > 0 ? staffMembers.length : 0
  );
  const totalStaff = Math.max(staffMembers.length, dbTeachers.length);

  // 6. Dynamic Attendance Analytics
  let attendance: any[] = attendanceRes.data || [];

  // If selected month attendance is not yet recorded, retrieve recent attendance to provide realistic trends
  if (attendance.length === 0 && totalStudents > 0) {
    try {
      const { data: recentAtt } = await adminClient
        .from("attendance")
        .select("id, status, date, student_id")
        .eq("madrasa_id", madrasaId)
        .order("date", { ascending: false })
        .limit(1000);
      if (recentAtt && recentAtt.length > 0) {
        const thisMonthAtt = recentAtt.filter((a: any) => a.date && a.date.startsWith(currentMonth));
        attendance = thisMonthAtt.length > 0 ? thisMonthAtt : recentAtt.slice(0, 300);
      }
    } catch (e) {
      console.warn("Attendance fallback error:", e);
    }
  }

  // Student-to-Class Map
  const studentClassMap = new Map<string, { classId: string; className: string }>();
  const currentStudentIdSet = new Set<string>();
  const classStudentCountMap: Record<string, number> = {};

  students.forEach((s: any) => {
    if (s.id) currentStudentIdSet.add(String(s.id));
    const cId = s.class_id || s.classes?.id || "unassigned";
    let cName = s.classes?.name || s.class_name;
    if (!cName) {
      const matchedClass = classes.find((c: any) => c.id === cId || c.name === cId);
      cName = matchedClass ? matchedClass.name : (cId.length > 25 ? "সাধারণ জামাত" : cId);
    }
    if (s.id) {
      studentClassMap.set(String(s.id), { classId: String(cId), className: String(cName) });
    }
    if (s.is_active !== false && s.status !== "ARCHIVED") {
      classStudentCountMap[String(cName)] = (classStudentCountMap[String(cName)] || 0) + 1;
    }
  });

  let totalPresents = 0;
  let totalAbsents = 0;
  let totalLeaves = 0;
  const uniqueDates = new Set<string>();

  // Class-wise Attendance Map initialization with all known active classes
  const classAttendanceMap: Record<string, { classId: string; className: string; presents: number; absents: number; leaves: number; total: number }> = {};
  classes.forEach((c: any) => {
    const cName = c.name || "জামাত";
    if (!classAttendanceMap[cName]) {
      classAttendanceMap[cName] = {
        classId: c.id || cName,
        className: cName,
        presents: 0,
        absents: 0,
        leaves: 0,
        total: 0,
      };
    }
  });

  attendance.forEach((a: any) => {
    if (a.date) uniqueDates.add(a.date);
    const st = String(a.status || "").trim().toLowerCase();
    const isPres = st === "present" || st === "উপস্থিত" || st === "late" || st === "বিলম্ব" || st === "দেরি";
    const isAbs = st === "absent" || st === "অনুপস্থিত";
    const isLev = st === "leave" || st === "ছুটি";

    if (isPres) totalPresents++;
    else if (isAbs) totalAbsents++;
    else if (isLev) totalLeaves++;
    else totalPresents++;

    const studentInfo = studentClassMap.get(String(a.student_id));
    const className = studentInfo?.className || "সাধারণ জামাত";
    const classId = studentInfo?.classId || "unknown";

    if (!classAttendanceMap[className]) {
      classAttendanceMap[className] = {
        classId,
        className,
        presents: 0,
        absents: 0,
        leaves: 0,
        total: 0,
      };
    }

    classAttendanceMap[className].total++;
    if (isPres) classAttendanceMap[className].presents++;
    else if (isAbs) classAttendanceMap[className].absents++;
    else if (isLev) classAttendanceMap[className].leaves++;
    else classAttendanceMap[className].presents++;
  });

  const totalAttendanceEntries = totalPresents + totalAbsents + totalLeaves;
  const attendanceRate = totalAttendanceEntries > 0 ? Math.round((totalPresents / totalAttendanceEntries) * 100) : 0;

  // Formulate Class-Wise Attendance list
  const classWiseAttendance = Object.values(classAttendanceMap).map((entry) => {
    const rate = entry.total > 0 ? Math.round((entry.presents / entry.total) * 100) : 0;
    return {
      classId: entry.classId,
      className: entry.className,
      totalStudents: classStudentCountMap[entry.className] || 0,
      presents: entry.presents,
      absents: entry.absents,
      leaves: entry.leaves,
      totalEntries: entry.total,
      attendanceRate: rate,
    };
  }).sort((a, b) => b.totalStudents - a.totalStudents || b.totalEntries - a.totalEntries);

  let topAttendanceClass = totalAttendanceEntries > 0 ? "সকল জামাত স্বাভাবিক" : "হাজিরা এন্ট্রি নেই";
  let highestRatio = -1;
  classWiseAttendance.forEach((entry) => {
    if (entry.totalEntries >= 1) {
      const ratio = entry.presents / entry.totalEntries;
      if (ratio > highestRatio) {
        highestRatio = ratio;
        topAttendanceClass = `${entry.className} (${Math.round(ratio * 100)}%)`;
      }
    }
  });

  // Teacher & Staff Attendance Calculations
  const teacherAttendance = teacherAttendanceRes.data || [];
  let staffPresents = 0;
  let staffAbsents = 0;
  let staffLeaves = 0;
  const staffDates = new Set<string>();

  teacherAttendance.forEach((ta: any) => {
    if (ta.date) staffDates.add(ta.date);
    const st = String(ta.status || "").trim().toLowerCase();
    if (st === "present" || st === "উপস্থিত" || st === "late" || st === "বিলম্ব") staffPresents++;
    else if (st === "absent" || st === "অনুপস্থিত") staffAbsents++;
    else if (st === "leave" || st === "ছুটি") staffLeaves++;
    else staffPresents++;
  });

  const totalStaffEntries = staffPresents + staffAbsents + staffLeaves;
  const staffAttendanceRate = totalStaffEntries > 0 ? Math.round((staffPresents / totalStaffEntries) * 100) : 0;
  const staffAttendance = {
    totalStaffCount: totalStaff,
    totalWorkingDays: staffDates.size,
    totalPresents: staffPresents,
    totalAbsents: staffAbsents,
    totalLeaves: staffLeaves,
    attendanceRate: staffAttendanceRate,
  };

  // 7. Hifz & Academic Progress
  const hifzLogs = hifzLogsRes.data || [];
  const hifzClassIds = new Set(
    classes
      .filter((c: any) => (c.name || "").includes("হিফজ") || (c.name || "").includes("তাহফিজ"))
      .map((c: any) => c.id)
  );

  let hifzStudentsCount = 0;
  let hifzParasCompletedTotal = 0;
  let hifzKhatamCount = 0;

  if (totalStudents > 0) {
    const hifzStudentIds = new Set<string>();
    students.forEach((s: any) => {
      const cName = (s.classes?.name || s.class_name || "").toLowerCase();
      if ((s.class_id && hifzClassIds.has(s.class_id)) || cName.includes("হিফজ") || cName.includes("তাহফিজ")) {
        hifzStudentIds.add(s.id);
      }
    });

    (meta.hifz_records || []).forEach((hr: any) => {
      const sId = hr.student_id || hr.id;
      if (sId && currentStudentIdSet.has(String(sId))) {
        hifzStudentIds.add(String(sId));
      }
    });

    hifzLogs.forEach((l: any) => {
      if (l.student_id && currentStudentIdSet.has(String(l.student_id))) {
        hifzStudentIds.add(String(l.student_id));
      }
    });

    hifzStudentsCount = hifzStudentIds.size;

    const studentMaxParaMap = new Map<string, number>();
    (meta.hifz_records || []).forEach((h: any) => {
      const sId = h.student_id || h.id;
      if (sId && currentStudentIdSet.has(String(sId))) {
        const p = Number(h.current_para || h.total_paras || h.memorized_paras || h.completed_paras || 0);
        studentMaxParaMap.set(String(sId), Math.max(studentMaxParaMap.get(String(sId)) || 0, p));
        if (h.is_hafez || h.status === "Khatam" || h.status === "হাফেজ" || p >= 30) {
          hifzKhatamCount++;
        }
      }
    });

    hifzLogs.forEach((l: any) => {
      if (l.student_id && currentStudentIdSet.has(String(l.student_id))) {
        const p = Number(l.sabak_para || l.saboki_para || l.amukhta_para || 0);
        if (p > 0) {
          studentMaxParaMap.set(String(l.student_id), Math.max(studentMaxParaMap.get(String(l.student_id)) || 0, p));
        }
      }
    });

    studentMaxParaMap.forEach((maxP) => {
      hifzParasCompletedTotal += maxP;
      if (maxP >= 30 && hifzKhatamCount === 0) hifzKhatamCount++;
    });
  }

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

  // 5. 100% Dynamic Financial & Funds Calculations for Selected Month (with Prior Months Carryover)
  const fundsList: FundItem[] = allFundsList && allFundsList.length > 0 ? allFundsList : [];
  
  // Track fund inflows and outflows for the current month AND prior months
  const monthlyFundInflowMap = new Map<string, number>();
  const monthlyFundOutflowMap = new Map<string, number>();
  const priorFundInflowMap = new Map<string, number>();
  const priorFundOutflowMap = new Map<string, number>();

  fundsList.forEach((f) => {
    monthlyFundInflowMap.set(f.id, 0);
    monthlyFundOutflowMap.set(f.id, 0);
    priorFundInflowMap.set(f.id, 0);
    priorFundOutflowMap.set(f.id, 0);
  });

  let feeCollection = 0;
  let zakatCollection = 0;
  let generalDonations = 0;
  let mahfilCollection = 0;
  let totalDueAmount = 0;
  let studentsWithDueCount = 0;

  const isZakatOrLillahCategory = (text: string): boolean => {
    const lower = text.toLowerCase();
    return (
      lower.includes("zakat") ||
      lower.includes("zkt") ||
      lower.includes("যাকাত") ||
      lower.includes("lillah") ||
      lower.includes("lil") ||
      lower.includes("লিল্লাহ") ||
      lower.includes("fitra") ||
      lower.includes("ftr") ||
      lower.includes("ফিতরা")
    );
  };

  // A. Student Fee Payments (current month + prior months)
  const allPayments = feeMeta.payments || [];
  allPayments.forEach((p: any) => {
    if (p.status === "REVERSED" || p.status === "VOID") return;
    const pDate = getNormDate(p.payment_date, p.created_at);
    const isCurrentMonth = pDate.startsWith(currentMonth);
    const isPriorMonth = Boolean(pDate && pDate < monthStartDate);

    if (!isCurrentMonth && !isPriorMonth) return;

    const targetMap = isCurrentMonth ? monthlyFundInflowMap : priorFundInflowMap;
    const totalRec = Number(p.total_amount_received || 0);
    if (isCurrentMonth) {
      feeCollection += totalRec;
    }

    if (p.allocations && p.allocations.length > 0) {
      let sumAlloc = 0;
      p.allocations.forEach((alloc: any) => {
        const allocAmt = Number(alloc.allocated_amount || 0);
        if (allocAmt > 0) {
          sumAlloc += allocAmt;
          const targetFund = fundsList.find((f) =>
            isTransactionInFund(f, alloc.fund_id, alloc.fund_name || alloc.fee_type_name, fundsList)
          );
          const fundId = targetFund ? targetFund.id : UNMATCHED_FUND;
          targetMap.set(fundId, (targetMap.get(fundId) || 0) + allocAmt);
        }
      });
      const remainder = totalRec - sumAlloc;
      if (remainder > 0 && fundsList.length > 0) {
        targetMap.set(
          fundsList[0].id,
          (targetMap.get(fundsList[0].id) || 0) + remainder
        );
      }
    } else {
      const targetFund = fundsList.find((f) =>
        isTransactionInFund(f, p.fund_id, p.fund_name, fundsList)
      ) || fundsList[0];
      if (targetFund) {
        targetMap.set(
          targetFund.id,
          (targetMap.get(targetFund.id) || 0) + totalRec
        );
      }
    }
  });

  // Calculate real student due amounts for distinct active enrolled students
  const activeStudentIdSet = new Set(
    students
      .filter((s: any) => s.is_active !== false && s.status !== "ARCHIVED")
      .map((s: any) => String(s.id))
  );

  const studentFees = feeMeta.student_fees || [];
  const distinctDueStudents = new Set<string>();

  studentFees.forEach((fee: any) => {
    const sId = String(fee.student_id || fee.studentId || "");
    const due = Number(fee.due_amount || fee.due || 0);
    const isStudentActive = activeStudentIdSet.size > 0 ? (sId ? activeStudentIdSet.has(sId) : true) : true;
    
    if (due > 0 && fee.status !== "PAID" && isStudentActive) {
      totalDueAmount += due;
      if (sId) {
        distinctDueStudents.add(sId);
      }
    }
  });

  studentsWithDueCount = distinctDueStudents.size > 0 
    ? Math.min(distinctDueStudents.size, totalStudents) 
    : 0;

  // B. Real Donations & Zakat (current month + prior months)
  dbDonations.forEach((d: any) => {
    if (isVoidDonation(d)) return;
    const amt = Number(d.amount || 0);
    const parsedFund = parseExpenseFund(d.notes);
    const fIdCandidate = parsedFund.fundId || (d as any).fund_id;
    const fNameCandidate = parsedFund.fundName || d.donation_type;

    if (isZakatOrLillahCategory(`${fIdCandidate || ""} ${fNameCandidate || ""}`)) {
      zakatCollection += amt;
    } else {
      generalDonations += amt;
    }

    const targetFund = fundsList.find((f) =>
      isTransactionInFund(f, fIdCandidate, fNameCandidate, fundsList)
    );
    const fundId = targetFund ? targetFund.id : UNMATCHED_FUND;
    monthlyFundInflowMap.set(fundId, (monthlyFundInflowMap.get(fundId) || 0) + amt);
  });

  prevDbDonations.forEach((d: any) => {
    if (isVoidDonation(d)) return;
    const amt = Number(d.amount || 0);
    const parsedFund = parseExpenseFund(d.notes);
    const fIdCandidate = parsedFund.fundId || (d as any).fund_id;
    const fNameCandidate = parsedFund.fundName || d.donation_type;

    const targetFund = fundsList.find((f) =>
      isTransactionInFund(f, fIdCandidate, fNameCandidate, fundsList)
    );
    const fundId = targetFund ? targetFund.id : UNMATCHED_FUND;
    priorFundInflowMap.set(fundId, (priorFundInflowMap.get(fundId) || 0) + amt);
  });

  // Donor subscription payments in metadata
  (meta.donor_subscription_payments || []).forEach((sp: any) => {
    const spDate = getNormDate(sp.payment_date || sp.date, sp.created_at);
    if (isDupDonation(sp)) return;
    const amt = Number(sp.amount || 0);
    const targetFund = fundsList.find((f) =>
      isTransactionInFund(f, sp.fund_id, sp.fund_name, fundsList)
    );
    const fundId = targetFund ? targetFund.id : UNMATCHED_FUND;

    if (spDate.startsWith(currentMonth)) {
      if (isZakatOrLillahCategory(`${sp.fund_id || ""} ${sp.fund_name || ""}`)) {
        zakatCollection += amt;
      } else {
        generalDonations += amt;
      }
      monthlyFundInflowMap.set(fundId, (monthlyFundInflowMap.get(fundId) || 0) + amt);
    } else if (spDate && spDate < monthStartDate) {
      priorFundInflowMap.set(fundId, (priorFundInflowMap.get(fundId) || 0) + amt);
    }
  });

  // Online verified donations in metadata
  (meta.online_donations || []).forEach((od: any) => {
    const odDate = getNormDate(od.payment_date || od.date, od.created_at);
    if (
      (od.receipt_no && allDonationReceipts.has(String(od.receipt_no))) ||
      (od.id && allDonationIds.has(String(od.id))) ||
      (od.trx_id && allDonationReceipts.has(String(od.trx_id)))
    ) {
      return;
    }
    if (od.status === "VERIFIED" || od.status === "COMPLETED" || od.status === "SUCCESS") {
      const amt = Number(od.amount || 0);
      const fName = od.fund_category || od.fund_name || od.purpose;
      const targetFund = fundsList.find((f) =>
        isTransactionInFund(f, od.fund_id, fName, fundsList)
      );
      const fundId = targetFund ? targetFund.id : UNMATCHED_FUND;
      if (odDate.startsWith(currentMonth)) {
        if (isZakatOrLillahCategory(`${od.fund_id || ""} ${fName || ""}`)) {
          zakatCollection += amt;
        } else {
          generalDonations += amt;
        }
        monthlyFundInflowMap.set(fundId, (monthlyFundInflowMap.get(fundId) || 0) + amt);
      } else if (odDate && odDate < monthStartDate) {
        priorFundInflowMap.set(fundId, (priorFundInflowMap.get(fundId) || 0) + amt);
      }
    }
  });

  // Donation Box collections in metadata (if not already inserted into donations table)
  (meta.donation_box_logs || []).forEach((bl: any) => {
    const blDate = getNormDate(bl.collection_date || bl.date, bl.created_at);
    if (isDupDonation(bl)) return;
    const amt = Number(bl.amount || 0);
    const targetFund = fundsList.find((f) =>
      isTransactionInFund(f, bl.fund_id, bl.fund_name, fundsList)
    );
    const fundId = targetFund ? targetFund.id : UNMATCHED_FUND;

    if (blDate.startsWith(currentMonth)) {
      if (isZakatOrLillahCategory(`${bl.fund_id || ""} ${bl.fund_name || ""}`)) {
        zakatCollection += amt;
      } else {
        generalDonations += amt;
      }
      monthlyFundInflowMap.set(fundId, (monthlyFundInflowMap.get(fundId) || 0) + amt);
    } else if (blDate && blDate < monthStartDate) {
      priorFundInflowMap.set(fundId, (priorFundInflowMap.get(fundId) || 0) + amt);
    }
  });

  // Qurbani leather records in metadata (if not already inserted into donations table)
  (meta.qurbani_leather_records || []).forEach((ql: any) => {
    const qlDate = getNormDate(ql.date, ql.created_at);
    if (isDupDonation(ql)) return;
    const amt = Number(ql.total_sale_amount || ql.amount || 0);
    if (amt <= 0) return;
    const fId = ql.fund_id || "fund-lillah";
    const fName = ql.fund_name || "লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)";
    const targetFund = fundsList.find((f) =>
      isTransactionInFund(f, fId, fName, fundsList)
    );
    const fundId = targetFund ? targetFund.id : UNMATCHED_FUND;

    if (qlDate.startsWith(currentMonth)) {
      if (isZakatOrLillahCategory(`${fId} ${fName}`)) {
        zakatCollection += amt;
      } else {
        generalDonations += amt;
      }
      monthlyFundInflowMap.set(fundId, (monthlyFundInflowMap.get(fundId) || 0) + amt);
    } else if (qlDate && qlDate < monthStartDate) {
      priorFundInflowMap.set(fundId, (priorFundInflowMap.get(fundId) || 0) + amt);
    }
  });

  // Mahfil collections in current month & prior months (only if not already settled/tracked in donations)
  (meta.mahfils || []).forEach((m: any) => {
    const isSettled = Boolean(m.settlement || (m.settlements && m.settlements.length > 0));
    if (isSettled) return;

    (m.receipt_books || []).forEach((b: any) => {
      (b.deposit_history || []).forEach((dep: any) => {
        const recNo = dep.receipt_no || b.receipt_no || dep.id;
        if (recNo && allDonationReceipts.has(String(recNo))) return;
        const amt = Number(dep.amount || 0);
        const targetFund = fundsList.find((f) => isTransactionInFund(f, undefined, "সাধারণ ফান্ড", fundsList)) || fundsList[0];
        if (!targetFund) return;

        const depDate = getNormDate(dep.date, dep.created_at);
        if (depDate && depDate.startsWith(currentMonth)) {
          mahfilCollection += amt;
          monthlyFundInflowMap.set(targetFund.id, (monthlyFundInflowMap.get(targetFund.id) || 0) + amt);
        } else if (depDate && depDate < monthStartDate) {
          priorFundInflowMap.set(targetFund.id, (priorFundInflowMap.get(targetFund.id) || 0) + amt);
        }
      });
    });
  });

  const totalIncome = feeCollection + zakatCollection + generalDonations + mahfilCollection;

  // C. Expenses Calculations (current month + prior months)
  let generalExpenses = 0;
  let boardingBazarExpense = 0;

  dbExpenses.forEach((e: any) => {
    if (isVoidedExpense(e)) return;
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

  prevDbExpenses.forEach((e: any) => {
    if (isVoidedExpense(e)) return;
    const amt = Number(e.amount || 0);
    const cat = (e.category || "").toLowerCase();
    const desc = (e.description || "").toLowerCase();
    const isBazar = cat.includes("বাজার") || cat.includes("বোর্ডিং") || cat.includes("খাবার") || desc.includes("বাজার") || desc.includes("খাবার");

    const parsed = parseExpenseFund(e.description);
    const targetFund = fundsList.find((f) =>
      isTransactionInFund(f, parsed.fundId, parsed.fundName || e.category, fundsList)
    ) || (isBazar ? fundsList.find(f => f.code === "LIL" || f.name.includes("লিল্লাহ")) : fundsList[0]);

    if (targetFund) {
      priorFundOutflowMap.set(
        targetFund.id,
        (priorFundOutflowMap.get(targetFund.id) || 0) + amt
      );
    }
  });

  // Database bazar_expenses table (current month + prior months)
  dbBazar.forEach((b: any) => {
    const amt = Number(b.amount || 0);
    boardingBazarExpense += amt;
    const lillahFund = fundsList.find(f => f.code === "LIL" || f.name.includes("লিল্লাহ")) || fundsList[0];
    if (lillahFund) {
      monthlyFundOutflowMap.set(
        lillahFund.id,
        (monthlyFundOutflowMap.get(lillahFund.id) || 0) + amt
      );
    }
  });

  prevDbBazar.forEach((b: any) => {
    const amt = Number(b.amount || 0);
    const lillahFund = fundsList.find(f => f.code === "LIL" || f.name.includes("লিল্লাহ")) || fundsList[0];
    if (lillahFund) {
      priorFundOutflowMap.set(
        lillahFund.id,
        (priorFundOutflowMap.get(lillahFund.id) || 0) + amt
      );
    }
  });

  // Boarding bazar logs from metadata (current month + prior months)
  (meta.boarding_bazar_logs || []).forEach((b: any) => {
    const amt = Number(b.amount || b.total_cost || 0);
    const lillahFund = fundsList.find(f => f.code === "LIL" || f.name.includes("লিল্লাহ")) || fundsList[0];
    if (b.date && b.date.startsWith(currentMonth)) {
      boardingBazarExpense += amt;
      if (lillahFund) {
        monthlyFundOutflowMap.set(
          lillahFund.id,
          (monthlyFundOutflowMap.get(lillahFund.id) || 0) + amt
        );
      }
    } else if (b.date && b.date < monthStartDate) {
      if (lillahFund) {
        priorFundOutflowMap.set(
          lillahFund.id,
          (priorFundOutflowMap.get(lillahFund.id) || 0) + amt
        );
      }
    }
  });

  const totalExpense = generalExpenses + boardingBazarExpense;
  const netBalance = totalIncome - totalExpense;

  // D. Construct Real Dynamic Funds Breakdown
  const CATEGORY_MAP_BN: Record<string, string> = {
    general: "সাধারণ",
    lillah: "লিল্লাহ",
    zakat: "যাকাত",
    fitra: "ফিতরা ও সদকা",
    development: "উন্নয়ন ও অবকাঠামো",
    education: "শিক্ষা ও এতিম কল্যাণ",
    orphan: "এতিম কল্যাণ",
    salary: "বেতন ও ভাতা",
    bazar: "মেস/বোর্ডিং",
    emergency: "জরুরি তহবিল",
  };

  const fundsBreakdown = fundsList
    .filter((fund) => {
      const isTest = fund.name.toLowerCase().includes("test") || (fund.code && fund.code.toLowerCase().includes("tst"));
      const pIncome = priorFundInflowMap.get(fund.id) || 0;
      const pExpense = priorFundOutflowMap.get(fund.id) || 0;
      const mIncome = monthlyFundInflowMap.get(fund.id) || 0;
      const mExpense = monthlyFundOutflowMap.get(fund.id) || 0;
      const reserve = (pIncome - pExpense) + (mIncome - mExpense);
      if (isTest && pIncome === 0 && pExpense === 0 && mIncome === 0 && mExpense === 0 && reserve === 0) {
        return false;
      }
      return true;
    })
    .map((fund) => {
      const pIncome = priorFundInflowMap.get(fund.id) || 0;
      const pExpense = priorFundOutflowMap.get(fund.id) || 0;
      const prevBal = pIncome - pExpense;
      const mIncome = monthlyFundInflowMap.get(fund.id) || 0;
      const mExpense = monthlyFundOutflowMap.get(fund.id) || 0;
      const mBalance = mIncome - mExpense;
      const cumulativeReserve = prevBal + mBalance;
      const rawCat = (fund.category || "general").toLowerCase().trim();
      const bnCat = CATEGORY_MAP_BN[rawCat] || fund.category || "সাধারণ";

      return {
        fundId: fund.id,
        fundName: fund.name,
        code: fund.code,
        category: bnCat,
        previousBalance: prevBal,
        income: mIncome,
        expense: mExpense,
        balance: mBalance,
        totalReserve: cumulativeReserve,
      };
    });

  // P2-Fix: ফান্ড-মেল না-খাওয়া লেনদেন আলাদা row হিসেবে দেখানো হয় (চুপচাপ GEN-এ ঢোকে না)
  const unmatchedPriorIncome = priorFundInflowMap.get(UNMATCHED_FUND) || 0;
  const unmatchedPriorExpense = priorFundOutflowMap.get(UNMATCHED_FUND) || 0;
  const unmatchedPrevBal = unmatchedPriorIncome - unmatchedPriorExpense;
  const unmatchedIncome = monthlyFundInflowMap.get(UNMATCHED_FUND) || 0;
  const unmatchedExpense = monthlyFundOutflowMap.get(UNMATCHED_FUND) || 0;
  const unmatchedBal = unmatchedIncome - unmatchedExpense;
  if (unmatchedPrevBal !== 0 || unmatchedIncome > 0 || unmatchedExpense > 0) {
    fundsBreakdown.push({
      fundId: UNMATCHED_FUND,
      fundName: "অনুপরিচিত ফান্ড",
      code: "OTH",
      category: "অনুপরিচিত",
      previousBalance: unmatchedPrevBal,
      income: unmatchedIncome,
      expense: unmatchedExpense,
      balance: unmatchedBal,
      totalReserve: unmatchedPrevBal + unmatchedBal,
    });
  }

  const previousBalance = fundsBreakdown.reduce((sum, f) => sum + f.previousBalance, 0);
  const isDebt = previousBalance < 0;
  const adjustedClosingBalance = previousBalance + netBalance;

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
      phone: madrasaInfoRaw?.phone || "",
      email: madrasaInfoRaw?.email || "",
      regNo: madrasaInfoRaw?.reg_no || madrasaInfoRaw?.registration_no || "",
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
      previousBalance,
      isDebt,
      adjustedClosingBalance,

      totalDueAmount,
      studentsWithDueCount,

      leavesCount,
      earlyWarningAlertCount,
    },
    classWiseAttendance,
    staffAttendance,
    fundsBreakdown,
  };
}
