"use server";

import { writeGuard } from "@/lib/action-authorization";
import {
  getFinancialAnomalies,
  runFinancialAnomalyScan,
  updateFinancialAnomalyStatus,
  type AnomalyScanResult,
  type FinancialAnomalyRecord,
} from "@/lib/anomaly-detection-service";

export async function getFinancialAnomaliesAction(filters?: {
  status?: string;
  severity?: string;
  limit?: number;
}): Promise<{
  ok: boolean;
  anomalies: FinancialAnomalyRecord[];
  error?: string;
}> {
  const auth = await writeGuard("anomaly");
  if (!auth.allowed) {
    return {
      ok: false,
      anomalies: [],
      error: auth.error || "অননুমোদিত অ্যাক্সেস।",
    };
  }
  if (!auth.madrasaId) {
    return {
      ok: false,
      anomalies: [],
      error: "অননুমোদিত অ্যাক্সেস।",
    };
  }

  const anomalies = await getFinancialAnomalies(auth.madrasaId, filters);
  return { ok: true, anomalies };
}

export async function runFinancialAnomalyScanAction(
  lookbackDays?: number
): Promise<{
  ok: boolean;
  result?: AnomalyScanResult;
  error?: string;
}> {
  const auth = await writeGuard("anomaly");
  if (!auth.allowed) {
    return { ok: false, error: auth.error || "অননুমোদিত অ্যাক্সেস।" };
  }
  if (!auth.madrasaId) {
    return { ok: false, error: "অননুমোদিত অ্যাক্সেস।" };
  }

  const result = await runFinancialAnomalyScan(auth.madrasaId, {
    lookbackDays,
    actorId: auth.userId || null,
    actorName: auth.actorName || null,
  });

  return { ok: true, result };
}

export async function resolveFinancialAnomalyAction(input: {
  anomalyId: string;
  status: "INVESTIGATING" | "RESOLVED" | "DISMISSED";
  resolutionNotes?: string;
}): Promise<{
  ok: boolean;
  record?: FinancialAnomalyRecord;
  error?: string;
}> {
  const auth = await writeGuard("anomaly");
  if (!auth.allowed) {
    return { ok: false, error: auth.error || "অননুমোদিত অ্যাক্সেস।" };
  }
  if (!auth.madrasaId || !auth.userId) {
    return { ok: false, error: "অননুমোদিত অ্যাক্সেস।" };
  }

  return updateFinancialAnomalyStatus({
    madrasaId: auth.madrasaId,
    anomalyId: input.anomalyId,
    status: input.status,
    actorId: auth.userId,
    actorName: auth.actorName || undefined,
    resolutionNotes: input.resolutionNotes,
  });
}
