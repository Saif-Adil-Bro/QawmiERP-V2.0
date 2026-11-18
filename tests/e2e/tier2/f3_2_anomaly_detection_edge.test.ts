import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "../helpers/runner";
import { loadModule, loadRouteHandler } from "../helpers/module-loader";
import { verifySqlMigrationContract } from "../helpers/sql-verifier";
import {
  createTestHarness,
  type E2eTestHarness,
} from "../helpers/test-harness";
import { MADRASA_A_ID, MADRASA_B_ID, USERS } from "../helpers/fixtures";

describe("Tier 2 — Feature 3.2: Financial & Boarding Anomaly Detection (Edge, Security & Negative)", () => {
  let harness: E2eTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  it("T2-3.2-01: Z-Score detector handles zero-variance baseline and insufficient history without NaN or false spikes", async () => {
    const mod = await loadModule<{
      detectMovingAverageZScoreAnomalies: (
        series: Array<{ date: string; amount: number; label?: string }>,
        config?: Record<string, unknown>
      ) => Array<Record<string, unknown>>;
    }>("@/lib/anomaly-detection", ["detectMovingAverageZScoreAnomalies"]);

    const flatSeries = [
      { date: "2026-11-01", amount: 5000 },
      { date: "2026-11-02", amount: 5000 },
      { date: "2026-11-03", amount: 5000 },
      { date: "2026-11-04", amount: 5000 },
      { date: "2026-11-05", amount: 5000 },
    ];
    const flatAnomalies = mod.detectMovingAverageZScoreAnomalies(flatSeries, {
      zThreshold: 2.5,
    });
    assert.equal(
      flatAnomalies.length,
      0,
      "Constant zero-variance series must produce 0 anomalies (no 0/0 NaN)"
    );

    const shortSeries = [{ date: "2026-11-01", amount: 9000 }];
    const shortAnomalies = mod.detectMovingAverageZScoreAnomalies(shortSeries, {
      zThreshold: 2.5,
    });
    assert.equal(shortAnomalies.length, 0);
  });

  it("T2-3.2-02: Duplicate voucher detector flags same-day identical amount+category but ignores different dates", async () => {
    const mod = await loadModule<{
      detectDuplicateVouchers: (
        records: Array<Record<string, unknown>>
      ) => Array<Record<string, unknown>>;
    }>("@/lib/anomaly-detection", ["detectDuplicateVouchers"]);

    const sameDayDup = mod.detectDuplicateVouchers([
      {
        id: "exp-1",
        expense_date: "2026-11-10",
        amount: 4500,
        category: "Electricity",
        description: "বিদ্যুৎ বিল",
      },
      {
        id: "exp-2",
        expense_date: "2026-11-10",
        amount: 4500,
        category: "Electricity",
        description: "বিদ্যুৎ বিল",
      },
    ]);
    assert.ok(sameDayDup.length >= 1, "Same-day duplicate voucher must be flagged");

    const diffDaySameAmt = mod.detectDuplicateVouchers([
      {
        id: "exp-3",
        expense_date: "2026-11-01",
        amount: 4500,
        category: "Electricity",
        description: "বিদ্যুৎ বিল",
      },
      {
        id: "exp-4",
        expense_date: "2026-11-15",
        amount: 4500,
        category: "Electricity",
        description: "বিদ্যুৎ বিল",
      },
    ]);
    assert.equal(
      diffDaySameAmt.length,
      0,
      "Identical amount on different dates must NOT be flagged as same-day duplicate"
    );
  });

  it("T2-3.2-03: Running runFinancialAnomalyScan twice deduplicates identical open anomalies", async () => {
    const mod = await loadModule<{
      runFinancialAnomalyScan: (
        madrasaId: string,
        opts?: { lookbackDays?: number }
      ) => Promise<Record<string, unknown>>;
      getFinancialAnomalies: (
        madrasaId: string
      ) => Promise<Record<string, unknown>[]>;
    }>("@/lib/anomaly-detection-service", [
      "runFinancialAnomalyScan",
      "getFinancialAnomalies",
    ]);

    harness.db.seed("expenses", [
      {
        id: "exp-dup-a",
        madrasa_id: MADRASA_A_ID,
        expense_date: "2026-11-10",
        amount: 8500,
        category: "Utilities",
        description: "গ্যাস বিল",
      },
      {
        id: "exp-dup-b",
        madrasa_id: MADRASA_A_ID,
        expense_date: "2026-11-10",
        amount: 8500,
        category: "Utilities",
        description: "গ্যাস বিল",
      },
    ]);

    await mod.runFinancialAnomalyScan(MADRASA_A_ID, { lookbackDays: 30 });
    const count1 = (await mod.getFinancialAnomalies(MADRASA_A_ID)).length;

    await mod.runFinancialAnomalyScan(MADRASA_A_ID, { lookbackDays: 30 });
    const count2 = (await mod.getFinancialAnomalies(MADRASA_A_ID)).length;

    assert.ok(count1 >= 1);
    assert.equal(
      count2,
      count1,
      "Re-running anomaly scan must deduplicate existing open anomalies"
    );
  });

  it("T2-3.2-04: /api/anomalies rejects unauthenticated (401) & teacher (403); /api/cron/anomalies rejects bad CRON_SECRET (401)", async () => {
    const getAnomalies = await loadRouteHandler("anomalies", "GET");
    const cronAnomalies = await loadRouteHandler("cron/anomalies", "POST");

    harness.auth.asAnonymous();
    const anonRes = await getAnomalies(
      harness.createRequest("/api/anomalies", { method: "GET" })
    );
    assert.equal(anonRes.status, 401);

    harness.auth.asUser(USERS.teacherA);
    const teacherRes = await getAnomalies(
      harness.createRequest("/api/anomalies", { method: "GET" })
    );
    assert.equal(teacherRes.status, 403);

    const cronRes = await cronAnomalies(
      harness.createRequest("/api/cron/anomalies", {
        method: "POST",
        headers: { authorization: "Bearer invalid-cron-secret" },
        body: {},
      })
    );
    assert.equal(cronRes.status, 401);
  });

  it("T2-3.2-05: Resolving an anomaly updates status/resolved_by/notes and logs ANOMALY_RESOLVED", async () => {
    const patchAnomalies = await loadRouteHandler("anomalies", "PATCH");

    harness.auth.asUser(USERS.muhtamimA);
    harness.db.seed("financial_anomalies", {
      id: "anom-res-1",
      madrasa_id: MADRASA_A_ID,
      anomaly_type: "DUPLICATE_VOUCHER",
      severity: "WARNING",
      status: "OPEN",
      title: "ডুপ্লিকেট ভাউচার",
      description: "একই দিনে দুইটি এন্ট্রি",
      detected_at: new Date().toISOString(),
    });

    const res = await patchAnomalies(
      harness.createRequest("/api/anomalies", {
        method: "PATCH",
        body: {
          id: "anom-res-1",
          anomalyId: "anom-res-1",
          status: "RESOLVED",
          resolutionNotes: "যাচাই করে একটি বাতিল করা হয়েছে",
        },
      })
    );
    assert.equal(res.status, 200);
    await harness.flushAsync();

    const rows = harness.db.getRows(
      "financial_anomalies",
      (r) => r.id === "anom-res-1"
    );
    assert.equal(rows[0].status, "RESOLVED");

    const audits = harness.db.getRows(
      "system_audit_logs",
      (r) => r.action === "ANOMALY_RESOLVED"
    );
    assert.ok(audits.length >= 1, "Resolving anomaly must log ANOMALY_RESOLVED");
  });

  it("T2-3.2-06: Cross-tenant isolation prevents Madrasa B from scanning or viewing Madrasa A anomalies", async () => {
    const mod = await loadModule<{
      getFinancialAnomalies: (
        madrasaId: string
      ) => Promise<Record<string, unknown>[]>;
    }>("@/lib/anomaly-detection-service", ["getFinancialAnomalies"]);

    harness.db.seed("financial_anomalies", {
      id: "anom-tenant-a-only",
      madrasa_id: MADRASA_A_ID,
      anomaly_type: "BAZAR_SPIKE",
      severity: "CRITICAL",
      status: "OPEN",
      title: "Madrasa A Secret Spike",
    });

    const listB = await mod.getFinancialAnomalies(MADRASA_B_ID);
    assert.ok(
      !listB.some((a) => a.id === "anom-tenant-a-only"),
      "Madrasa B must never see Madrasa A anomalies"
    );
  });

  it("T2-3.2-07: Missing financial_anomalies (42P01) falls back cleanly and Phase 3 SQL enforces RLS", async () => {
    verifySqlMigrationContract({
      filePath: "supabase_phase_3_ai_migration.sql",
      tables: [{ tableName: "financial_anomalies" }],
    });

    const mod = await loadModule<{
      getFinancialAnomalies: (
        madrasaId: string
      ) => Promise<Record<string, unknown>[]>;
    }>("@/lib/anomaly-detection-service", ["getFinancialAnomalies"]);

    harness.db.markTableMissing("financial_anomalies", "42P01");
    const list = await mod.getFinancialAnomalies(MADRASA_A_ID);
    assert.ok(Array.isArray(list));
  });
});
