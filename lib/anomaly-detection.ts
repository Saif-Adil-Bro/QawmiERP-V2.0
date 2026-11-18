import { toBanglaNumber, formatBanglaCurrency } from "@/lib/numberToBangla";

export type AnomalySeverity = "WARNING" | "CRITICAL";
export type AnomalyStatus = "OPEN" | "INVESTIGATING" | "RESOLVED" | "DISMISSED";

export interface TimeSeriesPoint {
  date: string;
  value?: number;
  amount?: number;
  label?: string;
  entityId?: string;
  entityType?: string;
  category?: string;
  metadata?: Record<string, unknown>;
}

export interface ZScoreConfig {
  windowSize?: number;
  warningZScore?: number;
  criticalZScore?: number;
  zThreshold?: number;
  minPoints?: number;
  anomalyType?: string;
  entityType?: string;
  titlePrefix?: string;
}

export interface DetectedAnomaly {
  anomalyType: string;
  severity: AnomalySeverity;
  title: string;
  description: string;
  entityType: string;
  entityId: string;
  metricValue: number;
  baselineValue: number;
  baselineMean: number;
  baselineStdDev: number;
  zScore: number | null;
  z_score: number | null;
  detectedDate: string;
  date: string;
  dedupKey: string;
  metadata: Record<string, unknown>;
}

export interface ExpenseVoucherRecord {
  id: string;
  expense_date?: string | null;
  date?: string | null;
  category?: string | null;
  amount: number;
  description?: string | null;
  voucher_no?: string | null;
}

export interface WaiverRecord {
  id: string;
  approved_by?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
  value?: number | null;
  amount?: number | null;
  discount_amount?: number | null;
  status?: string | null;
  created_at?: string | null;
}

export interface ExcessiveWaiverConfig {
  maxCountPerUser?: number;
  maxTotalAmountPerUser?: number;
}

export interface PaymentVoidRecord {
  id: string;
  status?: string | null;
  amount?: number | null;
  payment_date?: string | null;
  voided_at?: string | null;
  created_at?: string | null;
}

export interface PaymentVoidSpikeConfig {
  maxVoidCountPerDay?: number;
  maxVoidRatio?: number;
  minPaymentsForRatio?: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function extractDateOnly(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw).trim().slice(0, 10);
}

/**
 * Pure Moving-Average + Z-Score anomaly detector for daily/periodic expense or bazar series.
 * Handles zero-variance flat baselines (stdDev === 0 -> no NaN, returns []) and short series (< 2 -> []).
 */
