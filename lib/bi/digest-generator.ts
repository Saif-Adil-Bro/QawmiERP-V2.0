import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError, logAuditEvent } from "@/lib/audit-log";
import { getStructuredMadrasaSetting } from "@/lib/structured-config";
import {
  buildExportWatermark,
  buildPrintWatermarkHtml,
  buildWatermarkedWorkbook,
  escapeHtml,
  type ExportWatermarkMetadata,
} from "@/lib/export-watermark";
import { formatBanglaCurrency, toBanglaNumber } from "@/lib/numberToBangla";
import { dispatchNotification } from "@/lib/notifications/orchestrator";
import {
  getExecutiveBiSnapshot,
  type ExecutiveBiSnapshot,
} from "@/lib/bi/executive-bi-service";

export interface DigestScheduleRecord {
  id: string;
  madrasa_id: string;
  schedule_key?: string;
  name?: string;
  frequency: "weekly" | "monthly" | string;
  day_of_week?: number | null;
  day_of_month?: number | null;
  recipients: string[];
  include_sections?: string[];
  format?: "html" | "xlsx" | string;
  is_enabled: boolean;
  last_sent_at?: string | null;
  created_at?: string;
}

export interface GenerateDigestInput {
  madrasaId: string;
  actorId?: string | null;
  actorName: string;
  actorRole: string;
  ipAddress: string;
  madrasaName?: string;
  scheduleId?: string;
  format?: "html" | "xlsx";
  months?: number;
  sessionId?: string | null;
  title?: string;
}

export interface GeneratedDigestResult {
  format: "html" | "xlsx";
  watermark: ExportWatermarkMetadata;
  snapshot: ExecutiveBiSnapshot;
  html?: string;
  workbook?: Buffer;
  filename: string;
}

const FALLBACK_BI_NAMESPACE = "bi";
const FALLBACK_SCHEDULES_KEY = "digest_schedules";
const FALLBACK_DIGESTS_KEY = "generated_digests";

/**
 * Generates an A4 Bangla HTML Executive BI Digest report with diagonal & footer audit watermark.
 */
