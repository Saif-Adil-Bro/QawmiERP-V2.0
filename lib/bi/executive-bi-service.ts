import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError } from "@/lib/audit-log";
import { toDhakaDateStringFrom, toDhakaMonthString } from "@/lib/date-utils";
import { maskStudentSensitiveFields } from "@/lib/data-access-guards";

export interface BiBoardingMonthlyRow {
  month_key: string;
  total_bazar_expense: number;
  active_meal_days: number;
  active_boarders: number;
  boarding_fee_income: number;
  per_capita_bazar_cost: number;
}

export interface BiFundHealthRow {
  fund_id: string;
  fund_name: string;
  fund_code: string | null;
  category: string | null;
  target_amount: number;
  current_balance: number;
  is_active: boolean;
  target_attainment_pct: number;
}

export interface BiDonationBreakdownRow {
  donation_type: string;
  total_amount: number;
  count: number;
}

export interface BiClassFeeDueRow {
  session_id: string | null;
  class_key: string;
  class_name: string;
  student_count: number;
  total_payable: number;
  total_paid: number;
  total_due: number;
  due_ratio_pct: number;
}

export interface BiSessionExamResultRow {
  exam_id: string;
  exam_title: string;
  exam_year: number | null;
  exam_status: string | null;
  session_id: string | null;
  session_name: string | null;
  result_entries: number;
  examined_students: number;
  avg_percentage: number;
  pass_rate_pct: number;
}

export interface ExecutiveBiSummary {
  totalFeeCollections: number;
  totalFeePayable: number;
  totalFeePaid: number;
  totalFeeDue: number;
  overallDueRatioPct: number;
  totalBazarExpense: number;
  totalBoardingFeeIncome: number;
  avgPerCapitaBazarCost: number;
  totalFundBalance: number;
  totalFundTarget: number;
  totalDonations: number;
}

export interface ExecutiveBiSnapshot {
  madrasaId: string;
  months: number;
  sessionId: string | null;
  source: "rpc" | "mv" | "fallback";
  generatedAt: string;
  totalFeeCollections: number;
  summary: ExecutiveBiSummary;
  boarding: BiBoardingMonthlyRow[];
  boarding_monthly: BiBoardingMonthlyRow[];
  funds: BiFundHealthRow[];
  fundHealth: BiFundHealthRow[];
  fund_health: BiFundHealthRow[];
  donationsByType: BiDonationBreakdownRow[];
  classFeeDues: BiClassFeeDueRow[];
  class_fee_dues: BiClassFeeDueRow[];
  sessionExamComparison: BiSessionExamResultRow[];
  session_exam_results: BiSessionExamResultRow[];
}

export const ALLOWED_BI_DATASETS = [
  "fees",
  "fee_payments",
  "boarding",
  "donations",
  "funds",
  "exams",
  "students",
] as const;

export type BiCustomDataset = (typeof ALLOWED_BI_DATASETS)[number];

const ALLOWED_GROUP_BY: Record<BiCustomDataset, readonly string[]> = {
  fees: ["class_name", "fee_type_name", "billing_period", "status", "session_id"],
  fee_payments: ["payment_method", "status", "class_name", "payment_month"],
  boarding: ["month_key", "expense_date"],
  donations: ["donation_type", "donation_month"],
  funds: ["category", "is_active"],
  exams: ["exam_title", "exam_year", "subject_name"],
  students: ["class_name", "status"],
};