export function detectMovingAverageZScoreAnomalies(
  series: TimeSeriesPoint[],
  config?: ZScoreConfig
): DetectedAnomaly[] {
  if (!Array.isArray(series) || series.length < 2) {
    return [];
  }

  const windowSize = Math.max(2, Number(config?.windowSize ?? 14));
  const warningZ = Number(config?.warningZScore ?? config?.zThreshold ?? 2.0);
  const criticalZ = Math.max(
    warningZ,
    Number(config?.criticalZScore ?? Math.max(3.0, warningZ + 1.0))
  );
  const minPoints = Math.max(2, Number(config?.minPoints ?? 3));
  const anomalyType = config?.anomalyType || "BAZAR_SPIKE";
  const entityType = config?.entityType || "bazar_expenses";
  const titlePrefix = config?.titlePrefix || "অস্বাভাবিক ব্যয় বৃদ্ধি";

  const normalized = series
    .map((pt, idx) => ({
      date: extractDateOnly(pt.date),
      value: Number(pt.value ?? pt.amount ?? 0),
      label: pt.label || "",
      entityId: pt.entityId || extractDateOnly(pt.date) || `point-${idx}`,
      category: pt.category || "",
      metadata: pt.metadata || {},
    }))
    .filter((pt) => pt.date !== "" && Number.isFinite(pt.value))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (normalized.length < 2) {
    return [];
  }

  const effectiveMinPoints = Math.min(minPoints, normalized.length - 1);
  if (effectiveMinPoints < 2) {
    return [];
  }

  const anomalies: DetectedAnomaly[] = [];

  for (let i = effectiveMinPoints; i < normalized.length; i++) {
    const start = Math.max(0, i - windowSize);
    const windowSlice = normalized.slice(start, i);
    if (windowSlice.length < 2) continue;

    const values = windowSlice.map((w) => w.value);
    const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
    const variance =
      values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const current = normalized[i];

    // Zero-variance baseline guard (no 0/0 NaN):
    // Keep skipping flat/non-spike values, but flag real >=2x spikes over a constant positive baseline.
    let effectiveStdDev = stdDev;
    if (!Number.isFinite(effectiveStdDev) || effectiveStdDev <= 0) {
      if (mean <= 0 || current.value < mean * 2) {
        continue;
      }
      effectiveStdDev = Math.max(mean * 0.1, 1);
    }

    const zScore = (current.value - mean) / effectiveStdDev;
    if (!Number.isFinite(zScore)) {
      continue;
    }

    if (zScore >= warningZ) {
      const severity: AnomalySeverity =
        zScore >= criticalZ ? "CRITICAL" : "WARNING";
      const zRounded = round3(zScore);
      const meanRounded = round2(mean);
      const stdRounded = round2(stdDev);

      anomalies.push({
        anomalyType,
        severity,
        title: `${titlePrefix}: ${current.date} (${formatBanglaCurrency(current.value)})`,
        description: `${current.date} তারিখে ব্যয় ${formatBanglaCurrency(
          current.value
        )} রেকর্ড হয়েছে, যা পূর্ববর্তী ${toBanglaNumber(
          windowSlice.length
        )} দিনের গড় (${formatBanglaCurrency(
          meanRounded
        )}) থেকে অনেক বেশি (Z-Score: ${toBanglaNumber(zRounded)})।`,
        entityType,
        entityId: current.entityId,
        metricValue: round2(current.value),
        baselineValue: meanRounded,
        baselineMean: meanRounded,
        baselineStdDev: stdRounded,
        zScore: zRounded,
        z_score: zRounded,
        detectedDate: current.date,
        date: current.date,
        dedupKey: `${anomalyType.toLowerCase()}:${current.date}:${Math.round(
          current.value
        )}`,
        metadata: {
          ...current.metadata,
          label: current.label,
          category: current.category,
          windowSize: windowSlice.length,
          baselineMean: meanRounded,
          baselineStdDev: stdRounded,
        },
      });
    }
  }

  return anomalies;
}

/**
 * Detects same-day duplicate expense/bazar vouchers (same date + amount + category).
 * Identical amounts on different dates are NOT flagged.
 */
export function detectDuplicateVouchers(
  records: ExpenseVoucherRecord[]
): DetectedAnomaly[] {
  if (!Array.isArray(records) || records.length < 2) {
    return [];
  }

  const groups = new Map<string, ExpenseVoucherRecord[]>();

  for (const rec of records) {
    const dateStr = extractDateOnly(rec.expense_date || rec.date);
    const amount = Number(rec.amount || 0);
    if (!dateStr || !Number.isFinite(amount) || amount <= 0) continue;

    const category = String(rec.category || "general")
      .trim()
      .toLowerCase();
    const key = `${dateStr}::${Math.round(amount * 100)}::${category}`;

    const list = groups.get(key) || [];
    list.push(rec);
    groups.set(key, list);
  }

  const anomalies: DetectedAnomaly[] = [];

  groups.forEach((group, key) => {
    if (group.length < 2) return;

    const first = group[0];
    const dateStr = extractDateOnly(first.expense_date || first.date);
    const amount = round2(Number(first.amount || 0));
    const category = String(first.category || "সাধারণ");
    const ids = group.map((g) => String(g.id)).sort();
    const severity: AnomalySeverity =
      group.length >= 3 || amount >= 10000 ? "CRITICAL" : "WARNING";

    anomalies.push({
      anomalyType: "DUPLICATE_VOUCHER",
      severity,
      title: `একই দিনে ডুপ্লিকেট ভাউচার: ${category} (${formatBanglaCurrency(amount)})`,
      description: `${dateStr} তারিখে '${category}' খাতে একই পরিমাণ (${formatBanglaCurrency(
        amount
      )}) ${toBanglaNumber(group.length)} বার এন্ট্রি করা হয়েছে।`,
      entityType: "expenses",
      entityId: ids[0],
      metricValue: amount,
      baselineValue: amount,
      baselineMean: amount,
      baselineStdDev: 0,
      zScore: null,
      z_score: null,
      detectedDate: dateStr,
      date: dateStr,
      dedupKey: `duplicate_voucher:${key}`,
      metadata: {
        duplicateIds: ids,
        count: group.length,
        category,
        voucherNo: first.voucher_no || null,
        descriptions: group.map((g) => g.description).filter(Boolean),
      },
    });
  });

  return anomalies;
}

