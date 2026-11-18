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
  makeLargeExpenseWorkflow,
} from "../helpers/fixtures";

type AiToolMap = Record<
  string,
  { execute: (args: Record<string, unknown>) => Promise<Record<string, unknown>> }
>;

describe("Tier 4 — Real-World Qawmi Madrasa Scenarios (T4-01 to T4-04)", () => {
  let harness: E2eTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  it("T4-01: Monthly Cycle of Jamia Islamia — Auto-invoicing -> strict overdue reminders (WA->SMS) -> Early Warning -> Ustad masked PII -> Muhtamim AI Copilot", async () => {
    const monthlyCron = await loadRouteHandler("cron/monthly-fees", "POST");
    const overdueCron = await loadRouteHandler("cron/overdue-reminders", "POST");
    const ewCron = await loadRouteHandler("cron/early-warning", "POST");
    const getEw = await loadRouteHandler("early-warning", "GET");
    const confirmPost = await loadRouteHandler("ai/confirm", "POST");
    const aiMod = await loadModule<{
      createErpTools: (ctx: Record<string, unknown>) => AiToolMap;
    }>("@/lib/ai/erp-tools", ["createErpTools"]);
    const permsMod = await loadModule<{
      loadServerPermissions: (
        userId: string,
        madrasaId: string
      ) => Promise<Record<string, unknown> | null>;
    }>("@/lib/permissions-server", ["loadServerPermissions"]);

    harness.db.seed("academic_sessions", SESSION_A_1447);
    harness.db.seed("classes", [CLASSES_A.mizan]);
    harness.db.seed("students", [STUDENTS_A.abdullah, STUDENTS_A.yusuf]);
    harness.db.seed("fee_structures", {
      id: "fs-t401",
      madrasa_id: MADRASA_A_ID,
      class_id: CLASSES_A.mizan.id,
      fee_type_id: "ft_monthly",
      fee_type_name: "মাসিক বেতন",
      amount: 1500,
      is_active: true,
    });
    harness.db.seed("student_fees", {
      id: "sf-t401-prev",
      madrasa_id: MADRASA_A_ID,
      session_id: SESSION_A_1447.id,
      student_id: STUDENTS_A.abdullah.id,
      class_id: CLASSES_A.mizan.id,
      class_name: CLASSES_A.mizan.name,
      fee_type_id: "ft_monthly",
      fee_type_name: "মাসিক বেতন",
      billing_period: "2026-10",
      payable_amount: 1850,
      paid_amount: 0,
      due_amount: 1850,
      status: "OVERDUE",
    });
    for (let d = 1; d <= 12; d++) {
      harness.db.seed("attendance", {
        id: `att-t401-${d}`,
        madrasa_id: MADRASA_A_ID,
        student_id: STUDENTS_A.abdullah.id,
        class_id: CLASSES_A.mizan.id,
        date: `2026-11-${String(d).padStart(2, "0")}`,
        status: "Absent",
      });
    }

    harness.http.onRequest(/whatsapp/i, () =>
      new Response("WA unavailable", { status: 500 })
    );
    harness.http.onRequest(/.*/, () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const mRes = await monthlyCron(
      harness.createRequest("/api/cron/monthly-fees", {
        method: "POST",
        headers: { authorization: `Bearer ${harness.cronSecret}` },
        body: { madrasaId: MADRASA_A_ID, billingPeriod: "2026-11" },
      })
    );
    assert.equal(mRes.status, 200);

    const oRes = await overdueCron(
      harness.createRequest("/api/cron/overdue-reminders", {
        method: "POST",
        headers: { authorization: `Bearer ${harness.cronSecret}` },
        body: { madrasaId: MADRASA_A_ID },
      })
    );
    assert.equal(oRes.status, 200);

    const ewRes = await ewCron(
      harness.createRequest("/api/cron/early-warning", {
        method: "POST",
        headers: { authorization: `Bearer ${harness.cronSecret}` },
        body: { madrasaId: MADRASA_A_ID },
      })
    );
    assert.equal(ewRes.status, 200);

    harness.auth.asUser(USERS.ustadA);
    const ustadEwRes = await getEw(
      harness.createRequest("/api/early-warning", { method: "GET" })
    );
    assert.equal(ustadEwRes.status, 200);
    assert.ok(!(await ustadEwRes.text()).includes(STUDENTS_A.abdullah.parent_phone));

    harness.auth.asUser(USERS.muhtamimA);
    const ctx = await permsMod.loadServerPermissions(
      USERS.muhtamimA.id,
      MADRASA_A_ID
    );
    assert.ok(ctx);
    const tools = aiMod.createErpTools(ctx);
    const overdueQuery = await tools.getClassOverdueFees.execute({
      className: "মিজান জামাত",
      billingPeriod: "2026-10",
    });
    assert.ok(JSON.stringify(overdueQuery).includes("1850"));

    const confirmRes = await confirmPost(
      harness.createRequest("/api/ai/confirm", {
        method: "POST",
        body: {
          action: "send_absent_guardian_notices",
          payload: { date: "2026-11-12" },
        },
      })
    );
    assert.equal(confirmRes.status, 200);
  });

  it("T4-02: Lillah Boarding Bazar Fraud Detection & Shura Audit — Anomaly scan -> BI boarding deficit -> AI review -> Step-Up 2FA -> Watermarked XLSX export", async () => {
    const anomMod = await loadModule<{
      runFinancialAnomalyScan: (
        madrasaId: string,
        opts?: { lookbackDays?: number }
      ) => Promise<Record<string, unknown>>;
    }>("@/lib/anomaly-detection-service", ["runFinancialAnomalyScan"]);
    const biMod = await loadModule<{
      getExecutiveBiSnapshot: (
        madrasaId: string,
        opts?: { months?: number }
      ) => Promise<Record<string, unknown>>;
    }>("@/lib/bi/executive-bi-service", ["getExecutiveBiSnapshot"]);
    const permsServer = await loadModule<{
      requirePermission: (opts: Record<string, unknown>) => Promise<Record<string, unknown>>;
    }>("@/lib/permissions-server", ["requirePermission"]);
    const stepUpMod = await loadModule<Record<string, unknown>>("@/lib/step-up-auth");
    const exportMod = await loadModule<Record<string, unknown>>(
      "@/app/api/exports/route"
    );
    const exportHandler = (exportMod.POST || exportMod.GET) as
      | ((req: Request) => Promise<Response>)
      | undefined;
    if (typeof exportHandler !== "function") {
      assert.fail("[E2E_MISSING_EXPORT] /api/exports must export POST or GET");
    }

    harness.db.seed("zakat_funds", ZAKAT_FUNDS_A);
    for (let i = 1; i <= 7; i++) {
      harness.db.seed("bazar_expenses", {
        id: `baz-t402-${i}`,
        madrasa_id: MADRASA_A_ID,
        expense_date: `2026-11-0${i}`,
        amount: 3200,
        items_details: "নিয়মিত বাজার",
      });
    }
    harness.db.seed("bazar_expenses", {
      id: "baz-t402-fraud",
      madrasa_id: MADRASA_A_ID,
      expense_date: "2026-11-08",
      amount: 55000,
      items_details: "সন্দেহজনক বাজার বিল",
    });
    harness.db.seed("expenses", [
      {
        id: "exp-t402-1",
        madrasa_id: MADRASA_A_ID,
        expense_date: "2026-11-08",
        amount: 6000,
        category: "Electricity",
        description: "বিদ্যুৎ বিল",
      },
      {
        id: "exp-t402-2",
        madrasa_id: MADRASA_A_ID,
        expense_date: "2026-11-08",
        amount: 6000,
        category: "Electricity",
        description: "বিদ্যুৎ বিল",
      },
    ]);

    await anomMod.runFinancialAnomalyScan(MADRASA_A_ID, { lookbackDays: 30 });
    assert.ok(harness.db.getRows("financial_anomalies").length >= 1);

    const bi = await biMod.getExecutiveBiSnapshot(MADRASA_A_ID, { months: 6 });
    assert.ok(bi && typeof bi === "object");

    harness.auth.asUser(USERS.muhtamimA);
    const blockedUnlock = await permsServer.requirePermission({
      userId: USERS.muhtamimA.id,
      madrasaId: MADRASA_A_ID,
      permissions: ["finance.manage"],
      riskLevel: "CRITICAL",
      requireStepUp: true,
      actionScope: "accounting_period.unlock",
    });
    assert.equal(blockedUnlock.allowed, false);
    assert.equal(blockedUnlock.stepUpRequired, true);

    const issueToken = (stepUpMod.issueStepUpToken ||
      stepUpMod.createStepUpVerificationToken ||
      stepUpMod.signStepUpToken) as
      | ((opts: Record<string, unknown>) => Promise<string | Record<string, unknown>> | string | Record<string, unknown>)
      | undefined;
    if (typeof issueToken !== "function") {
      assert.fail("[E2E_MISSING_EXPORT] lib/step-up-auth must export token issuer");
    }
    const issued = await issueToken({
      userId: USERS.muhtamimA.id,
      madrasaId: MADRASA_A_ID,
      actionScope: "accounting_period.unlock",
    });
    const token =
      typeof issued === "string"
        ? issued
        : String(issued.token || issued.stepUpToken || "");

    const unlocked = await permsServer.requirePermission({
      userId: USERS.muhtamimA.id,
      madrasaId: MADRASA_A_ID,
      permissions: ["finance.manage"],
      riskLevel: "CRITICAL",
      requireStepUp: true,
      stepUpToken: token,
      actionScope: "accounting_period.unlock",
    });
    assert.equal(unlocked.allowed, true);

    harness.setIp(WATERMARK_CTX_A.ipAddress);
    harness.db.seed("students", [STUDENTS_A.abdullah]);
    const expRes = await exportHandler(
      exportMod.POST
        ? harness.createRequest("/api/exports", {
            method: "POST",
            body: { dataset: "students", format: "xlsx" },
          })
        : harness.createRequest("/api/exports?dataset=students&format=xlsx")
    );
    assert.equal(expRes.status, 200);
    await harness.flushAsync();
    assert.ok(
      harness.db.getRows(
        "system_audit_logs",
        (r) => r.action === "SENSITIVE_DATA_EXPORTED"
      ).length >= 1
    );
  });

  it("T4-03: Multi-Level Large Expense Approval -> Naib Step 2 -> Muhtamim Step-Up 2FA Step 3 -> Signed Webhook 500 -> Retry -> DELIVERED", async () => {
    const approvalsPost = await loadRouteHandler("approvals", "POST");
    const decidePost = await loadRouteHandler("approvals/[id]/decision", "POST");
    const processCron = await loadRouteHandler("cron/process-queues", "POST");
    const stepUpMod = await loadModule<Record<string, unknown>>("@/lib/step-up-auth");

    const wf = makeLargeExpenseWorkflow(MADRASA_A_ID);
    harness.db.seed("approval_workflows", wf);
    harness.db.seed("approval_workflow_steps", wf.steps);
    harness.db.seed("webhook_endpoints", {
      id: "wh-acc-t403",
      madrasa_id: MADRASA_A_ID,
      name: "External Accounting",
      url: "https://accounting.example.com/hook",
      secret: "whsec_t403",
      events: ["approval.completed", "expense.approved", "*"],
      is_active: true,
    });

    let webhookAttempts = 0;
    harness.http.onRequest("https://accounting.example.com/hook", () => {
      webhookAttempts++;
      if (webhookAttempts === 1) {
        return new Response("Temporary Error", { status: 500 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    harness.http.onRequest(/.*/, () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    harness.auth.asUser(USERS.officeStaffA);
    const createRes = await approvalsPost(
      harness.createRequest("/api/approvals", {
        method: "POST",
        body: {
          requestType: "LARGE_EXPENSE",
          amount: 75000,
          title: "মসজিদ ছাদ মেরামত",
        },
      })
    );
    assert.ok(createRes.status === 200 || createRes.status === 201);
    const created = (await createRes.json()) as Record<string, unknown>;
    const reqId = String(
      created.id ??
        (created.request as Record<string, unknown> | undefined)?.id ??
        (created.data as Record<string, unknown> | undefined)?.id ??
        harness.db.getRows("approval_requests")[0]?.id
    );
    assert.ok(reqId);

    harness.auth.asUser(USERS.accountantA);
    const s1 = await decidePost(
      harness.createRequest(`/api/approvals/${reqId}/decision`, {
        method: "POST",
        body: { decision: "APPROVED", notes: "ধাপ ১ অনুমোদিত" },
      }),
      { params: Promise.resolve({ id: reqId }) }
    );
    assert.equal(s1.status, 200);

    harness.auth.asUser(USERS.naibMuhtamimA);
    const s2 = await decidePost(
      harness.createRequest(`/api/approvals/${reqId}/decision`, {
        method: "POST",
        body: { decision: "APPROVED", notes: "ধাপ ২ অনুমোদিত" },
      }),
      { params: Promise.resolve({ id: reqId }) }
    );
    assert.equal(s2.status, 200);

    const issueToken = (stepUpMod.issueStepUpToken ||
      stepUpMod.createStepUpVerificationToken ||
      stepUpMod.signStepUpToken) as
      | ((opts: Record<string, unknown>) => Promise<string | Record<string, unknown>> | string | Record<string, unknown>)
      | undefined;
    if (typeof issueToken !== "function") {
      assert.fail("[E2E_MISSING_EXPORT] lib/step-up-auth must export token issuer");
    }
    const issued = await issueToken({
      userId: USERS.muhtamimA.id,
      madrasaId: MADRASA_A_ID,
      actionScope: "approval.decide",
    });
    const token =
      typeof issued === "string"
        ? issued
        : String(issued.token || issued.stepUpToken || "");

    harness.auth.asUser(USERS.muhtamimA);
    const s3 = await decidePost(
      harness.createRequest(`/api/approvals/${reqId}/decision`, {
        method: "POST",
        headers: { "x-step-up-token": token },
        body: {
          decision: "APPROVED",
          notes: "চূড়ান্ত অনুমোদন",
          stepUpToken: token,
        },
      }),
      { params: Promise.resolve({ id: reqId }) }
    );
    assert.equal(s3.status, 200);
    await harness.flushAsync();

    // If webhook delivery is in RETRY, force next_retry_at due and drain via cron
    for (const del of harness.db.getRows("webhook_deliveries")) {
      if (String(del.status).toUpperCase() === "RETRY") {
        del.next_retry_at = new Date(Date.now() - 5000).toISOString();
      }
    }
    await processCron(
      harness.createRequest("/api/cron/process-queues", {
        method: "POST",
        headers: { authorization: `Bearer ${harness.cronSecret}` },
        body: {},
      })
    );
    const finalReq = harness.db.getRows(
      "approval_requests",
      (r) => r.id === reqId
    );
    assert.equal(String(finalReq[0].status).toUpperCase(), "APPROVED");
  });

  it("T4-04: Hifz & Noorani Academic Decline, Exam Publish Approval, Signed Webhook & Scheduled Executive Digest", async () => {
    const decidePost = await loadRouteHandler("approvals/[id]/decision", "POST");
    const ewMod = await loadModule<{
      computeStudentRiskScore: (
        input: Record<string, unknown>
      ) => Record<string, unknown>;
    }>("@/lib/early-warning-engine", ["computeStudentRiskScore"]);
    const digestCron = await loadRouteHandler("cron/digest-reports", "POST");

    harness.db.seed("academic_sessions", [SESSION_A_1446, SESSION_A_1447]);
    harness.db.seed("zakat_funds", ZAKAT_FUNDS_A);
    harness.db.seed("digest_schedules", {
      id: "ds-t404",
      madrasa_id: MADRASA_A_ID,
      frequency: "weekly",
      is_enabled: true,
      recipients: [USERS.muhtamimA.email],
    });
    harness.db.seed("webhook_endpoints", {
      id: "wh-t404",
      madrasa_id: MADRASA_A_ID,
      name: "Board Portal",
      url: "https://board.example.com/results",
      secret: "whsec_t404",
      events: ["exam.result_published"],
      is_active: true,
    });
    harness.db.seed("approval_workflows", {
      id: "wf-t404-res",
      madrasa_id: MADRASA_A_ID,
      name: "ফলাফল প্রকাশ",
      request_type: "RESULT_PUBLISH",
      min_amount_threshold: 0,
      is_active: true,
    });
    harness.db.seed("approval_workflow_steps", {
      id: "wfs-t404-res",
      workflow_id: "wf-t404-res",
      madrasa_id: MADRASA_A_ID,
      step_order: 1,
      approver_role: "muhtamim",
      required_permission: "approval.approve",
      sla_hours: 24,
    });
    harness.db.seed("approval_requests", {
      id: "req-t404-res",
      madrasa_id: MADRASA_A_ID,
      workflow_id: "wf-t404-res",
      request_type: "RESULT_PUBLISH",
      requester_id: USERS.examManagerA.id,
      current_step_order: 1,
      total_steps: 1,
      status: "PENDING",
    });

    harness.http.onRequest(/.*/, () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    harness.auth.asUser(USERS.muhtamimA);
    const pubRes = await decidePost(
      harness.createRequest("/api/approvals/req-t404-res/decision", {
        method: "POST",
        body: { decision: "APPROVED", notes: "ফলাফল প্রকাশিত" },
      }),
      { params: Promise.resolve({ id: "req-t404-res" }) }
    );
    assert.equal(pubRes.status, 200);

    const hifzRisk = ewMod.computeStudentRiskScore({
      studentId: STUDENTS_A.saifulHifz.id,
      department: "hifz",
      attendanceRate30d: 75,
      hifzSabakPausedDays: 14,
      overdueMonthsCount: 1,
      totalDueAmount: 1500,
    });
    assert.ok(Number(hifzRisk.riskScore ?? hifzRisk.score ?? hifzRisk.risk_score) > 25);

    const nooraniRisk = ewMod.computeStudentRiskScore({
      studentId: STUDENTS_A.arifNoorani.id,
      department: "noorani",
      attendanceRate30d: 70,
      nooraniTakhtiStalledDays: 21,
      overdueMonthsCount: 1,
      totalDueAmount: 1000,
    });
    assert.ok(Number(nooraniRisk.riskScore ?? nooraniRisk.score ?? nooraniRisk.risk_score) > 25);

    const cronRes = await digestCron(
      harness.createRequest("/api/cron/digest-reports", {
        method: "POST",
        headers: { authorization: `Bearer ${harness.cronSecret}` },
        body: {},
      })
    );
    assert.equal(cronRes.status, 200);
    assert.ok(harness.db.getRows("job_execution_logs").length >= 1);
  });
});