export function buildDigestHtml(
  snapshot: ExecutiveBiSnapshot | Record<string, any>,
  watermarkInput: ExportWatermarkMetadata | Record<string, any>,
  options?: { title?: string; includeSections?: string[] }
): string {
  const watermark: ExportWatermarkMetadata =
    "watermarkLine" in watermarkInput && "exportedAtDhaka" in watermarkInput
      ? (watermarkInput as ExportWatermarkMetadata)
      : buildExportWatermark({
          exportedBy: String(watermarkInput.exportedBy || "System"),
          actorRole: String(watermarkInput.actorRole || "muhtamim"),
          ipAddress: String(watermarkInput.ipAddress || "unknown"),
          madrasaName: String(watermarkInput.madrasaName || "কওমী মাদ্রাসা"),
          dataset: String(watermarkInput.dataset || "executive_bi_digest"),
          exportId: watermarkInput.exportId ? String(watermarkInput.exportId) : undefined,
        });

  const s = snapshot as ExecutiveBiSnapshot;
  const summary = s.summary || {
    totalFeeCollections: s.totalFeeCollections || 0,
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
  };

  const boardingRows = Array.isArray(s.boarding) ? s.boarding : s.boarding_monthly || [];
  const fundRows = Array.isArray(s.funds) ? s.funds : s.fund_health || [];
  const classDueRows = Array.isArray(s.classFeeDues) ? s.classFeeDues : s.class_fee_dues || [];
  const examRows = Array.isArray(s.sessionExamComparison)
    ? s.sessionExamComparison
    : s.session_exam_results || [];

  const title = escapeHtml(options?.title || "নির্বাহী বিআই (Executive BI) সারসংক্ষেপ প্রতিবেদন");
  const watermarkOverlay = buildPrintWatermarkHtml(watermark);

  const boardingHtml =
    boardingRows.length > 0
      ? boardingRows
          .map(
            (r) => `
          <tr>
            <td>${escapeHtml(toBanglaNumber(r.month_key))}</td>
            <td class="num">৳ ${formatBanglaCurrency(r.total_bazar_expense)}</td>
            <td class="num">৳ ${formatBanglaCurrency(r.boarding_fee_income)}</td>
            <td class="num">${toBanglaNumber(r.active_boarders)} জন</td>
            <td class="num">৳ ${formatBanglaCurrency(r.per_capita_bazar_cost)}</td>
          </tr>`
          )
          .join("")
      : `<tr><td colspan="5" class="empty">কোনো বোর্ডিং তথ্য পাওয়া যায়নি</td></tr>`;

  const fundsHtml =
    fundRows.length > 0
      ? fundRows
          .map(
            (r) => `
          <tr>
            <td>${escapeHtml(r.fund_name)}</td>
            <td>${escapeHtml(r.category || "সাধারণ")}</td>
            <td class="num">৳ ${formatBanglaCurrency(r.target_amount)}</td>
            <td class="num">৳ ${formatBanglaCurrency(r.current_balance)}</td>
            <td class="num">${toBanglaNumber(r.target_attainment_pct)}%</td>
          </tr>`
          )
          .join("")
      : `<tr><td colspan="5" class="empty">কোনো ফান্ড তথ্য পাওয়া যায়নি</td></tr>`;

  const duesHtml =
    classDueRows.length > 0
      ? classDueRows
          .map(
            (r) => `
          <tr>
            <td>${escapeHtml(r.class_name)}</td>
            <td class="num">${toBanglaNumber(r.student_count)}</td>
            <td class="num">৳ ${formatBanglaCurrency(r.total_payable)}</td>
            <td class="num">৳ ${formatBanglaCurrency(r.total_paid)}</td>
            <td class="num">৳ ${formatBanglaCurrency(r.total_due)}</td>
            <td class="num">${toBanglaNumber(r.due_ratio_pct)}%</td>
          </tr>`
          )
          .join("")
      : `<tr><td colspan="6" class="empty">কোনো জামাতভিত্তিক ফি তথ্য পাওয়া যায়নি</td></tr>`;

  const examsHtml =
    examRows.length > 0
      ? examRows
          .map(
            (r) => `
          <tr>
            <td>${escapeHtml(r.exam_title)}</td>
            <td class="num">${toBanglaNumber(r.exam_year ?? "-")}</td>
            <td class="num">${toBanglaNumber(r.examined_students)} জন</td>
            <td class="num">${toBanglaNumber(r.avg_percentage)}%</td>
            <td class="num">${toBanglaNumber(r.pass_rate_pct)}%</td>
          </tr>`
          )
          .join("")
      : `<tr><td colspan="5" class="empty">কোনো পরীক্ষার ফলাফল পাওয়া যায়নি</td></tr>`;

  return `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Noto Sans Bengali", "Hind Siliguri", system-ui, -apple-system, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 18px 22px 48px;
      font-size: 12px;
      line-height: 1.5;
      background: #ffffff;
    }
    .header {
      border-bottom: 2px solid #047857;
      padding-bottom: 10px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .header h1 { margin: 0; font-size: 18px; color: #064e3b; }
    .header p { margin: 2px 0 0; color: #475569; font-size: 11px; }
    .meta { text-align: right; font-size: 10px; color: #475569; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .kpi {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
      background: #f8fafc;
    }
    .kpi .label { font-size: 10px; color: #475569; }
    .kpi .value { font-size: 15px; font-weight: 700; color: #0f172a; margin-top: 2px; }
    h2 {
      font-size: 13px;
      color: #065f46;
      margin: 14px 0 6px;
      border-left: 3px solid #059669;
      padding-left: 8px;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 5px 8px;
      text-align: left;
      font-size: 11px;
    }
    th { background: #ecfdf5; color: #064e3b; font-weight: 700; }
    td.num, th.num { text-align: right; }
    td.empty { text-align: center; color: #64748b; padding: 10px; }
    @media print {
      body { padding: 0 0 32px; }
    }
  </style>
</head>
<body>
  ${watermarkOverlay}
  <div class="header">
    <div>
      <h1>${title}</h1>
      <p>${escapeHtml(watermark.madrasaName)} · সময়কাল: বিগত ${toBanglaNumber(s.months || 6)} মাস</p>
    </div>
    <div class="meta">
      <div>প্রস্তুতকারী: ${escapeHtml(watermark.exportedBy)} (${escapeHtml(watermark.actorRole)})</div>
      <div>সময়: ${escapeHtml(watermark.exportedAtDhaka)}</div>
      <div>রেফারেন্স: ${escapeHtml(watermark.exportId)}</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi">
      <div class="label">মোট ফি আদায়</div>
      <div class="value">৳ ${formatBanglaCurrency(summary.totalFeeCollections)}</div>
    </div>
    <div class="kpi">
      <div class="label">মোট বকেয়া ও অনুপাত</div>
      <div class="value">৳ ${formatBanglaCurrency(summary.totalFeeDue)} (${toBanglaNumber(summary.overallDueRatioPct)}%)</div>
    </div>
    <div class="kpi">
      <div class="label">বোর্ডিং গড় মাথাপিছু খরচ</div>
      <div class="value">৳ ${formatBanglaCurrency(summary.avgPerCapitaBazarCost)}</div>
    </div>
    <div class="kpi">
      <div class="label">যাকাত ও ফান্ড স্থিতি</div>
      <div class="value">৳ ${formatBanglaCurrency(summary.totalFundBalance)}</div>
    </div>
  </div>

  <h2>১. বোর্ডিং মাথাপিছু বাজার খরচ বনাম বোর্ডিং ফি আয়</h2>
  <table>
    <thead>
      <tr>
        <th>মাস</th>
        <th class="num">মোট বাজার খরচ</th>
        <th class="num">বোর্ডিং ফি আয়</th>
        <th class="num">সক্রিয় বোর্ডার</th>
        <th class="num">মাথাপিছু খরচ</th>
      </tr>
    </thead>
    <tbody>${boardingHtml}</tbody>
  </table>

  <h2>২. যাকাত ও বিশেষ ফান্ডের স্বাস্থ্য</h2>
  <table>
    <thead>
      <tr>
        <th>ফান্ডের নাম</th>
        <th>ক্যাটাগরি</th>
        <th class="num">লক্ষ্যমাত্রা</th>
        <th class="num">বর্তমান স্থিতি</th>
        <th class="num">অর্জন (%)</th>
      </tr>
    </thead>
    <tbody>${fundsHtml}</tbody>
  </table>

  <h2>৩. জামাতভিত্তিক ফি বকেয়া অনুপাত</h2>
  <table>
    <thead>
      <tr>
        <th>জামাত / শ্রেণি</th>
        <th class="num">শিক্ষার্থী</th>
        <th class="num">মোট প্রদেয়</th>
        <th class="num">আদায়কৃত</th>
        <th class="num">বকেয়া</th>
        <th class="num">বকেয়া (%)</th>
      </tr>
    </thead>
    <tbody>${duesHtml}</tbody>
  </table>

  <h2>৪. সেশন-টু-সেশন ও পরীক্ষাভিত্তিক ফলাফল তুলনা</h2>
  <table>
    <thead>
      <tr>
        <th>পরীক্ষার নাম</th>
        <th class="num">সাল</th>
        <th class="num">পরীক্ষার্থী</th>
        <th class="num">গড় নম্বর (%)</th>
        <th class="num">পাসের হার (%)</th>
      </tr>
    </thead>
    <tbody>${examsHtml}</tbody>
  </table>
</body>
</html>`;
}

