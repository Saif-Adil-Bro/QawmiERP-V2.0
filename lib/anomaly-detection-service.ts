import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError, logAuditEvent } from "@/lib/audit-log";
import {
  getStructuredMadrasaSetting,
  saveStructuredMadrasaSetting,
} from "@/lib/structured-config";
import { toDhakaDateString, toDhakaDateStringFrom } from "@/lib/date-utils";
import {
  detectDueCalculationMismatches,
  detectDuplicateVouchers,
  detectExcessiveWaivers,
  detectFeeAgreementMismatches,
  detectMovingAverageZScoreAnomalies,
  detectNegativeFundBalances,
  detectPaymentVoidSpikes,
  detectUnbilledActiveStudents,
  type AnomalySeverity,
  type AnomalyStatus,
  type DetectedAnomaly,
  type TimeSeriesPoint,
  type WaiverRecord,
} from "@/lib/anomaly-detection";
import { getFeeMetadata, getFeePaymentsForLedger } from "@/lib/fee-store";
import { readBooks } from "@/lib/finance/read-books";
import { ledgerEntries, money } from "@/lib/finance/entries";
import { journalLegs } from "@/lib/finance/journal";

const FALLBACK_NAMESPACE = "anomaly";
const FALLBACK_KEY = "financial_anomalies";

export interface FinancialAnomalyRecord {
  id: string;
  madrasa_id: string;
  anomaly_type: string;
  severity: AnomalySeverity;
  status: AnomalyStatus;
  dedup_key?: string | null;
  title: string;
  description?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  metric_value?: number | null;
  baseline_value?: number | null;
  z_score?: number | null;
  detected_date?: string | null;
  metadata?: Record<string, unknown>;
  detected_at: string;
  resolved_by?: string | null;
  resolved_by_name?: string | null;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AnomalyCheckSummary {
  key: string;
  label: string;
  scannedCount: number;
  detectedCount: number;
  scope: string;
}

export interface AnomalyScanResult {
  ok: boolean;
  scannedAt: string;
  lookbackDays?: number;
  detectedCount: number;
  newlyCreatedCount: number;
  deduplicatedCount: number;
  anomalies: FinancialAnomalyRecord[];
  checkSummaries?: AnomalyCheckSummary[];
}

async function readFallbackAnomalies(
  madrasaId: string
): Promise<FinancialAnomalyRecord[]> {
  const res = await getStructuredMadrasaSetting<FinancialAnomalyRecord[]>(
    madrasaId,
    FALLBACK_NAMESPACE,
    FALLBACK_KEY
  );
  return Array.isArray(res.value) ? res.value : [];
}

async function writeFallbackAnomalies(
  madrasaId: string,
  records: FinancialAnomalyRecord[]
): Promise<void> {
  await saveStructuredMadrasaSetting(
    madrasaId,
    FALLBACK_NAMESPACE,
    FALLBACK_KEY,
    records
  );
}

function buildDailySeries(
  rows: Array<{ dateRaw?: string | null; amount?: number | null; label?: string }>,
  category: string
): TimeSeriesPoint[] {
  const byDate = new Map<string, number>();
  for (const r of rows) {
    const d = toDhakaDateStringFrom(r.dateRaw);
    if (!d) continue;
    const amt = Number(r.amount || 0);
    if (!Number.isFinite(amt) || amt <= 0) continue;
    byDate.set(d, (byDate.get(d) || 0) + amt);
  }
  return Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, amount]) => ({
      date,
      value: amount,
      amount,
      entityId: date,
      category,
    }));
}

/**
 * Runs all Feature 3.2 statistical & rule-based anomaly detectors for a single madrasa,
 * deduplicates open alerts via `dedup_key`, persists to `financial_anomalies`
 * (with `isMissingTableError` fallback), and emits immutable `WARNING`/`CRITICAL`
 * `ANOMALY_DETECTED` events to `system_audit_logs`.
 */
