"use client";

import type { ExportDatasetKey, ExportWatermarkMetadata } from "@/lib/export-watermark";

export interface TriggerWatermarkedExportParams {
  dataset: ExportDatasetKey | string;
  format: "csv" | "xlsx";
  filename: string;
  sheetName?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}

/**
 * Calls `/api/exports` so that PII masking, Asia/Dhaka audit watermarking,
 * and mandatory `SENSITIVE_DATA_EXPORTED` logging happen on the server,
 * then downloads the resulting CSV or XLSX file in the browser.
 */
export async function triggerWatermarkedExport(
  params: TriggerWatermarkedExportParams
): Promise<{ ok: boolean; exportId?: string; error?: string }> {
  const res = await fetch("/api/exports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    let errMsg = "এক্সপোর্ট ব্যর্থ হয়েছে।";
    try {
      const json = await res.json();
      if (json?.error) errMsg = json.error;
    } catch {}
    return { ok: false, error: errMsg };
  }

  const blob = await res.blob();
  const exportId = res.headers.get("X-Export-Id") || undefined;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${params.filename}.${params.format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { ok: true, exportId };
}

/**
 * Fetches server-signed watermark metadata and records `SENSITIVE_DATA_EXPORTED`
 * before calling `printElementIsolated(..., watermark)`.
 */
export async function fetchPrintWatermarkMeta(
  dataset: ExportDatasetKey | string,
  rowCount: number
): Promise<ExportWatermarkMetadata | null> {
  try {
    const res = await fetch("/api/exports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataset,
        format: "print_meta",
        headers: ["Dataset", "Rows"],
        rows: [[dataset, rowCount]],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.watermark as ExportWatermarkMetadata) || null;
  } catch {
    return null;
  }
}