/**
 * Detects users approving excessive fee waivers/discounts by count or total amount.
 */
export function detectExcessiveWaivers(
  waivers: WaiverRecord[],
  config?: ExcessiveWaiverConfig
): DetectedAnomaly[] {
  if (!Array.isArray(waivers) || waivers.length === 0) {
    return [];
  }

  const maxCount = Math.max(1, Number(config?.maxCountPerUser ?? 5));
  const maxTotalAmount = Math.max(
    1,
    Number(config?.maxTotalAmountPerUser ?? 10000)
  );

  const byUser = new Map<
    string,
    { actorName: string; count: number; totalAmount: number; ids: string[]; latestDate: string }
  >();

  for (const w of waivers) {
    const status = String(w.status || "APPROVED").toUpperCase().trim();
    if (status === "REJECTED" || status === "CANCELLED") continue;

    const actorId = String(w.approved_by || w.actor_id || "").trim();
    if (!actorId) continue;

    const amt = Number(w.value ?? w.amount ?? w.discount_amount ?? 0);
    const safeAmt = Number.isFinite(amt) && amt > 0 ? amt : 0;
    const dateStr = extractDateOnly(w.created_at) || "recent";

    const cur = byUser.get(actorId) || {
      actorName: String(w.actor_name || actorId),
      count: 0,
      totalAmount: 0,
      ids: [],
      latestDate: dateStr,
    };

    cur.count += 1;
    cur.totalAmount += safeAmt;
    cur.ids.push(String(w.id));
    if (dateStr > cur.latestDate) cur.latestDate = dateStr;
    if (w.actor_name) cur.actorName = String(w.actor_name);

    byUser.set(actorId, cur);
  }

  const anomalies: DetectedAnomaly[] = [];

  byUser.forEach((stats, actorId) => {
    if (stats.count <= maxCount && stats.totalAmount <= maxTotalAmount) {
      return;
    }

    const severity: AnomalySeverity =
      stats.count >= maxCount * 2 || stats.totalAmount >= maxTotalAmount * 2
        ? "CRITICAL"
        : "WARNING";

    anomalies.push({
      anomalyType: "EXCESSIVE_WAIVER",
      severity,
      title: `অতিরিক্ত ফি মওকুফ অনুমোদন: ${stats.actorName}`,
      description: `${stats.actorName} (${actorId}) মোট ${toBanglaNumber(
        stats.count
      )}টি ফি মওকুফ (${formatBanglaCurrency(
        round2(stats.totalAmount)
      )}) অনুমোদন করেছেন, যা নির্ধারিত সীমা অতিক্রম করেছে।`,
      entityType: "user",
      entityId: actorId,
      metricValue: round2(stats.totalAmount),
      baselineValue: maxTotalAmount,
      baselineMean: maxTotalAmount,
      baselineStdDev: 0,
      zScore: null,
      z_score: null,
      detectedDate: stats.latestDate,
      date: stats.latestDate,
      dedupKey: `excessive_waiver:${actorId}:${stats.count}:${Math.round(
        stats.totalAmount
      )}`,
      metadata: {
        approved_by: actorId,
        actor_id: actorId,
        actor_name: stats.actorName,
        waiverCount: stats.count,
        totalAmount: round2(stats.totalAmount),
        maxCountPerUser: maxCount,
        maxTotalAmountPerUser: maxTotalAmount,
        waiverIds: stats.ids.slice(0, 20),
      },
    });
  });

  return anomalies;
}

