import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "../helpers/runner";
import { loadModule, loadRouteHandler } from "../helpers/module-loader";
import {
  createTestHarness,
  type E2eTestHarness,
} from "../helpers/test-harness";
import {
  CLASSES_A,
  MADRASA_A,
  MADRASA_A_ID,
  SESSION_A_1447,
  STUDENTS_A,
  USERS,
  ZAKAT_FUNDS_A,
  makeLargeExpenseWorkflow,
} from "../helpers/fixtures";

type AiToolMap = Record<
  string,
  { execute: (args: Record<string, unknown>) => Promise<Record<string, unknown>> }
>;

describe("Tier 1 — Feature 3.3: Voice-First Bangla AI Assistant & Action Copilot (Happy Path)", () => {
  let harness: E2eTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  async function buildPermContext(user: typeof USERS.muhtamimA) {
    harness.auth.asUser(user);
    const permsMod = await loadModule<{
      loadServerPermissions: (
        userId: string,
        madrasaId: string
      ) => Promise<Record<string, unknown> | null>;
    }>("@/lib/permissions-server", ["loadServerPermissions"]);
    const ctx = await permsMod.loadServerPermissions(user.id, user.madrasaId);
    assert.ok(ctx, "Permission context must load for authenticated fixture user");
    return ctx;
  }

  it("T1-3.3-01: getClassOverdueFees answers 'গত মাসে মিজান জামাতের কত টাকা বকেয়া আছে?' with exact due total", async () => {
    const aiMod = await loadModule<{
      createErpTools: (ctx: Record<string, unknown>) => AiToolMap;
    }>("@/lib/ai/erp-tools", ["createErpTools"]);

    harness.db.seed("classes", CLASSES_A.mizan);
    harness.db.seed("students", [
      STUDENTS_A.abdullah,
      STUDENTS_A.yusuf,
      STUDENTS_A.habibur,
    ]);
    harness.db.seed("student_fees", [
      {
        id: "sf-o1",
        madrasa_id: MADRASA_A_ID,
        session_id: SESSION_A_1447.id,
        student_id: STUDENTS_A.abdullah.id,
        student_name: "আব্দুল্লাহ আল মামুন",
        class_id: CLASSES_A.mizan.id,
        class_name: "মিজান জামাত",
        fee_type_id: "ft_monthly",
        fee_type_name: "মাসিক বেতন",
        billing_period: "2026-10",
        payable_amount: 1500,
        paid_amount: 0,
        due_amount: 1500,
        status: "UNPAID",
      },
      {
        id: "sf-o2",
        madrasa_id: MADRASA_A_ID,
        session_id: SESSION_A_1447.id,
        student_id: STUDENTS_A.yusuf.id,
        student_name: "মোহাম্মদ ইউসুফ",
        class_id: CLASSES_A.mizan.id,
        class_name: "মিজান জামাত",
        fee_type_id: "ft_monthly",
        fee_type_name: "মাসিক বেতন",
        billing_period: "2026-10",
        payable_amount: 2000,
        paid_amount: 0,
        due_amount: 2000,
        status: "OVERDUE",
      },
      {
        id: "sf-o3",
        madrasa_id: MADRASA_A_ID,
        session_id: SESSION_A_1447.id,
        student_id: STUDENTS_A.habibur.id,
        student_name: "হাবিবুর রহমান",
        class_id: CLASSES_A.mizan.id,
        class_name: "মিজান জামাত",
        fee_type_id: "ft_monthly",
        fee_type_name: "মাসিক বেতন",
        billing_period: "2026-10",
        payable_amount: 1500,
        paid_amount: 1500,
        due_amount: 0,
        status: "PAID",
      },
    ]);

    const ctx = await buildPermContext(USERS.muhtamimA);
    const tools = aiMod.createErpTools(ctx);
    assert.ok(
      tools.getClassOverdueFees,
      "[E2E_MISSING_EXPORT] createErpTools must expose getClassOverdueFees"
    );

    const res = await tools.getClassOverdueFees.execute({
      className: "মিজান জামাত",
      billingPeriod: "2026-10",
      month: "2026-10",
    });
    const totalDue = Number(
      res.totalDue ?? res.total_due ?? res.totalOverdueAmount ?? -1
    );
    assert.equal(totalDue, 3500, `Expected exact class overdue sum 3500, got ${JSON.stringify(res)}`);
  });

  it("T1-3.3-02: getTodayAbsentStudents and proposeWriteAction(send_absent_guardian_notices) require preview confirmation with 0 premature sends", async () => {
    const aiMod = await loadModule<{
      createErpTools: (ctx: Record<string, unknown>) => AiToolMap;
    }>("@/lib/ai/erp-tools", ["createErpTools"]);
    const dateUtils = await loadModule<{ toDhakaDateString: () => string }>(
      "@/lib/date-utils",
      ["toDhakaDateString"]
    );

    const today = dateUtils.toDhakaDateString();
    harness.db.seed("students", [
      STUDENTS_A.abdullah,
      STUDENTS_A.yusuf,
      STUDENTS_A.habibur,
    ]);
    harness.db.seed("attendance", [
      { id: "ta1", madrasa_id: MADRASA_A_ID, student_id: STUDENTS_A.abdullah.id, date: today, status: "Absent" },
      { id: "ta2", madrasa_id: MADRASA_A_ID, student_id: STUDENTS_A.yusuf.id, date: today, status: "Absent" },
      { id: "ta3", madrasa_id: MADRASA_A_ID, student_id: STUDENTS_A.habibur.id, date: today, status: "Present" },
    ]);

    const ctx = await buildPermContext(USERS.muhtamimA);
    const tools = aiMod.createErpTools(ctx);
    assert.ok(tools.getTodayAbsentStudents, "createErpTools must expose getTodayAbsentStudents");
    assert.ok(tools.proposeWriteAction, "createErpTools must expose proposeWriteAction");

    const absentRes = await tools.getTodayAbsentStudents.execute({});
    const absentList = (absentRes.students || absentRes.absentStudents || []) as unknown[];
    assert.equal(absentList.length, 2, "Exactly 2 absent students today must be returned");

    const proposal = await tools.proposeWriteAction.execute({
      actionType: "send_absent_guardian_notices",
      title: "আজকের অনুপস্থিত ছাত্রদের অভিভাবকদের নোটিশ পাঠাও",
      summary: "২ জন অনুপস্থিত শিক্ষার্থীর অভিভাবককে নোটিশ পাঠানো হবে",
      payload: { date: today },
    });
    assert.equal(
      proposal.requiresConfirmation,
      true,
      "proposeWriteAction MUST return requiresConfirmation: true"
    );
    assert.equal(
      harness.db.getRows("notification_queue").length,
      0,
      "proposeWriteAction MUST NOT send or enqueue notifications before confirmation"
    );
    assert.equal(
      harness.http.requests.length,
      0,
      "proposeWriteAction MUST NOT trigger outbound HTTP calls before confirmation"
    );
  });

  it("T1-3.3-03: POST /api/ai/confirm executes send_absent_guardian_notices and logs AI_ACTION_EXECUTED", async () => {
    const confirmPost = await loadRouteHandler("ai/confirm", "POST");
    const dateUtils = await loadModule<{ toDhakaDateString: () => string }>(
      "@/lib/date-utils",
      ["toDhakaDateString"]
    );

    const today = dateUtils.toDhakaDateString();
    harness.auth.asUser(USERS.muhtamimA);
    harness.db.seed("students", [STUDENTS_A.abdullah, STUDENTS_A.yusuf]);
    harness.db.seed("attendance", [
      { id: "ca1", madrasa_id: MADRASA_A_ID, student_id: STUDENTS_A.abdullah.id, date: today, status: "Absent" },
      { id: "ca2", madrasa_id: MADRASA_A_ID, student_id: STUDENTS_A.yusuf.id, date: today, status: "Present" },
    ]);

    const res = await confirmPost(
      harness.createRequest("/api/ai/confirm", {
        method: "POST",
        body: {
          actionType: "send_absent_guardian_notices",
          payload: { date: today },
        },
      })
    );
    assert.equal(res.status, 200);
    await harness.flushAsync();

    const audits = harness.db.getRows(
      "system_audit_logs",
      (r) => r.action === "AI_ACTION_EXECUTED"
    );
    assert.ok(
      audits.length >= 1,
      "Confirmed AI write action MUST write AI_ACTION_EXECUTED to system_audit_logs"
    );
  });

  it("T1-3.3-04: New Phase 3 Read tools (getEarlyWarningRisks, getFinancialAnomalies, getPendingApprovals, getExecutiveBiSummary) return domain data", async () => {
    const aiMod = await loadModule<{
      createErpTools: (ctx: Record<string, unknown>) => AiToolMap;
    }>("@/lib/ai/erp-tools", ["createErpTools"]);

    harness.db.seed("student_risk_scores", {
      id: "srs-1",
      madrasa_id: MADRASA_A_ID,
      student_id: STUDENTS_A.yusuf.id,
      composite_score: 88,
      risk_level: "CRITICAL",
    });
    harness.db.seed("financial_anomalies", {
      id: "fa-1",
      madrasa_id: MADRASA_A_ID,
      anomaly_type: "DUPLICATE_VOUCHER",
      severity: "CRITICAL",
      title: "ডুপ্লিকেট ভাউচার",
      status: "OPEN",
    });
    harness.db.seed("approval_requests", {
      id: "ar-1",
      madrasa_id: MADRASA_A_ID,
      request_type: "LARGE_EXPENSE",
      title: "জেনারেটর ক্রয়",
      amount: 55000,
      requester_id: USERS.accountantA.id,
      current_step_order: 1,
      status: "PENDING",
    });
    harness.db.seed("zakat_funds", ZAKAT_FUNDS_A);

    const ctx = await buildPermContext(USERS.muhtamimA);
    const tools = aiMod.createErpTools(ctx);

    for (const toolName of [
      "getEarlyWarningRisks",
      "getFinancialAnomalies",
      "getPendingApprovals",
      "getExecutiveBiSummary",
    ]) {
      assert.ok(
        tools[toolName],
        `[E2E_MISSING_EXPORT] createErpTools must expose ${toolName}`
      );
      const out = await tools[toolName].execute({});
      assert.ok(
        out && !out.error,
        `Tool ${toolName} should return valid data for Muhtamim: ${JSON.stringify(out)}`
      );
    }
  });

  it("T1-3.3-05: Confirmed Phase 3 write actions (trigger_risk_recalculation, trigger_anomaly_scan, submit_approval_decision) succeed and audit", async () => {
    const confirmPost = await loadRouteHandler("ai/confirm", "POST");

    harness.auth.asUser(USERS.muhtamimA);
    harness.db.seed("students", [STUDENTS_A.yusuf]);
    const wf = makeLargeExpenseWorkflow(MADRASA_A_ID);
    harness.db.seed("approval_workflows", {
      id: wf.id,
      madrasa_id: MADRASA_A_ID,
      name: wf.name,
      request_type: "LARGE_EXPENSE",
      min_amount_threshold: 10000,
      is_active: true,
    });
    harness.db.seed("approval_workflow_steps", wf.steps);
    harness.db.seed("approval_requests", {
      id: "ar-copilot-1",
      madrasa_id: MADRASA_A_ID,
      workflow_id: wf.id,
      request_type: "LARGE_EXPENSE",
      title: "সোলার প্যানেল ক্রয়",
      amount: 45000,
      requester_id: USERS.accountantA.id,
      current_step_order: 3,
      total_steps: 3,
      status: "PENDING",
    });

    for (const body of [
      { actionType: "trigger_risk_recalculation", payload: {} },
      { actionType: "trigger_anomaly_scan", payload: { lookbackDays: 30 } },
      {
        actionType: "submit_approval_decision",
        payload: {
          requestId: "ar-copilot-1",
          decision: "APPROVED",
          notes: "কোপাইলট থেকে অনুমোদিত",
        },
      },
    ]) {
      const res = await confirmPost(
        harness.createRequest("/api/ai/confirm", { method: "POST", body })
      );
      assert.equal(
        res.status,
        200,
        `Action ${body.actionType} must succeed with 200, got ${res.status}`
      );
    }

    await harness.flushAsync();
    const audits = harness.db.getRows(
      "system_audit_logs",
      (r) => r.action === "AI_ACTION_EXECUTED"
    );
    assert.ok(audits.length >= 3, "All 3 confirmed AI actions must log AI_ACTION_EXECUTED");
  });

  it("T1-3.3-06: buildSystemPrompt includes all Phase 1–3 dashboard routes and enforces confirmation before writes", async () => {
    const kb = await loadModule<{
      buildSystemPrompt: (ctx: {
        userName: string;
        role: string;
        madrasaName: string;
      }) => string;
    }>("@/lib/ai/erp-knowledge-base", ["buildSystemPrompt"]);

    const prompt = kb.buildSystemPrompt({
      userName: USERS.muhtamimA.fullName,
      role: "muhtamim",
      madrasaName: MADRASA_A.name,
    });

    for (const route of [
      "/dashboard/approvals",
      "/dashboard/settings/security",
      "/dashboard/settings/automation",
      "/dashboard/communication/orchestrator",
      "/dashboard/settings/webhooks",
      "/dashboard/analytics/executive-bi",
      "/dashboard/analytics/early-warning",
      "/dashboard/accounting/anomalies",
    ]) {
      assert.ok(
        prompt.includes(route),
        `AI knowledge base system prompt must include route "${route}"`
      );
    }
  });
});