export async function runFinancialAnomalyScan(
  madrasaId: string,
  opts?: {
    lookbackDays?: number;
    actorId?: string | null;
    actorName?: string | null;
  }
): Promise<AnomalyScanResult> {
  const nowIso = new Date().toISOString();
  if (!madrasaId) {
    return {
      ok: false,
      scannedAt: nowIso,
      detectedCount: 0,
      newlyCreatedCount: 0,
      deduplicatedCount: 0,
      anomalies: [],
    };
  }

  const lookbackDays = Math.max(7, Math.min(365, Number(opts?.lookbackDays ?? 60)));
  const cutoffDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const cutoffStr = toDhakaDateString(cutoffDate);

  const admin = await createAdminClient();

  const [bazarRes, expensesRes, waiversRes, approvalsRes, paymentsRes] =
    await Promise.all([
      admin
        .from("bazar_expenses")
        .select("id, amount, expense_date, items_details, created_at")
        .eq("madrasa_id", madrasaId).neq("status","VOID")
        .gte("expense_date", cutoffStr),
      admin
        .from("expenses")
        .select("id, category, amount, expense_date, description, created_at")
        .eq("madrasa_id", madrasaId)
        .gte("expense_date", cutoffStr),
      admin
        .from("fee_discount_waivers")
        .select("id, student_id, discount_type, value, status, approved_by, created_at")
        .eq("madrasa_id", madrasaId),
      admin
        .from("approval_requests")
        .select(
          "id, request_type, status, amount, requested_by, requester_id, final_decision_by, requested_by_name, final_decision_by_name, created_at"
        )
        .eq("madrasa_id", madrasaId)
        .in("request_type", ["FEE_WAIVER", "FEE_DISCOUNT"]),
      admin
        .from("fee_payments")
        .select("id, amount, status, payment_date, created_at")
        .eq("madrasa_id", madrasaId),
    ]);

  const bazarRows = bazarRes.data || [];
  const expenseRows = expensesRes.data || [];
  const waiverRows = waiversRes.data || [];
  const approvalRows = approvalsRes.data || [];
  const paymentRows = paymentsRes.data || [];

  const detected: DetectedAnomaly[] = [];
  const checkSummaries: AnomalyCheckSummary[] = [];
  const todayStr = toDhakaDateString();

  // 1. Boarding bazar spike (Moving Average + Z-Score)
  const bazarSeries = buildDailySeries(
    bazarRows.map((b: any) => ({
      dateRaw: b.expense_date || b.created_at,
      amount: b.amount,
    })),
    "Bazar"
  );
  const bazarAnoms = detectMovingAverageZScoreAnomalies(bazarSeries, {
    anomalyType: "BAZAR_SPIKE",
    entityType: "bazar_expenses",
    titlePrefix: "বোর্ডিং বাজার খরচে অস্বাভাবিক বৃদ্ধি",
  });
  detected.push(...bazarAnoms);
  checkSummaries.push({
    key: "BAZAR_SPIKE",
    label: "বোর্ডিং বাজার স্পাইক",
    scannedCount: bazarRows.length,
    detectedCount: bazarAnoms.length,
    scope: `গত ${lookbackDays} দিন`,
  });

  // 2. General expense spike (Moving Average + Z-Score)
  const expenseSeries = buildDailySeries(
    expenseRows.map((e: any) => ({
      dateRaw: e.expense_date || e.created_at,
      amount: e.amount,
    })),
    "Expenses"
  );
  const expenseAnoms = detectMovingAverageZScoreAnomalies(expenseSeries, {
    anomalyType: "EXPENSE_SPIKE",
    entityType: "expenses",
    titlePrefix: "সাধারণ খরচে অস্বাভাবিক বৃদ্ধি",
  });
  detected.push(...expenseAnoms);
  checkSummaries.push({
    key: "EXPENSE_SPIKE",
    label: "সাধারণ খরচ স্পাইক",
    scannedCount: expenseRows.length,
    detectedCount: expenseAnoms.length,
    scope: `গত ${lookbackDays} দিন`,
  });

  // 3. Same-day duplicate vouchers
  const voucherCandidates = [
    ...expenseRows.map((e: any) => ({
      id: String(e.id),
      expense_date: e.expense_date || toDhakaDateStringFrom(e.created_at),
      category: e.category || "সাধারণ",
      amount: Number(e.amount || 0),
      description: e.description || "",
    })),
    ...bazarRows.map((b: any) => ({
      id: String(b.id),
      expense_date: b.expense_date || toDhakaDateStringFrom(b.created_at),
      category: "Bazar",
      amount: Number(b.amount || 0),
      description: b.items_details || "",
    })),
  ];
  const dupAnoms = detectDuplicateVouchers(voucherCandidates);
  detected.push(...dupAnoms);
  checkSummaries.push({
    key: "DUPLICATE_VOUCHER",
    label: "ডুপ্লিকেট ভাউচার",
    scannedCount: voucherCandidates.length,
    detectedCount: dupAnoms.length,
    scope: `গত ${lookbackDays} দিন`,
  });

  // 4. Excessive fee waivers by user
  const combinedWaivers: WaiverRecord[] = [
    ...waiverRows.map((w: any) => ({
      id: String(w.id),
      approved_by: w.approved_by,
      value: Number(w.value || 0),
      amount: Number(w.value || 0),
      status: w.status,
      created_at: w.created_at,
    })),
    ...approvalRows
      .filter((a: any) => String(a.status || "").toUpperCase() === "APPROVED")
      .map((a: any) => ({
        id: String(a.id),
        approved_by: a.final_decision_by || a.requester_id || a.requested_by,
        actor_name: a.final_decision_by_name || a.requested_by_name || null,
        value: Number(a.amount || 0),
        amount: Number(a.amount || 0),
        status: a.status,
        created_at: a.created_at,
      })),
  ];
  const waiverAnoms = detectExcessiveWaivers(combinedWaivers);
  detected.push(...waiverAnoms);
  checkSummaries.push({
    key: "EXCESSIVE_WAIVER",
    label: "অতিরিক্ত ফি মওকুফ",
    scannedCount: combinedWaivers.length,
    detectedCount: waiverAnoms.length,
    scope: "মোট অনুমোদিত মওকুফ",
  });

  // 5. Payment void/reversal spikes
  const voidAnoms = detectPaymentVoidSpikes(
    paymentRows.map((p: any) => ({
      id: String(p.id),
      status: p.status,
      amount: Number(p.amount || 0),
      payment_date: p.payment_date || toDhakaDateStringFrom(p.created_at),
      created_at: p.created_at,
    }))
  );
  detected.push(...voidAnoms);
  checkSummaries.push({
    key: "PAYMENT_VOID_SPIKE",
    label: "পেমেন্ট বাতিল স্পাইক",
    scannedCount: paymentRows.length,
    detectedCount: voidAnoms.length,
    scope: "মোট পেমেন্ট রসিদ",
  });

  // 6, 7, 8, 9. Fund Balance & Student Fee Integrity Checks (P4 / B27)
  let scannedFunds = 0;
  let negFundAnoms: DetectedAnomaly[] = [];
  let scannedAgreementRecords = 0;
  let agreementAnoms: DetectedAnomaly[] = [];
  let scannedActiveStudents = 0;
  let unbilledAnoms: DetectedAnomaly[] = [];
  let scannedInvoices = 0;
  let dueCalcAnoms: DetectedAnomaly[] = [];

  try {
    const [feeMeta, studentsRes] = await Promise.all([
      getFeeMetadata(madrasaId),
      admin
        .from("students")
        .select("id, first_name, last_name, roll_number, class_id, classes(id, name)")
        .eq("madrasa_id", madrasaId),
    ]);

    // 6. Negative Fund Balances — use feeMeta with readBooks so fee collection receipts (e.g. General + Lillah hostel fees) are included identically to loadFundOverview
    try {
      const books = await readBooks(madrasaId, async () => feeMeta);
      const groups = new Map(
        books.funds.map((f) => [f.id, { income: 0, expense: 0 }])
      );
      for (const e of ledgerEntries(books)) {
        if (e.status === "VOID" || e.reason) continue;
        const g = groups.get(e.fund_id);
        if (!g) continue;
        if (e.income) g.income = money(g.income + e.amount);
        else g.expense = money(g.expense + e.amount);
      }
      const movement = new Map<string, number>();
      for (const leg of journalLegs(books.journals, books.funds)) {
        movement.set(leg.fund_id, money((movement.get(leg.fund_id) || 0) + leg.delta));
      }
      const fundSnapshots = books.funds.map((f) => {
        const g = groups.get(f.id) || { income: 0, expense: 0 };
        return {
          id: f.id,
          name: f.name,
          totalCollected: g.income,
          totalExpense: g.expense,
          currentBalance: money(g.income - g.expense + (movement.get(f.id) || 0)),
        };
      });
      scannedFunds = fundSnapshots.length;
      negFundAnoms = detectNegativeFundBalances(fundSnapshots, todayStr);
      detected.push(...negFundAnoms);
    } catch {
      // non-fatal in isolated mock environments
    }

    const studentFees = feeMeta.student_fees || [];
    scannedInvoices = studentFees.length;
    const studentProfiles = feeMeta.student_profiles || {};

    const allStudents = Array.isArray(studentsRes.data) ? studentsRes.data : [];
    const activeStudents = allStudents.filter((s: any) => {
      const prof: any = studentProfiles[s.id];
      const stStatus = String(
        prof?.student_status || s.student_status || s.status || "ACTIVE"
      ).toUpperCase();
      return !["INACTIVE", "TC_ISSUED", "GRADUATED", "DROPPED", "ARCHIVED"].includes(
        stStatus
      );
    });
    scannedActiveStudents = activeStudents.length;

    // 7. Fee Agreement vs Billed Monthly Amount (including legacy ৳0 profiles like Tahmid & Salman)
    const monthlyByStudentPeriod = new Map<
      string,
      { studentId: string; studentName: string; billingPeriod: string; total: number }
    >();
    const monthlyTypeIds = new Set(
      (feeMeta.fee_types || [])
        .filter((ft) => ft.frequency === "MONTHLY" || ft.code === "MONTHLY")
        .map((ft) => ft.id)
    );
    for (const inv of studentFees) {
      if (monthlyTypeIds.size > 0 && !monthlyTypeIds.has(inv.fee_type_id)) continue;
      const key = `${inv.student_id}::${inv.billing_period}`;
      const existing = monthlyByStudentPeriod.get(key) || {
        studentId: inv.student_id,
        studentName: inv.student_name || "শিক্ষার্থী",
        billingPeriod: inv.billing_period,
        total: 0,
      };
      existing.total += Number(inv.payable_amount || 0);
      monthlyByStudentPeriod.set(key, existing);
    }

    const agreementInputs: Array<{
      studentId: string;
      studentName: string;
      billingPeriod: string;
      agreedMonthlyTotal: number;
      billedMonthlyTotal: number;
    }> = [];
    for (const entry of monthlyByStudentPeriod.values()) {
      const prof: any = studentProfiles[entry.studentId];
      if (prof) {
        const boardingLabel = String(prof.boarding_type || "");
        const isFree =
          prof.is_free === true ||
          prof.free_student === true ||
          prof.student_status === "SCHOLARSHIP" ||
          boardingLabel.includes("লিল্লাহ");
        const agreedMonthlyTotal = isFree
          ? 0
          : prof.total_monthly_fee !== undefined &&
              prof.total_monthly_fee !== null &&
              prof.total_monthly_fee !== ""
            ? Number(prof.total_monthly_fee)
            : Math.max(
                0,
                Number(prof.monthly_fee || 0) +
                  Number(prof.khoraki_fee || 0) +
                  Number(prof.accommodation_fee || 0) +
                  Number(prof.transport_fee || 0) +
                  Number(prof.other_fee || 0) -
                  Number(prof.fee_discount || 0)
              );

        agreementInputs.push({
          studentId: entry.studentId,
          studentName: entry.studentName,
          billingPeriod: entry.billingPeriod,
          agreedMonthlyTotal,
          billedMonthlyTotal: entry.total,
        });
      }
    }
    scannedAgreementRecords = agreementInputs.length;
    agreementAnoms = detectFeeAgreementMismatches(agreementInputs, todayStr);
    detected.push(...agreementAnoms);

    // 8. Unbilled Active Students in Latest Billing Period
    const periods = Array.from(
      new Set(studentFees.map((f) => f.billing_period).filter(Boolean))
    );
    const latestPeriod = periods[0] || "";
    if (latestPeriod && activeStudents.length > 0) {
      const billedIds = new Set(
        studentFees
          .filter((f) => f.billing_period === latestPeriod)
          .map((f) => f.student_id)
      );
      unbilledAnoms = detectUnbilledActiveStudents(
        {
          latestPeriod,
          activeStudents: activeStudents.map((s: any) => {
            const prof: any = studentProfiles[s.id];
            const clsObj = Array.isArray(s.classes) ? s.classes[0] : s.classes;
            return {
              id: s.id,
              name: `${s.first_name || ""} ${s.last_name || ""}`.trim() || "শিক্ষার্থী",
              className: clsObj?.name || prof?.class_name || s.class_name || "",
            };
          }),
          billedStudentIds: billedIds,
        },
        todayStr
      );
      detected.push(...unbilledAnoms);
    }

    // 9. Due vs Generated Formula Integrity
    dueCalcAnoms = detectDueCalculationMismatches(
      studentFees.map((f) => ({
        id: f.id,
        studentName: f.student_name || "শিক্ষার্থী",
        billingPeriod: f.billing_period || "",
        feeTypeName: f.fee_type_name || "ফি",
        baseAmount: Number(f.base_amount || 0),
        discountAmount: Number(f.discount_amount || 0),
        fineAmount: Number(f.fine_amount || 0),
        payableAmount: Number(f.payable_amount || 0),
        paidAmount: Number(f.paid_amount || 0),
        dueAmount: Number(f.due_amount || 0),
      })),
      todayStr
    );
    detected.push(...dueCalcAnoms);
  } catch {
    // non-fatal in isolated mock environments
  }

  checkSummaries.push({
    key: "NEGATIVE_FUND_BALANCE",
    label: "ঋণাত্মক ফান্ড ব্যালেন্স",
    scannedCount: scannedFunds,
    detectedCount: negFundAnoms.length,
    scope: "সকল সক্রিয় ফান্ড",
  });

  checkSummaries.push(
    {
      key: "FEE_AGREEMENT_MISMATCH",
      label: "চুক্তিবদ্ধ বনাম ধার্য ফি মিল",
      scannedCount: scannedAgreementRecords,
      detectedCount: agreementAnoms.length,
      scope: "মাসিক ফি চুক্তি",
    },
    {
      key: "MISSING_STUDENT_INVOICE",
      label: "ইনভয়েসহীন সক্রিয় শিক্ষার্থী",
      scannedCount: scannedActiveStudents,
      detectedCount: unbilledAnoms.length,
      scope: "সর্বশেষ বিলিং মাস",
    },
    {
      key: "DUE_CALCULATION_MISMATCH",
      label: "বকেয়া বনাম জেনারেট হিসাব",
      scannedCount: scannedInvoices,
      detectedCount: dueCalcAnoms.length,
      scope: "সকল ফি ইনভয়েস",
    }
  );

  // Deduplicate against existing OPEN/INVESTIGATING anomalies
  let useFallback = false;
  const existingOpenKeys = new Set<string>();

  try {
    const { data: existingRows, error: existingErr } = await admin
      .from("financial_anomalies")
      .select("dedup_key, status")
      .eq("madrasa_id", madrasaId)
      .in("status", ["OPEN", "INVESTIGATING"]);

    if (existingErr) {
      if (isMissingTableError(existingErr)) {
        useFallback = true;
      }
    } else if (Array.isArray(existingRows)) {
      for (const r of existingRows) {
        if (r.dedup_key) existingOpenKeys.add(String(r.dedup_key));
      }
    }
  } catch {
    useFallback = true;
  }

  if (useFallback) {
    const fb = await readFallbackAnomalies(madrasaId);
    for (const r of fb) {
      if (
        (r.status === "OPEN" || r.status === "INVESTIGATING") &&
        r.dedup_key
      ) {
        existingOpenKeys.add(r.dedup_key);
      }
    }
  }

  const newDetected = detected.filter((d) => !existingOpenKeys.has(d.dedupKey));
  const persistedNew: FinancialAnomalyRecord[] = [];

  if (newDetected.length > 0) {
    if (!useFallback) {
      const insertPayload = newDetected.map((d) => ({
        madrasa_id: madrasaId,
        anomaly_type: d.anomalyType,
        severity: d.severity,
        status: "OPEN" as AnomalyStatus,
        dedup_key: d.dedupKey,
        title: d.title,
        description: d.description,
        entity_type: d.entityType,
        entity_id: d.entityId,
        metric_value: d.metricValue,
        baseline_value: d.baselineValue,
        z_score: d.zScore,
        detected_date: d.detectedDate || null,
        metadata: d.metadata,
        detected_at: nowIso,
        updated_at: nowIso,
      }));

      const { data: inserted, error: insertErr } = await admin
        .from("financial_anomalies")
        .insert(insertPayload)
        .select("*");

      if (insertErr) {
        if (isMissingTableError(insertErr)) {
          useFallback = true;
        } else {
          console.error("financial_anomalies insert error:", insertErr.message);
        }
      } else if (Array.isArray(inserted)) {
        persistedNew.push(...(inserted as FinancialAnomalyRecord[]));
      }
    }

    if (useFallback) {
      const fb = await readFallbackAnomalies(madrasaId);
      const fbRecords: FinancialAnomalyRecord[] = newDetected.map((d, idx) => ({
        id: `anom-fb-${Date.now()}-${idx}`,
        madrasa_id: madrasaId,
        anomaly_type: d.anomalyType,
        severity: d.severity,
        status: "OPEN",
        dedup_key: d.dedupKey,
        title: d.title,
        description: d.description,
        entity_type: d.entityType,
        entity_id: d.entityId,
        metric_value: d.metricValue,
        baseline_value: d.baselineValue,
        z_score: d.zScore,
        detected_date: d.detectedDate,
        metadata: d.metadata,
        detected_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      }));
      await writeFallbackAnomalies(madrasaId, [...fbRecords, ...fb]);
      persistedNew.push(...fbRecords);
    }

    // Emit immutable WARNING/CRITICAL audit events for newly detected anomalies
    for (const anom of persistedNew) {
      await logAuditEvent({
        madrasaId,
        actorId: opts?.actorId ?? null,
        actorName: opts?.actorName ?? "আর্থিক অসঙ্গতি ডিটেক্টর",
        module: "anomaly",
        action: "ANOMALY_DETECTED",
        entityType: "financial_anomalies",
        entityId: anom.id,
        entityLabel: anom.title,
        summary: anom.title,
        metadata: {
          anomaly_type: anom.anomaly_type,
          dedup_key: anom.dedup_key,
          metric_value: anom.metric_value,
          baseline_value: anom.baseline_value,
          z_score: anom.z_score,
        },
        severity: anom.severity === "CRITICAL" ? "CRITICAL" : "WARNING",
      });
    }
  }

  return {
    ok: true,
    scannedAt: nowIso,
    lookbackDays,
    detectedCount: detected.length,
    newlyCreatedCount: persistedNew.length,
    deduplicatedCount: detected.length - newDetected.length,
    anomalies: persistedNew,
    checkSummaries,
  };
}

