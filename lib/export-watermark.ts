/**
 * Export Audit Watermarking Engine (Feature 1.3)
 *
 * Pure isomorphic module (depends only on `xlsx` and `lib/date-utils.ts`, zero `next/headers`).
 * Generates traceable CSV, XLSX, and Print/PDF watermarks embedding exporter name,
 * role, Asia/Dhaka timestamp, IP address, madrasa name, dataset, and audit reference ID.
 */

import * as XLSX from "xlsx";
import { DHAKA_TIME_ZONE, toDhakaDateString } from "@/lib/date-utils";

export type ExportDatasetKey =
  | "students"
  | "donors"
  | "life_member_donors"
  | "alumni"
  | "system_audit_logs"
  | "security_audit_logs"
  | "activity_logs";

export type ExportFormat = "csv" | "xlsx" | "json" | "print_meta";

export interface ExportWatermarkInput {
  exportedBy: string;
  actorRole: string;
  ipAddress: string;
  madrasaName?: string;
  dataset: string;
  exportId?: string;
  rowCount?: number;
  exportedAt?: Date | string;
}

export interface ExportWatermarkMetadata {
  exportId: string;
  exportedBy: string;
  actorRole: string;
  ipAddress: string;
  madrasaName: string;
  dataset: string;
  rowCount: number;
  exportedAtIso: string;
  exportedAtDhaka: string;
  watermarkLine: string;
}

export type PrintWatermarkOptions = ExportWatermarkMetadata;

/**
 * Formats a timestamp in `Asia/Dhaka` (+06:00): `YYYY-MM-DD HH:mm:ss (+06:00)`.
 */
export function formatDhakaTimestamp(input: Date | string = new Date()): string {
  const date = input instanceof Date ? input : new Date(input);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: DHAKA_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(safeDate);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
    const hour = get("hour") === "24" ? "00" : get("hour");
    return `${get("year")}-${get("month")}-${get("day")} ${hour}:${get("minute")}:${get("second")} (+06:00)`;
  } catch {
    return `${toDhakaDateString(safeDate)} 00:00:00 (+06:00)`;
  }
}

function generateFallbackExportId(date: Date): string {
  const day = toDhakaDateString(date).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `EXP-${day}-${rand}`;
}

function stripCrLf(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/**
 * Builds canonical export watermark metadata with Asia/Dhaka timestamp and traceable stamp line.
 */
export function buildExportWatermark(ctx: ExportWatermarkInput): ExportWatermarkMetadata {
  const now = ctx.exportedAt
    ? ctx.exportedAt instanceof Date
      ? ctx.exportedAt
      : new Date(ctx.exportedAt)
    : new Date();
  const safeDate = Number.isNaN(now.getTime()) ? new Date() : now;

  const exportedBy = stripCrLf(ctx.exportedBy || "System User") || "System User";
  const actorRole = stripCrLf(ctx.actorRole || "staff") || "staff";
  const ipAddress = stripCrLf(ctx.ipAddress || "unknown") || "unknown";
  const madrasaName = stripCrLf(ctx.madrasaName || "QawmiERP") || "QawmiERP";
  const dataset = stripCrLf(ctx.dataset || "export") || "export";
  const exportId = stripCrLf(ctx.exportId || generateFallbackExportId(safeDate));
  const rowCount = typeof ctx.rowCount === "number" && Number.isFinite(ctx.rowCount) ? ctx.rowCount : 0;

  const exportedAtIso = safeDate.toISOString();
  const exportedAtDhaka = formatDhakaTimestamp(safeDate);
  const watermarkLine = stripCrLf(
    `CONFIDENTIAL | Exported by: ${exportedBy} (${actorRole}) | Time: ${exportedAtDhaka} | IP: ${ipAddress} | Dataset: ${dataset} | Ref: ${exportId}`
  );

  return {
    exportId,
    exportedBy,
    actorRole,
    ipAddress,
    madrasaName,
    dataset,
    rowCount,
    exportedAtIso,
    exportedAtDhaka,
    watermarkLine,
  };
}

/**
 * Neutralizes spreadsheet formula injection (`=`, `+`, `@`, `\t`, `\r`, or non-numeric `-`)
 * for both CSV and XLSX cells.
 */
export function sanitizeSpreadsheetCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (!str) return "";

  const first = str[0];
  if (first === "=" || first === "+" || first === "@" || first === "\t" || first === "\r") {
    return `'${str}`;
  }
  if (first === "-" && !/^-?\d+(\.\d+)?$/.test(str.trim())) {
    return `'${str}`;
  }
  return str;
}

/**
 * Formula-safe, RFC-4180 compliant CSV cell encoder.
 */
export function escapeCsvCell(value: unknown): string {
  const safe = sanitizeSpreadsheetCell(value);
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * Builds a UTF-8 BOM watermarked CSV string containing header + footer audit watermark metadata
 * and formula-injection-escaped data rows.
 */
export function buildWatermarkedCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  watermark: ExportWatermarkMetadata
): string {
  const effectiveRowCount = watermark.rowCount > 0 ? watermark.rowCount : rows.length;
  const metaLines = [
    `# ${watermark.watermarkLine}`,
    `# Madrasa: ${watermark.madrasaName} | Dataset: ${watermark.dataset} | Rows: ${effectiveRowCount} | Export ID: ${watermark.exportId}`,
    `# Exported By: ${watermark.exportedBy} (${watermark.actorRole}) | Exported At (Asia/Dhaka): ${watermark.exportedAtDhaka} | IP: ${watermark.ipAddress}`,
  ];

  const headerLine = headers.map((h) => escapeCsvCell(h)).join(",");
  const dataLines = rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(","));
  const footerLine = `# FOOTER | ${watermark.watermarkLine}`;

  return `\uFEFF${[...metaLines, headerLine, ...dataLines, footerLine].join("\n")}`;
}