/**
 * Detects abnormal spikes in VOID / REVERSED fee payments per day.
 */
export function detectPaymentVoidSpikes(
  payments: PaymentVoidRecord[],
  config?: PaymentVoidSpikeConfig
): DetectedAnomaly[] {
  if (!Array.isArray(payments) || payments.length === 0) {
    return [];
  }

  const maxVoidCount = Math.max(1, Number(config?.maxVoidCountPerDay ?? 3));
  const maxVoidRatio = Number(config?.maxVoidRatio ?? 0.25);
  const minForRatio = Math.max(2, Number(config?.minPaymentsForRatio ?? 4));

  const byDate = new Map<
    string,
    { total: number; voidCount: number; voidAmount: number; voidIds: string[] }
  >();

  for (const p of payments) {
    const dateStr = extractDateOnly(
      p.payment_date || p.voided_at || p.created_at
    );
    if (!dateStr) continue;

    const cur = byDate.get(dateStr) || {
      total: 0,
      voidCount: 0,
      voidAmount: 0,
      voidIds: [],
    };
    cur.total += 1;

    const status = String(p.status || "").toUpperCase().trim();
    if (status === "VOID" || status === "REVERSED" || status === "CANCELLED") {
      cur.voidCount += 1;
      cur.voidAmount += Math.max(0, Number(p.amount || 0));
      cur.voidIds.push(String(p.id));
    }

    byDate.set(dateStr, cur);
  }

  const anomalies: DetectedAnomaly[] = [];

  byDate.forEach((stats, dateStr) => {
    if (stats.voidCount === 0) return;
    const ratio = stats.total > 0 ? stats.voidCount / stats.total : 0;
    const isCountSpike = stats.voidCount >= maxVoidCount;
    const isRatioSpike = stats.total >= minForRatio && ratio >= maxVoidRatio;

    if (!isCountSpike && !isRatioSpike) return;

    const severity: AnomalySeverity =
      stats.voidCount >= maxVoidCount * 2 || ratio >= 0.5
        ? "CRITICAL"
        : "WARNING";

    anomalies.push({
      anomalyType: "PAYMENT_VOID_SPIKE",
      severity,
      title: `পেমেন্ট বাতিল/রিভার্সাল স্পাইক: ${dateStr}`,
      description: `${dateStr} তারিখে মোট ${toBanglaNumber(
        stats.total
      )}টি পেমেন্টের মধ্যে ${toBanglaNumber(
        stats.voidCount
      )}টি বাতিল/রিভার্স করা হয়েছে (মোট ${formatBanglaCurrency(
        round2(stats.voidAmount)
      )})।`,
      entityType: "fee_payments",
      entityId: dateStr,
      metricValue: stats.voidCount,
      baselineValue: maxVoidCount,
      baselineMean: maxVoidCount,
      baselineStdDev: 0,
      zScore: null,
      z_score: null,
      detectedDate: dateStr,
      date: dateStr,
      dedupKey: `payment_void_spike:${dateStr}:${stats.voidCount}`,
      metadata: {
        totalPayments: stats.total,
        voidCount: stats.voidCount,
        voidRatio: round3(ratio),
        voidAmount: round2(stats.voidAmount),
        voidIds: stats.voidIds.slice(0, 20),
      },
    });
  });

  return anomalies;
}