/**
 * Lists financial/boarding anomalies scoped strictly to `madrasaId`.
 */
export async function getFinancialAnomalies(
  madrasaId: string,
  filters?: { status?: string; severity?: string; limit?: number }
): Promise<FinancialAnomalyRecord[]> {
  if (!madrasaId) return [];

  try {
    const admin = await createAdminClient();
    let query = admin
      .from("financial_anomalies")
      .select("*")
      .eq("madrasa_id", madrasaId)
      .order("detected_at", { ascending: false });

    if (filters?.status && filters.status !== "ALL") {
      query = query.eq("status", filters.status.toUpperCase());
    }
    if (filters?.severity && filters.severity !== "ALL") {
      query = query.eq("severity", filters.severity.toUpperCase());
    }
    if (filters?.limit && filters.limit > 0) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      return data as FinancialAnomalyRecord[];
    }
    if (error && !isMissingTableError(error)) {
      console.error("getFinancialAnomalies error:", error.message);
      return [];
    }
  } catch {
    // fallback below
  }

  let list = await readFallbackAnomalies(madrasaId);
  list = list.filter((r) => r.madrasa_id === madrasaId);
  if (filters?.status && filters.status !== "ALL") {
    const target = filters.status.toUpperCase();
    list = list.filter((r) => r.status === target);
  }
  if (filters?.severity && filters.severity !== "ALL") {
    const target = filters.severity.toUpperCase();
    list = list.filter((r) => r.severity === target);
  }
  list.sort((a, b) =>
    String(b.detected_at || "").localeCompare(String(a.detected_at || ""))
  );
  if (filters?.limit && filters.limit > 0) {
    list = list.slice(0, filters.limit);
  }
  return list;
}