function sanitizeSheetName(name: string): string {
  const cleaned = String(name || "Export")
    .replace(/[\\/?*[\]:]/g, " ")
    .trim();
  return (cleaned || "Export").slice(0, 31);
}

/**
 * Builds a watermarked Excel `.xlsx` workbook buffer:
 * - Sets workbook properties (`Author`, `Comments`, `Title`, `Subject`, `CreatedDate`)
 * - Inserts watermark banner rows at top and watermark footer row at bottom of data sheet
 * - Appends a dedicated `_Audit_Watermark` sheet with full structured audit metadata
 */
export function buildWatermarkedWorkbook(
  sheetName: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  watermark: ExportWatermarkMetadata
): Buffer {
  const wb = XLSX.utils.book_new();
  const effectiveRowCount = watermark.rowCount > 0 ? watermark.rowCount : rows.length;

  wb.Props = {
    Title: `${watermark.madrasaName} - ${watermark.dataset}`,
    Subject: `Watermarked Audit Export (${watermark.exportId})`,
    Author: watermark.exportedBy,
    Comments: watermark.watermarkLine,
    CreatedDate: new Date(watermark.exportedAtIso),
  };

  const safeRows = rows.map((row) =>
    row.map((cell) => {
      if (typeof cell === "number" && Number.isFinite(cell)) return cell;
      return sanitizeSpreadsheetCell(cell);
    })
  );

  const dataAoa: (string | number)[][] = [
    [watermark.watermarkLine],
    [
      `Madrasa: ${watermark.madrasaName}`,
      `Dataset: ${watermark.dataset}`,
      `Rows: ${effectiveRowCount}`,
      `Time (Asia/Dhaka): ${watermark.exportedAtDhaka}`,
      `IP: ${watermark.ipAddress}`,
      `Ref: ${watermark.exportId}`,
    ],
    headers.map((h) => sanitizeSpreadsheetCell(h)),
    ...safeRows,
    [],
    [watermark.watermarkLine],
  ];

  const dataSheet = XLSX.utils.aoa_to_sheet(dataAoa);
  const safeName = sanitizeSheetName(sheetName);
  XLSX.utils.book_append_sheet(wb, dataSheet, safeName);

  const auditAoa: (string | number)[][] = [
    ["Audit Field", "Value"],
    ["Export ID", watermark.exportId],
    ["Exported By", watermark.exportedBy],
    ["Actor Role", watermark.actorRole],
    ["Madrasa", watermark.madrasaName],
    ["Dataset", watermark.dataset],
    ["Row Count", effectiveRowCount],
    ["Exported At (Asia/Dhaka)", watermark.exportedAtDhaka],
    ["Exported At (UTC ISO)", watermark.exportedAtIso],
    ["IP Address", watermark.ipAddress],
    ["Watermark Stamp", watermark.watermarkLine],
  ];

  const auditSheet = XLSX.utils.aoa_to_sheet(auditAoa);
  XLSX.utils.book_append_sheet(wb, auditSheet, "_Audit_Watermark");

  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}

/** Alias for workbook builder */
export const buildWatermarkedXlsx = buildWatermarkedWorkbook;

/**
 * Escapes HTML special characters to prevent XSS in printed watermark overlays.
 */
export function escapeHtml(input: string): string {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Generates HTML-escaped diagonal watermark overlay + fixed audit footer HTML/CSS string
 * suitable for injection into isolated print / PDF documents.
 */
export function buildPrintWatermarkHtml(watermark: ExportWatermarkMetadata): string {
  const safeBy = escapeHtml(watermark.exportedBy);
  const safeRole = escapeHtml(watermark.actorRole);
  const safeTime = escapeHtml(watermark.exportedAtDhaka);
  const safeIp = escapeHtml(watermark.ipAddress);
  const safeId = escapeHtml(watermark.exportId);
  const safeMadrasa = escapeHtml(watermark.madrasaName);
  const safeDataset = escapeHtml(watermark.dataset);

  const tileText = `${safeBy} • ${safeTime} • IP: ${safeIp} • ${safeId}`;
  const tiles = Array.from({ length: 6 })
    .map(() => `<div class="qawmi-wm-tile">${tileText}</div>`)
    .join("");

  return `<style>
  .qawmi-print-watermark-overlay {
    position: fixed;
    inset: 0;
    z-index: 9998;
    pointer-events: none;
    overflow: hidden;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(3, 1fr);
    align-items: center;
    justify-items: center;
    opacity: 0.08;
    user-select: none;
  }
  .qawmi-wm-tile {
    transform: rotate(-28deg);
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
    white-space: nowrap;
    letter-spacing: 0.04em;
  }
  .qawmi-print-watermark-footer {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 9999;
    background: rgba(255, 255, 255, 0.94);
    border-top: 1px solid #cbd5e1;
    padding: 4px 10px;
    font-size: 9px;
    color: #334155;
    display: flex;
    justify-content: space-between;
    gap: 8px;
    pointer-events: none;
  }
</style>
<div class="qawmi-print-watermark-overlay" aria-hidden="true">${tiles}</div>
<div class="qawmi-print-watermark-footer">
  <span><strong>CONFIDENTIAL</strong> · ${safeMadrasa} (${safeDataset})</span>
  <span>Exported by: ${safeBy} (${safeRole}) | Time: ${safeTime} | IP: ${safeIp} | Ref: ${safeId}</span>
</div>`;
}