export const generateDigestHtml = buildDigestHtml;
export const renderDigestHtml = buildDigestHtml;

/**
 * Generates a watermarked Excel `.xlsx` workbook buffer for the Executive BI Digest.
 */
export function buildDigestWorkbook(
  snapshot: ExecutiveBiSnapshot | Record<string, any>,
  watermarkInput: ExportWatermarkMetadata | Record<string, any>
): Buffer {
  const watermark: ExportWatermarkMetadata =
    "watermarkLine" in watermarkInput && "exportedAtDhaka" in watermarkInput
      ? (watermarkInput as ExportWatermarkMetadata)
      : buildExportWatermark({
          exportedBy: String(watermarkInput.exportedBy || "System"),
          actorRole: String(watermarkInput.actorRole || "muhtamim"),
          ipAddress: String(watermarkInput.ipAddress || "unknown"),
          madrasaName: String(watermarkInput.madrasaName || "QawmiERP"),
          dataset: String(watermarkInput.dataset || "executive_bi_digest"),
          exportId: watermarkInput.exportId ? String(watermarkInput.exportId) : undefined,
        });

  const s = snapshot as ExecutiveBiSnapshot;
  const boardingRows = Array.isArray(s.boarding) ? s.boarding : s.boarding_monthly || [];
  const fundRows = Array.isArray(s.funds) ? s.funds : s.fund_health || [];
  const classDueRows = Array.isArray(s.classFeeDues) ? s.classFeeDues : s.class_fee_dues || [];
  const examRows = Array.isArray(s.sessionExamComparison)
    ? s.sessionExamComparison
    : s.session_exam_results || [];

  const headers = [
    "Pillar",
    "Item / Month / Class",
    "Metric 1",
    "Metric 2",
    "Metric 3",
    "Metric 4",
  ];

  const rows: (string | number | null)[][] = [];

  for (const b of boardingRows) {
    rows.push([
      "Boarding Monthly",
      b.month_key,
      b.total_bazar_expense,
      b.boarding_fee_income,
      b.active_boarders,
      b.per_capita_bazar_cost,
    ]);
  }
  for (const f of fundRows) {
    rows.push([
      "Fund Health",
      f.fund_name,
      f.target_amount,
      f.current_balance,
      f.target_attainment_pct,
      f.category || "General",
    ]);
  }
  for (const c of classDueRows) {
    rows.push([
      "Class Fee Dues",
      c.class_name,
      c.total_payable,
      c.total_paid,
      c.total_due,
      c.due_ratio_pct,
    ]);
  }
  for (const e of examRows) {
    rows.push([
      "Exam Results",
      e.exam_title,
      e.exam_year ?? 0,
      e.examined_students,
      e.avg_percentage,
      e.pass_rate_pct,
    ]);
  }

  return buildWatermarkedWorkbook("Executive BI Digest", headers, rows, watermark);
}

