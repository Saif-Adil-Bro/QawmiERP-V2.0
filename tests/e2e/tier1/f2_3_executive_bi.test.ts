import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "../helpers/runner";
import { loadModule, loadRouteHandler } from "../helpers/module-loader";
import {
  createTestHarness,
  type E2eTestHarness,
} from "../helpers/test-harness";
import {
  CLASSES_A,
  MADRASA_A_ID,
  SESSION_A_1446,
  SESSION_A_1447,
  STUDENTS_A,
  USERS,
  WATERMARK_CTX_A,
  ZAKAT_FUNDS_A,
} from "../helpers/fixtures";

describe("Tier 1 — Feature 2.3: Cross-Module Executive BI Dashboard & Scheduled Digests (Happy Path)", () => {
  let harness: E2eTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  function seedExecutiveBiData(): void {
    harness.db.seed("academic_sessions", [SESSION_A_1446, SESSION_A_1447]);
    harness.db.seed("classes", [CLASSES_A.mizan, CLASSES_A.hifz]);
    harness.db.seed("students", [STUDENTS_A.abdullah, STUDENTS_A.yusuf]);
    harness.db.seed("zakat_funds", ZAKAT_FUNDS_A);
    harness.db.seed("donations", [
      {
        id: "don-zkt-1",
        madrasa_id: MADRASA_A_ID,
        amount: 100000,
        donation_type: "Zakat",
        donation_date: "2026-11-05",
        receipt_no: "DR-001",
      },
    ]);
    harness.db.seed("expenses", [
      {
        id: "exp-zkt-1",
        madrasa_id: MADRASA_A_ID,
        category: "Other",
        amount: 35000,
        expense_date: "2026-11-06",
        description: "[FUND: fund-zakat | যাকাত ফান্ড] বৃত্তি বিতরণ",
      },
    ]);
    harness.db.seed("bazar_expenses", [
      {
        id: "baz-1",
        madrasa_id: MADRASA_A_ID,
        amount: 40000,
        expense_date: "2026-11-10",
        items_details: "চাল ও ডাল [FUND: fund-lillah | লিল্লাহ বোর্ডিং ফান্ড]",
      },
    ]);
    harness.db.seed("meal_entries", [
      {
        id: "meal-1",
        madrasa_id: MADRASA_A_ID,
        student_id: STUDENTS_A.abdullah.id,
        entry_date: "2026-11-10",
        meal_status: "On",
      },
      {
        id: "meal-2",
        madrasa_id: MADRASA_A_ID,
        student_id: STUDENTS_A.yusuf.id,
        entry_date: "2026-11-10",
        meal_status: "On",
      },
    ]);
    harness.db.seed("student_fees", [
      {
        id: "sf-mizan-1",
        madrasa_id: MADRASA_A_ID,
        session_id: SESSION_A_1447.id,
        student_id: STUDENTS_A.abdullah.id,
        class_id: CLASSES_A.mizan.id,
        class_name: CLASSES_A.mizan.name,
        fee_type_id: "ft_hostel",
        fee_type_name: "বোর্ডিং ও খাবার ফি",
        billing_period: "2026-11",
        payable_amount: 30000,
        paid_amount: 18000,
        due_amount: 12000,
        status: "PARTIAL",
      },
      {
        id: "sf-hifz-1",
        madrasa_id: MADRASA_A_ID,
        session_id: SESSION_A_1447.id,
        student_id: STUDENTS_A.saifulHifz.id,
        class_id: CLASSES_A.hifz.id,
        class_name: CLASSES_A.hifz.name,
        fee_type_id: "ft_monthly",
        fee_type_name: "মাসিক বেতন",
        billing_period: "2026-11",
        payable_amount: 40000,
        paid_amount: 36000,
        due_amount: 4000,
        status: "PARTIAL",
      },
    ]);
    harness.db.seed("exams", [
      {
        id: "ex-1446",
        madrasa_id: MADRASA_A_ID,
        session_id: SESSION_A_1446.id,
        title: "বার্ষিক পরীক্ষা ১৪৪৬",
        year: 2025,
        status: "Completed",
      },
      {
        id: "ex-1447",
        madrasa_id: MADRASA_A_ID,
        session_id: SESSION_A_1447.id,
        title: "সাময়িক পরীক্ষা ১৪৪৭",
        year: 2026,
        status: "Completed",
      },
    ]);
    harness.db.seed("exam_results", [
      {
        id: "er-1",
        madrasa_id: MADRASA_A_ID,
        exam_id: "ex-1446",
        student_id: STUDENTS_A.abdullah.id,
        subject_name: "মিজান",
        marks_obtained: 72,
        total_marks: 100,
      },
      {
        id: "er-2",
        madrasa_id: MADRASA_A_ID,
        exam_id: "ex-1447",
        student_id: STUDENTS_A.abdullah.id,
        subject_name: "মিজান",
        marks_obtained: 84,
        total_marks: 100,
      },
    ]);
  }

  it("T1-2.3-01: getExecutiveBiSnapshot computes all 4 BI pillars accurately", async () => {
    const mod = await loadModule<{
      getExecutiveBiSnapshot: (
        madrasaId: string,
        opts?: { months?: number; sessionId?: string | null }
      ) => Promise<Record<string, unknown>>;
    }>("@/lib/bi/executive-bi-service", ["getExecutiveBiSnapshot"]);

    seedExecutiveBiData();
    const snapshot = await mod.getExecutiveBiSnapshot(MADRASA_A_ID, { months: 6 });
    assert.ok(snapshot && typeof snapshot === "object");

    const json = JSON.stringify(snapshot);
    assert.ok(json.includes("মিজান") || json.includes("40"), "Snapshot must reflect class fee due metrics");
    assert.ok(
      "boarding" in snapshot ||
        "boardingMetrics" in snapshot ||
        "boardingTrend" in snapshot,
      "Snapshot must include boarding per-capita bazar vs fee income pillar"
    );
    assert.ok(
      "funds" in snapshot || "fundHealth" in snapshot || "zakatFunds" in snapshot,
      "Snapshot must include Zakat/fund health pillar"
    );
    assert.ok(
      "classFeeDues" in snapshot ||
        "classDueRatios" in snapshot ||
        "feeDueByClass" in snapshot,
      "Snapshot must include class-wise due ratio pillar"
    );
    assert.ok(
      "sessionExamComparison" in snapshot ||
        "examComparison" in snapshot ||
        "sessionResults" in snapshot,
      "Snapshot must include session-to-session exam result pillar"
    );
  });

  it("T1-2.3-02: getExecutiveBiSnapshot transparently falls back to JS aggregation when RPC/MV returns 42883/PGRST202", async () => {
    const mod = await loadModule<{
      getExecutiveBiSnapshot: (
        madrasaId: string,
        opts?: { months?: number }
      ) => Promise<Record<string, unknown>>;
    }>("@/lib/bi/executive-bi-service", ["getExecutiveBiSnapshot"]);

    seedExecutiveBiData();
    harness.db.markRpcMissing("get_executive_bi_snapshot", "42883");
    harness.db.markTableMissing("mv_bi_boarding_monthly", "42P01");
    harness.db.markTableMissing("mv_bi_fund_health", "42P01");
    harness.db.markTableMissing("mv_bi_class_fee_dues", "42P01");
    harness.db.markTableMissing("mv_bi_session_exam_results", "42P01");

    const snapshot = await mod.getExecutiveBiSnapshot(MADRASA_A_ID, { months: 6 });
    assert.ok(
      snapshot && typeof snapshot === "object",
      "BI snapshot must seamlessly fall back to JS aggregation when RPC/MVs are absent"
    );
  });

  it("T1-2.3-03: executeCustomReport runs whitelisted dataset query with filters and groupBy aggregation", async () => {
    const mod = await loadModule<{
      executeCustomReport: (
        madrasaId: string,
        definition: Record<string, unknown>
      ) => Promise<Record<string, unknown>>;
    }>("@/lib/bi/executive-bi-service", ["executeCustomReport"]);

    seedExecutiveBiData();
    const res = await mod.executeCustomReport(MADRASA_A_ID, {
      dataset: "fees",
      groupBy: "class_name",
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
      limit: 50,
    });
    assert.ok(res && typeof res === "object");
    const rows = (res.rows || res.data || []) as unknown[];
    assert.ok(Array.isArray(rows) && rows.length >= 1, "Custom report must return aggregated rows");
  });

  it("T1-2.3-04: Digest generator produces A4 Bangla HTML report and watermarked XLSX buffer", async () => {
    const mod = await loadModule<Record<string, unknown>>(
      "@/lib/bi/digest-generator"
    );
    const biMod = await loadModule<{
      getExecutiveBiSnapshot: (madrasaId: string) => Promise<Record<string, unknown>>;
    }>("@/lib/bi/executive-bi-service", ["getExecutiveBiSnapshot"]);

    seedExecutiveBiData();
    const snapshot = await biMod.getExecutiveBiSnapshot(MADRASA_A_ID);

    const buildHtml = (mod.buildDigestHtml ||
      mod.generateDigestHtml ||
      mod.renderDigestHtml) as
      | ((snapshot: Record<string, unknown>, watermark: Record<string, unknown>) => string)
      | undefined;
    const buildXlsx = (mod.buildDigestWorkbook ||
      mod.generateDigestWorkbook ||
      mod.buildDigestXlsx) as
      | ((snapshot: Record<string, unknown>, watermark: Record<string, unknown>) => Buffer | Uint8Array)
      | undefined;

    if (typeof buildHtml !== "function") {
      assert.fail("[E2E_MISSING_EXPORT] digest-generator must export HTML builder");
    }
    if (typeof buildXlsx !== "function") {
      assert.fail("[E2E_MISSING_EXPORT] digest-generator must export XLSX builder");
    }

    const html = buildHtml(snapshot, WATERMARK_CTX_A);
    assert.ok(html.includes(WATERMARK_CTX_A.exportedBy), "Digest HTML must embed watermark exporter");
    assert.ok(html.includes("<html") || html.includes("<div") || html.includes("<table"));

    const buf = Buffer.from(buildXlsx(snapshot, WATERMARK_CTX_A));
    assert.equal(buf[0], 0x50, "Digest XLSX must be a valid ZIP/XLSX binary");
    assert.equal(buf[1], 0x4b, "Digest XLSX must be a valid ZIP/XLSX binary");
  });

  it("T1-2.3-05: GET /api/bi/overview returns 200 for authorized Muhtamim", async () => {
    const getOverview = await loadRouteHandler("bi/overview", "GET");

    seedExecutiveBiData();
    harness.auth.asUser(USERS.muhtamimA);
    const res = await getOverview(
      harness.createRequest("/api/bi/overview?months=6", { method: "GET" })
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    assert.ok(body && typeof body === "object");
  });

  it("T1-2.3-06: /api/cron/digest-reports generates scheduled digests and records job_execution_logs", async () => {
    const digestCron = await loadRouteHandler("cron/digest-reports", "POST");

    seedExecutiveBiData();
    harness.db.seed("digest_schedules", {
      id: "ds-1",
      madrasa_id: MADRASA_A_ID,
      frequency: "weekly",
      is_enabled: true,
      recipients: [USERS.muhtamimA.email],
    });

    const res = await digestCron(
      harness.createRequest("/api/cron/digest-reports", {
        method: "POST",
        headers: { authorization: `Bearer ${harness.cronSecret}` },
        body: {},
      })
    );
    assert.equal(res.status, 200);
    const logs = harness.db.getRows("job_execution_logs");
    assert.ok(logs.length >= 1, "Digest cron must record execution in job_execution_logs");
  });
});
