import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "../helpers/runner";
import { loadModule, loadRouteHandler } from "../helpers/module-loader";
import { verifySqlMigrationContract } from "../helpers/sql-verifier";
import {
  createTestHarness,
  type E2eTestHarness,
} from "../helpers/test-harness";
import {
  MADRASA_A_ID,
  MADRASA_B_ID,
  STUDENTS_A,
  USERS,
  ZAKAT_FUNDS_A,
} from "../helpers/fixtures";

describe("Tier 2 — Feature 2.3: Cross-Module Executive BI Dashboard & Scheduled Digests (Edge, Security & Negative)", () => {
  let harness: E2eTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  it("T2-2.3-01: Empty madrasa dataset returns valid zeroed BI snapshot without NaN or division-by-zero errors", async () => {
    const mod = await loadModule<{
      getExecutiveBiSnapshot: (
        madrasaId: string,
        opts?: { months?: number }
      ) => Promise<Record<string, unknown>>;
    }>("@/lib/bi/executive-bi-service", ["getExecutiveBiSnapshot"]);

    const snapshot = await mod.getExecutiveBiSnapshot(MADRASA_A_ID, { months: 6 });
    assert.ok(snapshot && typeof snapshot === "object");
    const serialized = JSON.stringify(snapshot);
    assert.ok(
      !serialized.includes("NaN") && !serialized.includes("Infinity"),
      "Empty madrasa BI snapshot must not produce NaN or Infinity"
    );
  });

  it("T2-2.3-02: executeCustomReport rejects non-whitelisted or SQL-injection dataset names", async () => {
    const mod = await loadModule<{
      executeCustomReport: (
        madrasaId: string,
        definition: Record<string, unknown>
      ) => Promise<Record<string, unknown>>;
    }>("@/lib/bi/executive-bi-service", ["executeCustomReport"]);

    await assert.rejects(
      async () => {
        await mod.executeCustomReport(MADRASA_A_ID, {
          dataset: "users; DROP TABLE students;--",
          groupBy: "role",
        });
      },
      (err: unknown) => err instanceof Error,
      "Non-whitelisted dataset must be rejected"
    );
  });

  it("T2-2.3-03: GET /api/bi/overview rejects unauthenticated (401) and unauthorized roles (403)", async () => {
    const getOverview = await loadRouteHandler("bi/overview", "GET");

    harness.auth.asAnonymous();
    const anonRes = await getOverview(
      harness.createRequest("/api/bi/overview", { method: "GET" })
    );
    assert.equal(anonRes.status, 401);

    harness.auth.asUser(USERS.studentA);
    const studentRes = await getOverview(
      harness.createRequest("/api/bi/overview", { method: "GET" })
    );
    assert.equal(studentRes.status, 403);
  });

  it("T2-2.3-04: Cross-tenant isolation ensures Madrasa B BI snapshot never includes Madrasa A funds or bazar expenses", async () => {
    const mod = await loadModule<{
      getExecutiveBiSnapshot: (
        madrasaId: string,
        opts?: { months?: number }
      ) => Promise<Record<string, unknown>>;
    }>("@/lib/bi/executive-bi-service", ["getExecutiveBiSnapshot"]);

    harness.db.seed("students", [STUDENTS_A.abdullah]);
    harness.db.seed("zakat_funds", ZAKAT_FUNDS_A);
    harness.db.seed("bazar_expenses", [
      {
        id: "baz-tenant-a-1",
        madrasa_id: MADRASA_A_ID,
        amount: 99999,
        expense_date: "2026-11-10",
        items_details: "মাদ্রাসা ক গোপন বাজার",
      },
    ]);

    const snapshotB = await mod.getExecutiveBiSnapshot(MADRASA_B_ID, { months: 6 });
    const jsonB = JSON.stringify(snapshotB);
    assert.ok(!jsonB.includes("99999"));
    assert.ok(!jsonB.includes("মাদ্রাসা ক গোপন বাজার"));
  });

  it("T2-2.3-05: GET /api/bi/digest/[id] rejects unauthenticated (401) and non-existent/cross-tenant digest (404/403)", async () => {
    const getDigest = await loadRouteHandler("bi/digest/[id]", "GET");

    harness.auth.asAnonymous();
    const anonRes = await getDigest(
      harness.createRequest("/api/bi/digest/non-existent-id", { method: "GET" }),
      { params: Promise.resolve({ id: "non-existent-id" }) }
    );
    assert.equal(anonRes.status, 401);

    harness.auth.asUser(USERS.muhtamimB);
    const missingRes = await getDigest(
      harness.createRequest("/api/bi/digest/non-existent-id", { method: "GET" }),
      { params: Promise.resolve({ id: "non-existent-id" }) }
    );
    assert.ok(missingRes.status === 404 || missingRes.status === 403);
  });

  it("T2-2.3-06: Phase 2 SQL migration defines all 4 BI Materialized Views and RPC functions", () => {
    verifySqlMigrationContract({
      filePath: "supabase_phase_2_automation_bi_migration.sql",
      tables: [{ tableName: "digest_schedules" }],
      materializedViews: [
        "mv_bi_boarding_monthly",
        "mv_bi_fund_health",
        "mv_bi_class_fee_dues",
        "mv_bi_session_exam_results",
      ],
      functions: ["get_executive_bi_snapshot"],
    });
  });
});