export const generateDigestWorkbook = buildDigestWorkbook;
export const buildDigestXlsx = buildDigestWorkbook;

/**
 * Looks up a digest schedule or generated digest ID strictly scoped to `madrasaId`.
 */
export async function getDigestScheduleById(
  madrasaId: string,
  scheduleId: string
): Promise<DigestScheduleRecord | null> {
  if (!madrasaId || !scheduleId) return null;

  try {
    const admin = await createAdminClient();
    const { data, error } = await admin
      .from("digest_schedules")
      .select("*")
      .eq("id", scheduleId)
      .eq("madrasa_id", madrasaId)
      .maybeSingle();

    if (!error && data) {
      return {
        ...data,
        recipients: Array.isArray(data.recipients) ? data.recipients : [],
      } as DigestScheduleRecord;
    }

    if (error && !isMissingTableError(error)) {
      return null;
    }
  } catch {
    // fall through to fallback
  }

  const fbSched = await getStructuredMadrasaSetting<DigestScheduleRecord[]>(
    madrasaId,
    FALLBACK_BI_NAMESPACE,
    FALLBACK_SCHEDULES_KEY
  );
  if (Array.isArray(fbSched.value)) {
    const found = fbSched.value.find((r) => r.id === scheduleId && r.madrasa_id === madrasaId);
    if (found) return found;
  }

  const fbDigests = await getStructuredMadrasaSetting<DigestScheduleRecord[]>(
    madrasaId,
    FALLBACK_BI_NAMESPACE,
    FALLBACK_DIGESTS_KEY
  );
  if (Array.isArray(fbDigests.value)) {
    const found = fbDigests.value.find((r) => r.id === scheduleId && r.madrasa_id === madrasaId);
    if (found) return found;
  }

  return null;
}