/**
 * Updates the status (INVESTIGATING / RESOLVED / DISMISSED) of a financial anomaly
 * and records an `ANOMALY_RESOLVED` entry in `system_audit_logs`.
 */
export async function updateFinancialAnomalyStatus(params: {
  madrasaId: string;
  anomalyId: string;
  status: "INVESTIGATING" | "RESOLVED" | "DISMISSED";
  actorId: string;
  actorName?: string;
  resolutionNotes?: string;
}): Promise<{ ok: boolean; record?: FinancialAnomalyRecord; error?: string }> {
  const { madrasaId, anomalyId, status, actorId, actorName, resolutionNotes } =
    params;

  if (!madrasaId || !anomalyId) {
    return { ok: false, error: "মাদ্রাসা ও অ্যানোমালি আইডি প্রয়োজন।" };
  }

  const nowIso = new Date().toISOString();
  const admin = await createAdminClient();
  let updatedRecord: FinancialAnomalyRecord | undefined;

  try {
    const { data, error } = await admin
      .from("financial_anomalies")
      .update({
        status,
        resolved_by: actorId,
        resolved_by_name: actorName || null,
        resolved_at: nowIso,
        resolution_notes: resolutionNotes || null,
        updated_at: nowIso,
      })
      .eq("madrasa_id", madrasaId)
      .eq("id", anomalyId)
      .select("*")
      .maybeSingle();

    if (!error && data) {
      updatedRecord = data as FinancialAnomalyRecord;
    } else if (error && isMissingTableError(error)) {
      const fb = await readFallbackAnomalies(madrasaId);
      const idx = fb.findIndex(
        (r) => r.madrasa_id === madrasaId && r.id === anomalyId
      );
      if (idx >= 0) {
        fb[idx] = {
          ...fb[idx],
          status,
          resolved_by: actorId,
          resolved_by_name: actorName || null,
          resolved_at: nowIso,
          resolution_notes: resolutionNotes || null,
          updated_at: nowIso,
        };
        updatedRecord = fb[idx];
        await writeFallbackAnomalies(madrasaId, fb);
      }
    } else if (error) {
      return { ok: false, error: error.message };
    }
  } catch (err: any) {
    return { ok: false, error: err?.message || "অ্যানোমালি আপডেট ব্যর্থ হয়েছে।" };
  }

  await logAuditEvent({
    madrasaId,
    actorId,
    actorName: actorName || null,
    module: "anomaly",
    action: "ANOMALY_RESOLVED",
    entityType: "financial_anomalies",
    entityId: anomalyId,
    entityLabel: updatedRecord?.title || anomalyId,
    summary: `অ্যানোমালি স্ট্যাটাস আপডেট (${status}): ${
      updatedRecord?.title || anomalyId
    }`,
    metadata: {
      status,
      resolutionNotes: resolutionNotes || null,
    },
    severity: "INFO",
  });

  return { ok: true, record: updatedRecord };
}
