import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError, logAuditEvent } from "@/lib/audit-log";
import {
  getStructuredMadrasaSetting,
  saveStructuredMadrasaSetting,
} from "@/lib/structured-config";
import { toDhakaDateString, toDhakaDateStringFrom } from "@/lib/date-utils";
import {
  detectDuplicateVouchers,
  detectExcessiveWaivers,
  detectMovingAverageZScoreAnomalies,
  detectPaymentVoidSpikes,
  type AnomalySeverity,
  type AnomalyStatus,
  type DetectedAnomaly,
  type TimeSeriesPoint,
  type WaiverRecord,
} from "@/lib/anomaly-detection";

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

export interface AnomalyScanResult {
  ok: boolean;
  scannedAt: string;
  detectedCount: number;
  newlyCreatedCount: number;
  deduplicatedCount: number;
  anomalies: FinancialAnomalyRecord[];
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
        .eq("madrasa_id", madrasaId)
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

  // 1. Boarding bazar spike (Moving Average + Z-Score)
  const bazarSeries = buildDailySeries(
    bazarRows.map((b: any) => ({
      dateRaw: b.expense_date || b.created_at,
      amount: b.amount,
    })),
    "Bazar"
  );
  detected.push(
    ...detectMovingAverageZScoreAnomalies(bazarSeries, {
      anomalyType: "BAZAR_SPIKE",
      entityType: "bazar_expenses",
      titlePrefix: "বোর্ডিং বাজার খরচে অস্বাভাবিক বৃদ্ধি",
    })
  );

  // 2. General expense spike (Moving Average + Z-Score)
  const expenseSeries = buildDailySeries(
    expenseRows.map((e: any) => ({
      dateRaw: e.expense_date || e.created_at,
      amount: e.amount,
    })),
    "Expenses"
  );
  detected.push(
    ...detectMovingAverageZScoreAnomalies(expenseSeries, {
      anomalyType: "EXPENSE_SPIKE",
      entityType: "expenses",
      titlePrefix: "সাধারণ খরচে অস্বাভাবিক বৃদ্ধি",
    })
  );

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
  detected.push(...detectDuplicateVouchers(voucherCandidates));

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
  detected.push(...detectExcessiveWaivers(combinedWaivers));

  // 5. Payment void/reversal spikes
  detected.push(
    ...detectPaymentVoidSpikes(
      paymentRows.map((p: any) => ({
        id: String(p.id),
        status: p.status,
        amount: Number(p.amount || 0),
        payment_date: p.payment_date || toDhakaDateStringFrom(p.created_at),
        created_at: p.created_at,
      }))
    )
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
    detectedCount: detected.length,
    newlyCreatedCount: persistedNew.length,
    deduplicatedCount: detected.length - newDetected.length,
    anomalies: persistedNew,
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