/**
 * Generates a watermarked Executive BI digest (HTML or XLSX) and logs `SENSITIVE_DATA_EXPORTED`
 * to `system_audit_logs`.
 */
export async function generateAndAuditDigest(
  input: GenerateDigestInput
): Promise<GeneratedDigestResult> {
  const format: "html" | "xlsx" = input.format === "xlsx" ? "xlsx" : "html";
  const snapshot = await getExecutiveBiSnapshot(input.madrasaId, {
    months: input.months ?? 6,
    sessionId: input.sessionId ?? null,
  });

  const rowCount =
    snapshot.boarding.length +
    snapshot.funds.length +
    snapshot.classFeeDues.length +
    snapshot.sessionExamComparison.length;

  const watermark = buildExportWatermark({
    exportedBy: input.actorName || "System",
    actorRole: input.actorRole || "muhtamim",
    ipAddress: input.ipAddress || "unknown",
    madrasaName: input.madrasaName || "QawmiERP",
    dataset: "executive_bi_digest",
    rowCount,
  });

  await logAuditEvent({
    madrasaId: input.madrasaId,
    actorId: input.actorId || null,
    actorName: input.actorName,
    actorRole: input.actorRole,
    module: "analytics",
    action: "SENSITIVE_DATA_EXPORTED",
    entityType: "bi_digest",
    entityId: input.scheduleId || watermark.exportId,
    summary: `নির্বাহী বিআই ডাইজেস্ট (${format.toUpperCase()}) এক্সপোর্ট করা হয়েছে (Ref: ${watermark.exportId})`,
    metadata: {
      exportId: watermark.exportId,
      format,
      ipAddress: input.ipAddress,
      scheduleId: input.scheduleId || null,
      rowCount,
    },
    severity: "INFO",
  });

  if (format === "xlsx") {
    const workbook = buildDigestWorkbook(snapshot, watermark);
    return {
      format: "xlsx",
      watermark,
      snapshot,
      workbook,
      filename: `executive-bi-digest-${watermark.exportId}.xlsx`,
    };
  }

  const html = buildDigestHtml(snapshot, watermark, { title: input.title });
  return {
    format: "html",
    watermark,
    snapshot,
    html,
    filename: `executive-bi-digest-${watermark.exportId}.html`,
  };
}

/**
 * Dispatches scheduled digest notifications via M3's `dispatchNotification`.
 */
export async function dispatchScheduledDigestNotifications(
  madrasaId: string,
  schedule: DigestScheduleRecord,
  snapshot: ExecutiveBiSnapshot
): Promise<{ sentCount: number; failedCount: number }> {
  const recipients = Array.isArray(schedule.recipients) ? schedule.recipients.filter(Boolean) : [];
  const targets = recipients.length > 0 ? recipients : [""];
  let sentCount = 0;
  let failedCount = 0;

  const summaryText =
    `নির্বাহী বিআই ডাইজেস্ট (${schedule.frequency === "monthly" ? "মাসিক" : "সাপ্তাহিক"}): ` +
    `মোট ফি আদায় ৳${formatBanglaCurrency(snapshot.summary.totalFeeCollections)}, ` +
    `বকেয়া ৳${formatBanglaCurrency(snapshot.summary.totalFeeDue)} (${toBanglaNumber(snapshot.summary.overallDueRatioPct)}%), ` +
    `ফান্ড স্থিতি ৳${formatBanglaCurrency(snapshot.summary.totalFundBalance)}।`;

  for (const recipient of targets) {
    const isEmail = recipient.includes("@");
    try {
      const res = await dispatchNotification("executive_bi_digest", {
        madrasaId,
        recipientEmail: isEmail ? recipient : null,
        recipientPhone: !isEmail && recipient ? recipient : null,
        subject: schedule.name || "Executive BI Digest Report",
        body: summaryText,
        channels: isEmail ? ["email", "in_app"] : ["in_app"],
        metadata: {
          scheduleId: schedule.id,
          frequency: schedule.frequency,
        },
      });
      if (res.ok) sentCount += 1;
      else failedCount += 1;
    } catch {
      failedCount += 1;
    }
  }

  return { sentCount, failedCount };
}
