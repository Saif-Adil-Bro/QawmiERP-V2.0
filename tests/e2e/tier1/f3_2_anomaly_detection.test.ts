import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "../helpers/runner";
import { loadModule, loadRouteHandler } from "../helpers/module-loader";
import {
  createTestHarness,
  type E2eTestHarness,
} from "../helpers/test-harness";
import { MADRASA_A_ID, USERS } from "../helpers/fixtures";

describe("Tier 1 — Feature 3.2: Financial & Boarding Anomaly Detection (Happy Path)", () => {
  let harness: E2eTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  it("T1-3.2-01: detectMovingAverageZScoreAnomalies flags sudden boarding bazar spike with Z-score and CRITICAL severity", async () => {
    const mod = await loadModule<{
      detectMovingAverageZScoreAnomalies: (
        series: Array<Record<string, unknown>>,
        config?: Record<string, unknown>
      ) => Array<Record<string, unknown>>;
    }>("@/lib/anomaly-detection", ["detectMovingAverageZScoreAnomalies"]);

    const series: Array<Record<string, unknown>> = [];
    for (let day = 1; day <= 15; day++) {
      const dd = String(day).padStart(2, "0");
      series.push({
        date: `2026-10-${dd}`,
        value: 6000 + (day % 3) * 150,
        label: `বাজার ${dd}`,
      });
    }
    series.push({
      date: "2026-10-16",
      value: 18500,
      label: "অস্বাভাবিক বাজার বিল",
    });

    const anomalies = mod.detectMovingAverageZScoreAnomalies(series, {
      windowSize: 14,
      warningZScore: 2.0,
      criticalZScore: 3.0,
    });
    assert.ok(anomalies.length >= 1, "Spike day of 18,500 vs ~6,150 baseline must be flagged");
    const spike = anomalies.find(
      (a) =>
        String(a.date || a.entity_id || a.detected_date || "").includes("2026-10-16") ||
        Number(a.metricValue ?? a.metric_value ?? a.value ?? 0) === 18500
    );
    assert.ok(spike, "2026-10-16 spike entry must be present in anomalies");
    assert.equal(String(spike.severity).toUpperCase(), "CRITICAL");
    const z = Number(spike.zScore ?? spike.z_score ?? 0);
    assert.ok(z >= 3.0, `Spike Z-score must be >= 3.0, got ${z}`);
  });

  it("T1-3.2-02: detectDuplicateVouchers catches same-day duplicate expense/bazar entries while ignoring different dates", async () => {
    const mod = await loadModule<{
      detectDuplicateVouchers: (
        records: Array<Record<string, unknown>>
      ) => Array<Record<string, unknown>>;
    }>("@/lib/anomaly-detection", ["detectDuplicateVouchers"]);

    const records = [
      {
        id: "exp-dup-1",
        expense_date: "2026-11-10",
        date: "2026-11-10",
        category: "Utility",
        amount: 4500,
        description: "বিদ্যুৎ বিল অক্টোবর",
        voucher_no: "V-101",
      },
      {
        id: "exp-dup-2",
        expense_date: "2026-11-10",
        date: "2026-11-10",
        category: "Utility",
        amount: 4500,
        description: "বিদ্যুৎ বিল অক্টোবর",
        voucher_no: "V-101",
      },
      {
        id: "exp-diff-day",
        expense_date: "2026-11-11",
        date: "2026-11-11",
        category: "Utility",
        amount: 4500,
        description: "বিদ্যুৎ বিল অক্টোবর",
        voucher_no: "V-102",
      },
    ];

    const anomalies = mod.detectDuplicateVouchers(records);
    assert.equal(
      anomalies.length,
      1,
      "Exactly one same-day duplicate voucher anomaly must be detected"
    );
  });

  it("T1-3.2-03: detectExcessiveWaivers flags user exceeding waiver count/amount threshold without flagging normal approvers", async () => {
    const mod = await loadModule<{
      detectExcessiveWaivers: (
        waivers: Array<Record<string, unknown>>,
        config?: Record<string, unknown>
      ) => Array<Record<string, unknown>>;
    }>("@/lib/anomaly-detection", ["detectExcessiveWaivers"]);

    const waivers: Array<Record<string, unknown>> = [];
    for (let i = 1; i <= 10; i++) {
      waivers.push({
        id: `w-acc-${i}`,
        approved_by: USERS.accountantA.id,
        actor_name: USERS.accountantA.fullName,
        value: 2500,
        amount: 2500,
        status: "APPROVED",
        created_at: `2026-11-${String(i).padStart(2, "0")}T10:00:00Z`,
      });
    }
    waivers.push({
      id: "w-muh-1",
      approved_by: USERS.muhtamimA.id,
      actor_name: USERS.muhtamimA.fullName,
      value: 1500,
      amount: 1500,
      status: "APPROVED",
      created_at: "2026-11-05T10:00:00Z",
    });

    const flagged = mod.detectExcessiveWaivers(waivers, {
      maxCountPerUser: 5,
      maxTotalAmountPerUser: 10000,
    });
    assert.equal(flagged.length, 1, "Only accountantA exceeding threshold must be flagged");
    assert.ok(
      JSON.stringify(flagged[0]).includes(USERS.accountantA.id),
      "Flagged anomaly must identify accountantA"
    );
  });

  it("T1-3.2-04: runFinancialAnomalyScan persists anomalies AND emits immutable WARNING/CRITICAL rows in system_audit_logs", async () => {
    const svc = await loadModule<{
      runFinancialAnomalyScan: (
        madrasaId: string,
        opts?: { lookbackDays?: number }
      ) => Promise<Record<string, unknown>>;
    }>("@/lib/anomaly-detection-service", ["runFinancialAnomalyScan"]);

    // Seed duplicate same-day vouchers + bazar spike
    const bazars: Array<Record<string, unknown>> = [];
    for (let d = 1; d <= 14; d++) {
      bazars.push({
        id: `baz-norm-${d}`,
        madrasa_id: MADRASA_A_ID,
        amount: 5000 + (d % 2) * 200,
        expense_date: `2026-11-${String(d).padStart(2, "0")}`,
        items_details: "দৈনিক বাজার",
      });
    }
    bazars.push({
      id: "baz-spike-15",
      madrasa_id: MADRASA_A_ID,
      amount: 19000,
      expense_date: "2026-11-15",
      items_details: "অস্বাভাবিক বাজার",
    });
    harness.db.seed("bazar_expenses", bazars);
    harness.db.seed("expenses", [
      {
        id: "dup-e1",
        madrasa_id: MADRASA_A_ID,
        category: "Utility",
        amount: 6000,
        expense_date: "2026-11-15",
        description: "বিদ্যুৎ বিল [VOUCHER: V-999]",
      },
      {
        id: "dup-e2",
        madrasa_id: MADRASA_A_ID,
        category: "Utility",
        amount: 6000,
        expense_date: "2026-11-15",
        description: "বিদ্যুৎ বিল [VOUCHER: V-999]",
      },
    ]);

    const res = await svc.runFinancialAnomalyScan(MADRASA_A_ID, { lookbackDays: 30 });
    assert.ok(res && typeof res === "object");

    const anomalies = harness.db.getRows("financial_anomalies");
    assert.ok(anomalies.length >= 2, "Scan must persist detected bazar spike & duplicate voucher anomalies");

    await harness.flushAsync();
    const audits = harness.db.getRows(
      "system_audit_logs",
      (r) =>
        r.action === "ANOMALY_DETECTED" &&
        (r.severity === "WARNING" || r.severity === "CRITICAL")
    );
    assert.ok(
      audits.length >= 1,
      "runFinancialAnomalyScan MUST emit WARNING/CRITICAL ANOMALY_DETECTED rows into system_audit_logs"
    );

    // Verify immutability enforcement on system_audit_logs via REST PATCH
    const patchRes = await fetch(
      `${harness.supabaseUrl}/rest/v1/system_audit_logs?id=eq.${String(audits[0].id)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ severity: "INFO" }),
      }
    );
    assert.equal(patchRes.status, 400, "system_audit_logs UPDATE must be blocked by immutability");
  });

  it("T1-3.2-05: Repeated anomaly scans deduplicate open alerts and resolution writes ANOMALY_RESOLVED audit log", async () => {
    const svc = await loadModule<{
      runFinancialAnomalyScan: (madrasaId: string) => Promise<Record<string, unknown>>;
    }>("@/lib/anomaly-detection-service", ["runFinancialAnomalyScan"]);
    const postAnomalies = await loadRouteHandler("anomalies", "POST");

    harness.db.seed("expenses", [
      {
        id: "dup-a",
        madrasa_id: MADRASA_A_ID,
        category: "Maintenance",
        amount: 3200,
        expense_date: "2026-11-14",
        description: "প্লাম্বিং মেরামত",
      },
      {
        id: "dup-b",
        madrasa_id: MADRASA_A_ID,
        category: "Maintenance",
        amount: 3200,
        expense_date: "2026-11-14",
        description: "প্লাম্বিং মেরামত",
      },
    ]);

    await svc.runFinancialAnomalyScan(MADRASA_A_ID);
    const countAfterFirst = harness.db.getRows("financial_anomalies").length;
    assert.ok(countAfterFirst >= 1);

    await svc.runFinancialAnomalyScan(MADRASA_A_ID);
    const countAfterSecond = harness.db.getRows("financial_anomalies").length;
    assert.equal(
      countAfterSecond,
      countAfterFirst,
      "Consecutive scans on unchanged data must deduplicate open anomalies"
    );

    const anomalyId = String(harness.db.getRows("financial_anomalies")[0].id);
    harness.auth.asUser(USERS.muhtamimA);
    const resolveRes = await postAnomalies(
      harness.createRequest("/api/anomalies", {
        method: "POST",
        body: {
          action: "resolve",
          anomalyId,
          id: anomalyId,
          status: "RESOLVED",
          resolutionNotes: "ভাউচার যাচাই করে সমন্বয় করা হয়েছে",
        },
      })
    );
    assert.equal(resolveRes.status, 200);
    await harness.flushAsync();
    const resolvedAudits = harness.db.getRows(
      "system_audit_logs",
      (r) => r.action === "ANOMALY_RESOLVED"
    );
    assert.ok(resolvedAudits.length >= 1, "Resolving an anomaly must log ANOMALY_RESOLVED");
  });

  it("T1-3.2-06: GET /api/anomalies and POST /api/cron/anomalies execute cleanly with proper auth", async () => {
    const getAnomalies = await loadRouteHandler("anomalies", "GET");
    const cronAnomalies = await loadRouteHandler("cron/anomalies", "POST");

    harness.auth.asUser(USERS.muhtamimA);
    const getRes = await getAnomalies(
      harness.createRequest("/api/anomalies?status=OPEN", { method: "GET" })
    );
    assert.equal(getRes.status, 200);

    const cronRes = await cronAnomalies(
      harness.createRequest("/api/cron/anomalies", {
        method: "POST",
        headers: { authorization: `Bearer ${harness.cronSecret}` },
        body: {},
      })
    );
    assert.equal(cronRes.status, 200);
    const logs = harness.db.getRows("job_execution_logs");
    assert.ok(logs.length >= 1, "Anomaly cron must write job_execution_logs");
  });
});