const CustomReportSchema = z.object({
  dataset: z.enum(ALLOWED_BI_DATASETS),
  groupBy: z.string().trim().min(1).max(60).optional(),
  dateFrom: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  sessionId: z.string().trim().max(100).optional().nullable(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  allowUnmasked: z.boolean().optional(),
});

export type CustomReportQuery = z.infer<typeof CustomReportSchema>;

export interface CustomReportRow {
  groupKey: string;
  count: number;
  totalAmount: number;
  paidAmount?: number;
  dueAmount?: number;
  avgAmount: number;
  extra?: Record<string, unknown>;
}

export interface CustomReportResult {
  dataset: BiCustomDataset;
  groupBy: string;
  rows: CustomReportRow[];
  summary: {
    totalRows: number;
    totalCount: number;
    totalAmount: number;
    paidAmount: number;
    dueAmount: number;
  };
  totalRows: number;
  generatedAt: string;
}

function safeNum(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function safeRound(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function safeDiv(numerator: number, denominator: number, decimals = 2): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return safeRound(numerator / denominator, decimals);
}

function isMissingBiObjectError(error: any): boolean {
  if (!error) return false;
  const code = String(error?.code || "");
  const msg = String(error?.message || "");
  return (
    code === "42883" ||
    code === "PGRST202" ||
    code === "42P01" ||
    code === "PGRST205" ||
    isMissingTableError(error) ||
    /does not exist|Could not find the function|Could not find the table/i.test(msg)
  );
}

function isBoardingFeeType(feeTypeName: unknown): boolean {
  const s = String(feeTypeName || "").toLowerCase();
  return (
    s.includes("বোর্ডিং") ||
    s.includes("খাবার") ||
    s.includes("boarding") ||
    s.includes("meal") ||
    s.includes("hostel")
  );
}

function buildEmptySnapshot(
  madrasaId: string,
  months: number,
  sessionId: string | null,
  source: "rpc" | "mv" | "fallback"
): ExecutiveBiSnapshot {
  return {
    madrasaId,
    months,
    sessionId,
    source,
    generatedAt: new Date().toISOString(),
    totalFeeCollections: 0,
    summary: {
      totalFeeCollections: 0,
      totalFeePayable: 0,
      totalFeePaid: 0,
      totalFeeDue: 0,
      overallDueRatioPct: 0,
      totalBazarExpense: 0,
      totalBoardingFeeIncome: 0,
      avgPerCapitaBazarCost: 0,
      totalFundBalance: 0,
      totalFundTarget: 0,
      totalDonations: 0,
    },
    boarding: [],
    boarding_monthly: [],
    funds: [],
    fundHealth: [],
    fund_health: [],
    donationsByType: [],
    classFeeDues: [],
    class_fee_dues: [],
    sessionExamComparison: [],
    session_exam_results: [],
  };
}

function assembleSnapshot(params: {
  madrasaId: string;
  months: number;
  sessionId: string | null;
  source: "rpc" | "mv" | "fallback";
  totalFeeCollections: number;
  boarding: BiBoardingMonthlyRow[];
  funds: BiFundHealthRow[];
  donationsByType: BiDonationBreakdownRow[];
  classFeeDues: BiClassFeeDueRow[];
  sessionExamComparison: BiSessionExamResultRow[];
  generatedAt?: string;
}): ExecutiveBiSnapshot {
  const totalFeePayable = safeRound(
    params.classFeeDues.reduce((s, r) => s + safeNum(r.total_payable), 0)
  );
  const totalFeePaid = safeRound(
    params.classFeeDues.reduce((s, r) => s + safeNum(r.total_paid), 0)
  );
  const totalFeeDue = safeRound(
    params.classFeeDues.reduce((s, r) => s + safeNum(r.total_due), 0)
  );
  const overallDueRatioPct = safeDiv(totalFeeDue * 100, totalFeePayable, 2);

  const totalBazarExpense = safeRound(
    params.boarding.reduce((s, r) => s + safeNum(r.total_bazar_expense), 0)
  );
  const totalBoardingFeeIncome = safeRound(
    params.boarding.reduce((s, r) => s + safeNum(r.boarding_fee_income), 0)
  );
  const perCapitaRows = params.boarding.filter((r) => r.per_capita_bazar_cost > 0);
  const avgPerCapitaBazarCost =
    perCapitaRows.length > 0
      ? safeDiv(
          perCapitaRows.reduce((s, r) => s + r.per_capita_bazar_cost, 0),
          perCapitaRows.length,
          2
        )
      : 0;

  const totalFundBalance = safeRound(
    params.funds.reduce((s, r) => s + safeNum(r.current_balance), 0)
  );
  const totalFundTarget = safeRound(
    params.funds.reduce((s, r) => s + safeNum(r.target_amount), 0)
  );
  const totalDonations = safeRound(
    params.donationsByType.reduce((s, r) => s + safeNum(r.total_amount), 0)
  );

  const effectiveCollections =
    params.totalFeeCollections > 0 ? safeRound(params.totalFeeCollections) : totalFeePaid;

  return {
    madrasaId: params.madrasaId,
    months: params.months,
    sessionId: params.sessionId,
    source: params.source,
    generatedAt: params.generatedAt || new Date().toISOString(),
    totalFeeCollections: effectiveCollections,
    summary: {
      totalFeeCollections: effectiveCollections,
      totalFeePayable,
      totalFeePaid,
      totalFeeDue,
      overallDueRatioPct,
      totalBazarExpense,
      totalBoardingFeeIncome,
      avgPerCapitaBazarCost,
      totalFundBalance,
      totalFundTarget,
      totalDonations,
    },
    boarding: params.boarding,
    boarding_monthly: params.boarding,
    funds: params.funds,
    fundHealth: params.funds,
    fund_health: params.funds,
    donationsByType: params.donationsByType,
    classFeeDues: params.classFeeDues,
    class_fee_dues: params.classFeeDues,
    sessionExamComparison: params.sessionExamComparison,
    session_exam_results: params.sessionExamComparison,
  };
}

function normalizeBoardingRows(rows: any[]): BiBoardingMonthlyRow[] {
  return (rows || []).map((r) => {
    const bazar = safeRound(safeNum(r.total_bazar_expense));
    const boarders = Math.max(0, Math.trunc(safeNum(r.active_boarders)));
    const mealDays = Math.max(0, Math.trunc(safeNum(r.active_meal_days)));
    const income = safeRound(safeNum(r.boarding_fee_income));
    const perCapita =
      safeNum(r.per_capita_bazar_cost) > 0
        ? safeRound(safeNum(r.per_capita_bazar_cost))
        : safeDiv(bazar, boarders, 2);

    return {
      month_key: String(r.month_key || ""),
      total_bazar_expense: bazar,
      active_meal_days: mealDays,
      active_boarders: boarders,
      boarding_fee_income: income,
      per_capita_bazar_cost: perCapita,
    };
  });
}

function normalizeFundRows(rows: any[]): BiFundHealthRow[] {
  return (rows || []).map((r) => {
    const target = safeRound(safeNum(r.target_amount));
    const balance = safeRound(safeNum(r.current_balance));
    const pct =
      safeNum(r.target_attainment_pct) > 0
        ? safeRound(safeNum(r.target_attainment_pct))
        : safeDiv(balance * 100, target, 2);
    return {
      fund_id: String(r.fund_id || r.id || ""),
      fund_name: String(r.fund_name || r.name || "ফান্ড"),
      fund_code: r.fund_code ?? r.code ?? null,
      category: r.category ?? null,
      target_amount: target,
      current_balance: balance,
      is_active: r.is_active !== false,
      target_attainment_pct: pct,
    };
  });
}

function normalizeClassDueRows(rows: any[]): BiClassFeeDueRow[] {
  return (rows || []).map((r) => {
    const payable = safeRound(safeNum(r.total_payable));
    const paid = safeRound(safeNum(r.total_paid));
    const due = safeRound(safeNum(r.total_due));
    const ratio =
      safeNum(r.due_ratio_pct) > 0
        ? safeRound(safeNum(r.due_ratio_pct))
        : safeDiv(due * 100, payable, 2);
    return {
      session_id: r.session_id ? String(r.session_id) : null,
      class_key: String(r.class_key || r.class_id || r.class_name || "UNASSIGNED"),
      class_name: String(r.class_name || "সাধারণ জামাত"),
      student_count: Math.max(0, Math.trunc(safeNum(r.student_count))),
      total_payable: payable,
      total_paid: paid,
      total_due: due,
      due_ratio_pct: ratio,
    };
  });
}

function normalizeExamRows(rows: any[]): BiSessionExamResultRow[] {
  return (rows || []).map((r) => ({
    exam_id: String(r.exam_id || r.id || ""),
    exam_title: String(r.exam_title || r.title || "পরীক্ষা"),
    exam_year: r.exam_year !== null && r.exam_year !== undefined ? safeNum(r.exam_year) : null,
    exam_status: r.exam_status ?? r.status ?? null,
    session_id: r.session_id ? String(r.session_id) : null,
    session_name: r.session_name ? String(r.session_name) : null,
    result_entries: Math.max(0, Math.trunc(safeNum(r.result_entries))),
    examined_students: Math.max(0, Math.trunc(safeNum(r.examined_students))),
    avg_percentage: safeRound(safeNum(r.avg_percentage)),
    pass_rate_pct: safeRound(safeNum(r.pass_rate_pct)),
  }));
}

async function fetchDonationsBreakdown(admin: any, madrasaId: string): Promise<BiDonationBreakdownRow[]> {
  try {
    const { data, error } = await admin
      .from("donations")
      .select("id, amount, donation_type")
      .eq("madrasa_id", madrasaId);
    if (error || !Array.isArray(data)) return [];
    const map = new Map<string, { total_amount: number; count: number }>();
    for (const row of data) {
      const key = String(row.donation_type || "General");
      const prev = map.get(key) || { total_amount: 0, count: 0 };
      prev.total_amount = safeRound(prev.total_amount + safeNum(row.amount));
      prev.count += 1;
      map.set(key, prev);
    }
    return Array.from(map.entries()).map(([donation_type, val]) => ({
      donation_type,
      total_amount: val.total_amount,
      count: val.count,
    }));
  } catch {
    return [];
  }
}

async function computeJsFallbackSnapshot(
  admin: any,
  madrasaId: string,
  months: number,
  sessionId: string | null
): Promise<ExecutiveBiSnapshot> {
  const [
    bazarRes,
    mealsRes,
    feesRes,
    paymentsRes,
    fundsRes,
    donationsByType,
    examsRes,
    resultsRes,
    sessionsRes,
  ] = await Promise.all([
    admin
      .from("bazar_expenses")
      .select("id, amount, expense_date, created_at")
      .eq("madrasa_id", madrasaId),
    admin
      .from("meal_entries")
      .select("id, student_id, entry_date, meal_status, created_at")
      .eq("madrasa_id", madrasaId),
    (() => {
      let q = admin
        .from("student_fees")
        .select(
          "id, session_id, student_id, class_id, class_name, fee_type_name, billing_period, payable_amount, paid_amount, due_amount, created_at"
        )
        .eq("madrasa_id", madrasaId);
      if (sessionId) q = q.eq("session_id", sessionId);
      return q;
    })(),
    (() => {
      let q = admin
        .from("fee_payments")
        .select("id, session_id, total_amount_received, status")
        .eq("madrasa_id", madrasaId);
      if (sessionId) q = q.eq("session_id", sessionId);
      return q;
    })(),
    admin
      .from("zakat_funds")
      .select("id, name, code, category, target_amount, current_balance, is_active")
      .eq("madrasa_id", madrasaId),
    fetchDonationsBreakdown(admin, madrasaId),
    (() => {
      let q = admin
        .from("exams")
        .select("id, title, year, status, session_id")
        .eq("madrasa_id", madrasaId);
      if (sessionId) q = q.eq("session_id", sessionId);
      return q;
    })(),
    admin
      .from("exam_results")
      .select("id, exam_id, student_id, marks_obtained, total_marks")
      .eq("madrasa_id", madrasaId),
    admin
      .from("academic_sessions")
      .select("id, name, code, hijri_year")
      .eq("madrasa_id", madrasaId),
  ]);

  // 1. Boarding monthly aggregation (Asia/Dhaka month keys)
  const bazarRows = Array.isArray(bazarRes.data) ? bazarRes.data : [];
  const mealRows = Array.isArray(mealsRes.data) ? mealsRes.data : [];
  const feeRows = Array.isArray(feesRes.data) ? feesRes.data : [];

  const boardingMap = new Map<
    string,
    {
      bazar: number;
      mealDays: number;
      boarderIds: Set<string>;
      boardingFeeIncome: number;
    }
  >();

  const ensureMonth = (monthKey: string) => {
    let entry = boardingMap.get(monthKey);
    if (!entry) {
      entry = {
        bazar: 0,
        mealDays: 0,
        boarderIds: new Set<string>(),
        boardingFeeIncome: 0,
      };
      boardingMap.set(monthKey, entry);
    }
    return entry;
  };

  for (const row of bazarRows) {
    const dayStr = toDhakaDateStringFrom(row.expense_date || row.created_at);
    const monthKey = dayStr ? dayStr.slice(0, 7) : toDhakaMonthString();
    if (!monthKey) continue;
    const entry = ensureMonth(monthKey);
    entry.bazar = safeRound(entry.bazar + safeNum(row.amount));
  }

  for (const row of mealRows) {
    if (String(row.meal_status || "") !== "On") continue;
    const dayStr = toDhakaDateStringFrom(row.entry_date || row.created_at);
    const monthKey = dayStr ? dayStr.slice(0, 7) : toDhakaMonthString();
    if (!monthKey) continue;
    const entry = ensureMonth(monthKey);
    entry.mealDays += 1;
    if (row.student_id) entry.boarderIds.add(String(row.student_id));
  }

  for (const row of feeRows) {
    if (!isBoardingFeeType(row.fee_type_name)) continue;
    const period =
      typeof row.billing_period === "string" && /^\d{4}-\d{2}/.test(row.billing_period)
        ? row.billing_period.slice(0, 7)
        : toDhakaDateStringFrom(row.created_at).slice(0, 7) || toDhakaMonthString();
    if (!period) continue;
    const entry = ensureMonth(period);
    entry.boardingFeeIncome = safeRound(entry.boardingFeeIncome + safeNum(row.paid_amount));
  }

  const boarding: BiBoardingMonthlyRow[] = Array.from(boardingMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, months)
    .map(([month_key, v]) => {
      const active_boarders = v.boarderIds.size;
      return {
        month_key,
        total_bazar_expense: v.bazar,
        active_meal_days: v.mealDays,
        active_boarders,
        boarding_fee_income: v.boardingFeeIncome,
        per_capita_bazar_cost: safeDiv(v.bazar, active_boarders, 2),
      };
    });

  // 2. Fund health
  const rawFunds = Array.isArray(fundsRes.data) ? fundsRes.data : [];
  const funds: BiFundHealthRow[] = rawFunds
    .map((zf: any) => {
      const target = safeRound(safeNum(zf.target_amount));
      const balance = safeRound(safeNum(zf.current_balance));
      return {
        fund_id: String(zf.id),
        fund_name: String(zf.name || "ফান্ড"),
        fund_code: zf.code ?? null,
        category: zf.category ?? null,
        target_amount: target,
        current_balance: balance,
        is_active: zf.is_active !== false,
        target_attainment_pct: safeDiv(balance * 100, target, 2),
      };
    })
    .sort((a: BiFundHealthRow, b: BiFundHealthRow) => b.current_balance - a.current_balance);

  // 3. Class-wise fee dues
  const classDueMap = new Map<
    string,
    {
      session_id: string | null;
      class_key: string;
      class_name: string;
      studentIds: Set<string>;
      payable: number;
      paid: number;
      due: number;
    }
  >();

  for (const sf of feeRows) {
    const cKey =
      (sf.class_id && String(sf.class_id).trim()) ||
      (sf.class_name && String(sf.class_name).trim()) ||
      "UNASSIGNED";
    const mapKey = `${sf.session_id || "all"}::${cKey}`;
    let entry = classDueMap.get(mapKey);
    if (!entry) {
      entry = {
        session_id: sf.session_id ? String(sf.session_id) : null,
        class_key: cKey,
        class_name: String(sf.class_name || "সাধারণ জামাত"),
        studentIds: new Set<string>(),
        payable: 0,
        paid: 0,
        due: 0,
      };
      classDueMap.set(mapKey, entry);
    }
    if (sf.student_id) entry.studentIds.add(String(sf.student_id));
    entry.payable = safeRound(entry.payable + safeNum(sf.payable_amount));
    entry.paid = safeRound(entry.paid + safeNum(sf.paid_amount));
    entry.due = safeRound(entry.due + safeNum(sf.due_amount));
  }

  const classFeeDues: BiClassFeeDueRow[] = Array.from(classDueMap.values())
    .map((v) => ({
      session_id: v.session_id,
      class_key: v.class_key,
      class_name: v.class_name,
      student_count: v.studentIds.size,
      total_payable: v.payable,
      total_paid: v.paid,
      total_due: v.due,
      due_ratio_pct: safeDiv(v.due * 100, v.payable, 2),
    }))
    .sort((a, b) => b.total_due - a.total_due);

  // 4. Session / Exam results comparison
  const sessionMap = new Map<string, string>();
  for (const s of Array.isArray(sessionsRes.data) ? sessionsRes.data : []) {
    if (s.id) sessionMap.set(String(s.id), String(s.name || s.code || s.hijri_year || s.id));
  }

  const examRows = Array.isArray(examsRes.data) ? examsRes.data : [];
  const resultRows = Array.isArray(resultsRes.data) ? resultsRes.data : [];

  const resultsByExam = new Map<string, any[]>();
  for (const r of resultRows) {
    const eid = String(r.exam_id || "");
    if (!eid) continue;
    const arr = resultsByExam.get(eid) || [];
    arr.push(r);
    resultsByExam.set(eid, arr);
  }

  const sessionExamComparison: BiSessionExamResultRow[] = examRows
    .map((ex: any) => {
      const entries = resultsByExam.get(String(ex.id)) || [];
      const studentSet = new Set<string>();
      let pctSum = 0;
      let passCount = 0;
      for (const er of entries) {
        if (er.student_id) studentSet.add(String(er.student_id));
        const totalM = safeNum(er.total_marks);
        const obtainedM = safeNum(er.marks_obtained);
        const pct = totalM > 0 ? (obtainedM / totalM) * 100 : 0;
        pctSum += pct;
        if (totalM > 0 && obtainedM / totalM >= 0.33) {
          passCount += 1;
        }
      }
      const n = entries.length;
      return {
        exam_id: String(ex.id),
        exam_title: String(ex.title || "পরীক্ষা"),
        exam_year: ex.year !== null && ex.year !== undefined ? safeNum(ex.year) : null,
        exam_status: ex.status ?? null,
        session_id: ex.session_id ? String(ex.session_id) : null,
        session_name: ex.session_id ? sessionMap.get(String(ex.session_id)) || null : null,
        result_entries: n,
        examined_students: studentSet.size,
        avg_percentage: safeDiv(pctSum, n, 2),
        pass_rate_pct: safeDiv(passCount * 100, n, 2),
      };
    })
    .sort((a: BiSessionExamResultRow, b: BiSessionExamResultRow) => (b.exam_year || 0) - (a.exam_year || 0));

  const paymentRows = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];
  const totalFeeCollections = safeRound(
    paymentRows
      .filter((p: any) => String(p.status || "COMPLETED") === "COMPLETED")
      .reduce((s: number, p: any) => s + safeNum(p.total_amount_received), 0)
  );

  return assembleSnapshot({
    madrasaId,
    months,
    sessionId,
    source: "fallback",
    totalFeeCollections,
    boarding,
    funds,
    donationsByType,
    classFeeDues,
    sessionExamComparison,
  });
}

/**
 * Fetches cross-module Executive BI snapshot for a single madrasa.
 * Primary path: PostgreSQL RPC `get_executive_bi_snapshot` -> Materialized Views (`mv_bi_*`) -> JS base-table fallback.
 */
export async function getExecutiveBiSnapshot(
  madrasaId: string,
  opts?: { months?: number; sessionId?: string | null }
): Promise<ExecutiveBiSnapshot> {
  const months = Math.max(1, Math.min(36, Math.trunc(safeNum(opts?.months ?? 6)) || 6));
  const sessionId = opts?.sessionId ? String(opts.sessionId).trim() || null : null;

  if (!madrasaId) {
    return buildEmptySnapshot("", months, sessionId, "fallback");
  }

  const admin = await createAdminClient();

  // 1. Primary path: RPC `get_executive_bi_snapshot`
  try {
    const { data, error } = await admin.rpc("get_executive_bi_snapshot", {
      p_madrasa_id: madrasaId,
      p_months: months,
      p_session_id: sessionId,
    });

    if (
      !error &&
      data &&
      typeof data === "object" &&
      ("boarding_monthly" in data || "fund_health" in data || "class_fee_dues" in data)
    ) {
      const rpcObj = data as Record<string, any>;
      const boarding = normalizeBoardingRows(rpcObj.boarding_monthly || []);
      const funds = normalizeFundRows(rpcObj.fund_health || []);
      const classFeeDues = normalizeClassDueRows(rpcObj.class_fee_dues || []);
      const sessionExamComparison = normalizeExamRows(rpcObj.session_exam_results || []);
      const hasRpcData =
        boarding.length > 0 ||
        funds.length > 0 ||
        classFeeDues.length > 0 ||
        sessionExamComparison.length > 0 ||
        safeNum(rpcObj.total_fee_collections) > 0;

      if (hasRpcData) {
        const donationsByType = await fetchDonationsBreakdown(admin, madrasaId);
        return assembleSnapshot({
          madrasaId,
          months,
          sessionId,
          source: "rpc",
          totalFeeCollections: safeNum(rpcObj.total_fee_collections),
          boarding,
          funds,
          donationsByType,
          classFeeDues,
          sessionExamComparison,
          generatedAt: rpcObj.generated_at ? String(rpcObj.generated_at) : undefined,
        });
      }
    } else if (error && !isMissingBiObjectError(error)) {
      console.warn("get_executive_bi_snapshot RPC warning:", error.message);
    }
  } catch {
    // proceed to MV / fallback
  }

  // 2. Secondary path: Materialized Views `mv_bi_*`
  try {
    const [bRes, fRes, cRes, eRes, pRes] = await Promise.all([
      admin
        .from("mv_bi_boarding_monthly")
        .select(
          "month_key, total_bazar_expense, active_meal_days, active_boarders, boarding_fee_income, per_capita_bazar_cost"
        )
        .eq("madrasa_id", madrasaId)
        .order("month_key", { ascending: false })
        .limit(months),
      admin
        .from("mv_bi_fund_health")
        .select(
          "fund_id, fund_name, fund_code, category, target_amount, current_balance, is_active, target_attainment_pct"
        )
        .eq("madrasa_id", madrasaId),
      (() => {
        let q = admin
          .from("mv_bi_class_fee_dues")
          .select(
            "session_id, class_key, class_name, student_count, total_payable, total_paid, total_due, due_ratio_pct"
          )
          .eq("madrasa_id", madrasaId);
        if (sessionId) q = q.eq("session_id", sessionId);
        return q;
      })(),
      admin
        .from("mv_bi_session_exam_results")
        .select(
          "exam_id, exam_title, exam_year, exam_status, result_entries, examined_students, avg_percentage, pass_rate_pct"
        )
        .eq("madrasa_id", madrasaId),
      (() => {
        let q = admin
          .from("fee_payments")
          .select("total_amount_received, status")
          .eq("madrasa_id", madrasaId);
        if (sessionId) q = q.eq("session_id", sessionId);
        return q;
      })(),
    ]);

    const anyMissing =
      isMissingBiObjectError(bRes.error) ||
      isMissingBiObjectError(fRes.error) ||
      isMissingBiObjectError(cRes.error) ||
      isMissingBiObjectError(eRes.error);

    if (!anyMissing && !bRes.error && !fRes.error && !cRes.error && !eRes.error) {
      const boarding = normalizeBoardingRows(bRes.data || []);
      const funds = normalizeFundRows(fRes.data || []);
      const classFeeDues = normalizeClassDueRows(cRes.data || []);
      const sessionExamComparison = normalizeExamRows(eRes.data || []);
      const totalFeeCollections = safeRound(
        (pRes.data || [])
          .filter((p: any) => String(p.status || "COMPLETED") === "COMPLETED")
          .reduce((s: number, p: any) => s + safeNum(p.total_amount_received), 0)
      );

      const hasMvData =
        boarding.length > 0 ||
        funds.length > 0 ||
        classFeeDues.length > 0 ||
        sessionExamComparison.length > 0 ||
        totalFeeCollections > 0;

      if (hasMvData) {
        const donationsByType = await fetchDonationsBreakdown(admin, madrasaId);
        return assembleSnapshot({
          madrasaId,
          months,
          sessionId,
          source: "mv",
          totalFeeCollections,
          boarding,
          funds,
          donationsByType,
          classFeeDues,
          sessionExamComparison,
        });
      }
    }
  } catch {
    // fall through to JS base-table fallback
  }

  // 3. Guaranteed JS base-table fallback
  return computeJsFallbackSnapshot(admin, madrasaId, months, sessionId);
}

/**
 * Executes a strictly whitelisted Custom BI Report scoped to `madrasaId`.
 * Rejects non-whitelisted datasets or SQL-injection strings.
 */
export async function executeCustomReport(
  madrasaId: string,
  definition: CustomReportQuery | Record<string, unknown>
): Promise<CustomReportResult> {
  if (!madrasaId) {
    throw new Error("মাদ্রাসা আইডি পাওয়া যায়নি।");
  }

  const parsed = CustomReportSchema.safeParse(definition);
  if (!parsed.success) {
    throw new Error("অবৈধ কাস্টম রিপোর্ট কনফিগারেশন বা অননুমোদিত ডেটাসেট।");
  }

  const query = parsed.data;
  const dataset = query.dataset;
  const allowedGroups = ALLOWED_GROUP_BY[dataset];
  const groupBy = query.groupBy || allowedGroups[0];

  if (!allowedGroups.includes(groupBy)) {
    throw new Error(`ডেটাসেট '${dataset}'-এর জন্য '${groupBy}' গ্রুপিং অনুমোদিত নয়।`);
  }

  const limit = query.limit ?? 100;
  const dateFrom = query.dateFrom || null;
  const dateTo = query.dateTo || null;
  const admin = await createAdminClient();

  const inDateRange = (rawDate: unknown): boolean => {
    if (!dateFrom && !dateTo) return true;
    const d = toDhakaDateStringFrom(rawDate as any);
    if (!d) return false;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };

  type Accum = {
    count: number;
    totalAmount: number;
    paidAmount: number;
    dueAmount: number;
    extra?: Record<string, unknown>;
  };

  const groups = new Map<string, Accum>();
  const addToGroup = (
    key: string,
    amount: number,
    paid = 0,
    due = 0,
    extra?: Record<string, unknown>
  ) => {
    const cleanKey = key || "অনির্ধারিত";
    const cur = groups.get(cleanKey) || {
      count: 0,
      totalAmount: 0,
      paidAmount: 0,
      dueAmount: 0,
      extra,
    };
    cur.count += 1;
    cur.totalAmount = safeRound(cur.totalAmount + safeNum(amount));
    cur.paidAmount = safeRound(cur.paidAmount + safeNum(paid));
    cur.dueAmount = safeRound(cur.dueAmount + safeNum(due));
    groups.set(cleanKey, cur);
  };

  if (dataset === "fees") {
    let q = admin
      .from("student_fees")
      .select(
        "id, session_id, class_name, fee_type_name, billing_period, payable_amount, paid_amount, due_amount, status, due_date, created_at"
      )
      .eq("madrasa_id", madrasaId);
    if (query.sessionId) q = q.eq("session_id", query.sessionId);
    const { data, error } = await q;
    if (error && !isMissingTableError(error)) throw new Error(error.message);

    for (const r of data || []) {
      const refDate = r.due_date || (r.billing_period ? `${r.billing_period}-01` : r.created_at);
      if (!inDateRange(refDate)) continue;
      const gKey = String((r as any)[groupBy] || "অনির্ধারিত");
      addToGroup(
        gKey,
        safeNum(r.payable_amount),
        safeNum(r.paid_amount),
        safeNum(r.due_amount)
      );
    }
  } else if (dataset === "fee_payments") {
    let q = admin
      .from("fee_payments")
      .select("id, session_id, class_name, total_amount_received, payment_date, payment_method, status")
      .eq("madrasa_id", madrasaId);
    if (query.sessionId) q = q.eq("session_id", query.sessionId);
    const { data, error } = await q;
    if (error && !isMissingTableError(error)) throw new Error(error.message);

    for (const r of data || []) {
      if (!inDateRange(r.payment_date)) continue;
      const gKey =
        groupBy === "payment_month"
          ? toDhakaDateStringFrom(r.payment_date).slice(0, 7) || "অনির্ধারিত"
          : String((r as any)[groupBy] || "অনির্ধারিত");
      addToGroup(gKey, safeNum(r.total_amount_received), safeNum(r.total_amount_received), 0);
    }
  } else if (dataset === "boarding") {
    const { data, error } = await admin
      .from("bazar_expenses")
      .select("id, amount, expense_date, created_at")
      .eq("madrasa_id", madrasaId);
    if (error && !isMissingTableError(error)) throw new Error(error.message);

    for (const r of data || []) {
      const dStr = toDhakaDateStringFrom(r.expense_date || r.created_at);
      if (!inDateRange(dStr)) continue;
      const gKey = groupBy === "month_key" ? dStr.slice(0, 7) || "অনির্ধারিত" : dStr || "অনির্ধারিত";
      addToGroup(gKey, safeNum(r.amount));
    }
  } else if (dataset === "donations") {
    const { data, error } = await admin
      .from("donations")
      .select("id, amount, donation_type, donation_date")
      .eq("madrasa_id", madrasaId);
    if (error && !isMissingTableError(error)) throw new Error(error.message);

    for (const r of data || []) {
      if (!inDateRange(r.donation_date)) continue;
      const gKey =
        groupBy === "donation_month"
          ? toDhakaDateStringFrom(r.donation_date).slice(0, 7) || "অনির্ধারিত"
          : String((r as any)[groupBy] || "অনির্ধারিত");
      addToGroup(gKey, safeNum(r.amount));
    }
  } else if (dataset === "funds") {
    const { data, error } = await admin
      .from("zakat_funds")
      .select("id, name, category, target_amount, current_balance, is_active")
      .eq("madrasa_id", madrasaId);
    if (error && !isMissingTableError(error)) throw new Error(error.message);

    for (const r of data || []) {
      const gKey =
        groupBy === "is_active"
          ? r.is_active !== false
            ? "সক্রিয়"
            : "নিষ্ক্রিয়"
          : String((r as any)[groupBy] || "সাধারণ");
      addToGroup(gKey, safeNum(r.current_balance), safeNum(r.current_balance), 0, {
        targetAmount: safeNum(r.target_amount),
      });
    }
  } else if (dataset === "exams") {
    const [examsRes, resultsRes] = await Promise.all([
      admin
        .from("exams")
        .select("id, title, year, start_date")
        .eq("madrasa_id", madrasaId),
      admin
        .from("exam_results")
        .select("id, exam_id, subject_name, marks_obtained, total_marks")
        .eq("madrasa_id", madrasaId),
    ]);
    if (examsRes.error && !isMissingTableError(examsRes.error)) {
      throw new Error(examsRes.error.message);
    }
    if (resultsRes.error && !isMissingTableError(resultsRes.error)) {
      throw new Error(resultsRes.error.message);
    }

    const examById = new Map<string, any>();
    for (const e of examsRes.data || []) {
      examById.set(String(e.id), e);
    }

    for (const r of resultsRes.data || []) {
      const ex = examById.get(String(r.exam_id));
      if (ex?.start_date && !inDateRange(ex.start_date)) continue;
      const gKey =
        groupBy === "exam_title"
          ? String(ex?.title || "পরীক্ষা")
          : groupBy === "exam_year"
            ? String(ex?.year || "অনির্ধারিত")
            : String(r.subject_name || "বিষয়");
      const totalM = safeNum(r.total_marks);
      const pct = totalM > 0 ? safeRound((safeNum(r.marks_obtained) / totalM) * 100) : 0;
      addToGroup(gKey, pct);
    }
  } else if (dataset === "students") {
    const { data, error } = await admin
      .from("students")
      .select("id, first_name, last_name, roll_number, class_name, parent_phone, status")
      .eq("madrasa_id", madrasaId);
    if (error && !isMissingTableError(error)) throw new Error(error.message);

    for (const raw of data || []) {
      const masked = maskStudentSensitiveFields(raw, Boolean(query.allowUnmasked));
      const gKey = String((masked as any)[groupBy] || "সক্রিয়");
      addToGroup(gKey, 1, 0, 0, {
        samplePhone: (masked as any).parent_phone || null,
      });
    }
  }

  const rows: CustomReportRow[] = Array.from(groups.entries())
    .map(([groupKey, acc]) => ({
      groupKey,
      count: acc.count,
      totalAmount: acc.totalAmount,
      paidAmount: acc.paidAmount,
      dueAmount: acc.dueAmount,
      avgAmount: safeDiv(acc.totalAmount, acc.count, 2),
      ...(acc.extra ? { extra: acc.extra } : {}),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, limit);

  const summary = {
    totalRows: rows.length,
    totalCount: rows.reduce((s, r) => s + r.count, 0),
    totalAmount: safeRound(rows.reduce((s, r) => s + r.totalAmount, 0)),
    paidAmount: safeRound(rows.reduce((s, r) => s + safeNum(r.paidAmount), 0)),
    dueAmount: safeRound(rows.reduce((s, r) => s + safeNum(r.dueAmount), 0)),
  };

  return {
    dataset,
    groupBy,
    rows,
    summary,
    totalRows: rows.length,
    generatedAt: new Date().toISOString(),
  };
}
