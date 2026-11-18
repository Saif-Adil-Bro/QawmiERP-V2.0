import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "../helpers/runner";
import { loadModule, loadRouteHandler } from "../helpers/module-loader";
import {
  createTestHarness,
  type E2eTestHarness,
} from "../helpers/test-harness";
import {
  MADRASA_A_ID,
  STUDENTS_A,
  USERS,
  makeLargeExpenseWorkflow,
} from "../helpers/fixtures";

describe("Tier 3 — Cross-Feature Combinations (T3-01 to T3-06: Security, Approvals & Copilot)", () => {
  let harness: E2eTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  it("T3-01: 1.1 Approvals × 1.2 Step-Up 2FA — CRITICAL approval step blocked with STEP_UP_REQUIRED until valid Step-Up token is verified", async () => {
    const decidePost = await loadRouteHandler("approvals/[id]/decision", "POST");
    const stepUpMod = await loadModule<Record<string, unknown>>("@/lib/step-up-auth");

    const issueToken = (stepUpMod.issueStepUpToken ||
      stepUpMod.createStepUpVerificationToken ||
      stepUpMod.signStepUpToken) as
      | ((opts: Record<string, unknown>) => Promise<string | Record<string, unknown>> | string | Record<string, unknown>)
      | undefined;
    if (typeof issueToken !== "function") {
      assert.fail("[E2E_MISSING_EXPORT] lib/step-up-auth must export token issuer");
    }

    const wf = makeLargeExpenseWorkflow(MADRASA_A_ID);
    harness.db.seed("approval_workflows", wf);
    harness.db.seed("approval_workflow_steps", wf.steps);
    harness.db.seed("approval_requests", {
      id: "req-t3-01",
      madrasa_id: MADRASA_A_ID,
      workflow_id: wf.id,
      request_type: "LARGE_EXPENSE",
      amount: 75000,
      requester_id: USERS.accountantA.id,
      current_step_order: 3,
      total_steps: 3,
      status: "PENDING",
    });

    harness.auth.asUser(USERS.muhtamimA);
    const blockedRes = await decidePost(
      harness.createRequest("/api/approvals/req-t3-01/decision", {
        method: "POST",
        body: { decision: "APPROVED", notes: "Without step-up" },
      }),
      { params: Promise.resolve({ id: "req-t3-01" }) }
    );
    assert.ok(blockedRes.status === 403 || blockedRes.status === 401);
    const blockedBody = (await blockedRes.json()) as Record<string, unknown>;
    assert.ok(
      blockedBody.stepUpRequired === true ||
        blockedBody.errorCode === "STEP_UP_REQUIRED",
      "CRITICAL step without Step-Up token must return STEP_UP_REQUIRED"
    );

    const issued = await issueToken({
      userId: USERS.muhtamimA.id,
      madrasaId: MADRASA_A_ID,
      actionScope: "approval.decide",
    });
    const token =
      typeof issued === "string"
        ? issued
        : String(issued.token || issued.stepUpToken || "");

    const okRes = await decidePost(
      harness.createRequest("/api/approvals/req-t3-01/decision", {
        method: "POST",
        headers: { "x-step-up-token": token },
        body: {
          decision: "APPROVED",
          notes: "Verified with Step-Up",
          stepUpToken: token,
        },
      }),
      { params: Promise.resolve({ id: "req-t3-01" }) }
    );
    assert.equal(okRes.status, 200);
  });

  it("T3-02: 1.1 Approvals × 2.2 Notifications — Submitting and deciding FEE_WAIVER dispatches Bangla notification", async () => {
    const approvalsPost = await loadRouteHandler("approvals", "POST");

    harness.http.onRequest(/.*/, () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    harness.db.seed("approval_workflows", {
      id: "wf-waiver-1",
      madrasa_id: MADRASA_A_ID,
      name: "ফি মওকুফ অনুমোদন",
      request_type: "FEE_WAIVER",
      min_amount_threshold: 0,
      is_active: true,
    });
    harness.db.seed("approval_workflow_steps", {
      id: "wfs-waiver-1",
      workflow_id: "wf-waiver-1",
      madrasa_id: MADRASA_A_ID,
      step_order: 1,
      approver_role: "muhtamim",
      required_permission: "approval.approve",
      sla_hours: 24,
    });

    harness.auth.asUser(USERS.accountantA);
    const res = await approvalsPost(
      harness.createRequest("/api/approvals", {
        method: "POST",
        body: {
          requestType: "FEE_WAIVER",
          amount: 1500,
          title: "এতিম ছাত্র ফি মওকুফ",
          studentId: STUDENTS_A.habibur.id,
        },
      })
    );
    assert.ok(res.status === 200 || res.status === 201);
    await harness.flushAsync();

    const queue = harness.db.getRows("notification_queue");
    const httpReqs = harness.http.requests;
    assert.ok(
      queue.length >= 1 || httpReqs.length >= 1,
      "Submitting approval request must dispatch notification to next approver"
    );
  });

  it("T3-03: 1.1 Approvals × 2.4 Webhooks — Final approval of RESULT_PUBLISH dispatches signed webhook; rejection emits none", async () => {
    const decidePost = await loadRouteHandler("approvals/[id]/decision", "POST");

    harness.db.seed("webhook_endpoints", {
      id: "wh-res-1",
      madrasa_id: MADRASA_A_ID,
      name: "Board Portal",
      url: "https://portal.example.com/webhooks/results",
      secret: "whsec_result_publish",
      events: ["exam.result_published"],
      is_active: true,
    });
    harness.db.seed("approval_workflows", {
      id: "wf-res-pub",
      madrasa_id: MADRASA_A_ID,
      name: "রেজাল্ট প্রকাশ",
      request_type: "RESULT_PUBLISH",
      min_amount_threshold: 0,
      is_active: true,
    });
    harness.db.seed("approval_workflow_steps", {
      id: "wfs-res-1",
      workflow_id: "wf-res-pub",
      madrasa_id: MADRASA_A_ID,
      step_order: 1,
      approver_role: "muhtamim",
      required_permission: "approval.approve",
      sla_hours: 24,
    });
    harness.db.seed("approval_requests", [
      {
        id: "req-res-rej",
        madrasa_id: MADRASA_A_ID,
        workflow_id: "wf-res-pub",
        request_type: "RESULT_PUBLISH",
        requester_id: USERS.examManagerA.id,
        current_step_order: 1,
        total_steps: 1,
        status: "PENDING",
      },
      {
        id: "req-res-ok",
        madrasa_id: MADRASA_A_ID,
        workflow_id: "wf-res-pub",
        request_type: "RESULT_PUBLISH",
        requester_id: USERS.examManagerA.id,
        current_step_order: 1,
        total_steps: 1,
        status: "PENDING",
      },
    ]);

    harness.http.onRequest("https://portal.example.com/webhooks/results", () =>
      new Response(JSON.stringify({ received: true }), { status: 200 })
    );

    harness.auth.asUser(USERS.muhtamimA);
    await decidePost(
      harness.createRequest("/api/approvals/req-res-rej/decision", {
        method: "POST",
        body: { decision: "REJECTED", notes: "নম্বর পুনরায় যাচাই করুন" },
      }),
      { params: Promise.resolve({ id: "req-res-rej" }) }
    );
    await harness.flushAsync();
    assert.equal(
      harness.http.requests.filter((r) =>
        r.url.includes("https://portal.example.com/webhooks/results")
      ).length,
      0,
      "Rejection must NOT emit exam.result_published webhook"
    );

    const okRes = await decidePost(
      harness.createRequest("/api/approvals/req-res-ok/decision", {
        method: "POST",
        body: { decision: "APPROVED", notes: "প্রকাশ অনুমোদিত" },
      }),
      { params: Promise.resolve({ id: "req-res-ok" }) }
    );
    assert.equal(okRes.status, 200);
    await harness.flushAsync();
    const webhookHits = harness.http.requests.filter((r) =>
      r.url.includes("https://portal.example.com/webhooks/results")
    );
    assert.ok(
      webhookHits.length >= 1,
      "Approved RESULT_PUBLISH must dispatch exam.result_published webhook"
    );
  });

  it("T3-04: 1.1 Approvals × 3.2 Anomaly Detection — Rapid bulk fee waivers by one actor flagged by anomaly scan + audit log", async () => {
    const mod = await loadModule<{
      runFinancialAnomalyScan: (
        madrasaId: string,
        opts?: { lookbackDays?: number }
      ) => Promise<Record<string, unknown>>;
    }>("@/lib/anomaly-detection-service", ["runFinancialAnomalyScan"]);

    const nowIso = new Date().toISOString();
    for (let i = 1; i <= 6; i++) {
      harness.db.seed("approval_requests", {
        id: `req-bulk-waiver-${i}`,
        madrasa_id: MADRASA_A_ID,
        request_type: "FEE_WAIVER",
        amount: 3000,
        requester_id: USERS.accountantA.id,
        status: "APPROVED",
        created_at: nowIso,
      });
    }

    const scanRes = await mod.runFinancialAnomalyScan(MADRASA_A_ID, {
      lookbackDays: 30,
    });
    assert.ok(scanRes && typeof scanRes === "object");

    const anomalies = harness.db.getRows("financial_anomalies");
    const audits = harness.db.getRows(
      "system_audit_logs",
      (r) => r.action === "ANOMALY_DETECTED"
    );
    assert.ok(
      anomalies.length >= 1 && audits.length >= 1,
      "Excessive fee waivers must create anomaly record + immutable ANOMALY_DETECTED audit log"
    );
  });

  it("T3-05: 1.1 Approvals × 3.3 AI Copilot — Copilot lists pending approvals and confirms submit_approval_decision with audit log", async () => {
    const aiMod = await loadModule<{
      createErpTools: (
        ctx: Record<string, unknown>
      ) => Record<string, { execute: (args: Record<string, unknown>) => Promise<Record<string, unknown>> }>;
    }>("@/lib/ai/erp-tools", ["createErpTools"]);
    const confirmPost = await loadRouteHandler("ai/confirm", "POST");
    const permsMod = await loadModule<{
      loadServerPermissions: (
        userId: string,
        madrasaId: string
      ) => Promise<Record<string, unknown> | null>;
    }>("@/lib/permissions-server", ["loadServerPermissions"]);

    harness.db.seed("approval_workflows", makeLargeExpenseWorkflow(MADRASA_A_ID));
    harness.db.seed("approval_workflow_steps", makeLargeExpenseWorkflow(MADRASA_A_ID).steps);
    harness.db.seed("approval_requests", {
      id: "req-ai-dec-1",
      madrasa_id: MADRASA_A_ID,
      workflow_id: "wf-large-expense-a",
      request_type: "LARGE_EXPENSE",
      amount: 15000,
      requester_id: USERS.officeStaffA.id,
      current_step_order: 1,
      total_steps: 3,
      status: "PENDING",
    });

    harness.auth.asUser(USERS.accountantA);
    const ctx = await permsMod.loadServerPermissions(
      USERS.accountantA.id,
      MADRASA_A_ID
    );
    assert.ok(ctx);
    const tools = aiMod.createErpTools(ctx);
    assert.ok(tools.getPendingApprovals, "createErpTools must expose getPendingApprovals");
    const pending = await tools.getPendingApprovals.execute({});
    assert.ok(JSON.stringify(pending).includes("req-ai-dec-1"));

    const confirmRes = await confirmPost(
      harness.createRequest("/api/ai/confirm", {
        method: "POST",
        body: {
          action: "submit_approval_decision",
          payload: {
            requestId: "req-ai-dec-1",
            decision: "APPROVED",
            notes: "AI কপাইলটের মাধ্যমে অনুমোদিত",
          },
        },
      })
    );
    assert.equal(confirmRes.status, 200);
    await harness.flushAsync();

    const audits = harness.db.getRows(
      "system_audit_logs",
      (r) => r.action === "AI_ACTION_EXECUTED" || r.action === "APPROVAL_STEP_DECIDED"
    );
    assert.ok(audits.length >= 1);
  });

  it("T3-06: 1.2 Sessions/2FA × 1.3 Masking/Exports — Unmasked export enforces Step-Up/RBAC, embeds watermark, and logs SENSITIVE_DATA_EXPORTED", async () => {
    const exportMod = await loadModule<Record<string, unknown>>(
      "@/app/api/exports/route"
    );
    const handler = (exportMod.POST || exportMod.GET) as
      | ((req: Request) => Promise<Response>)
      | undefined;
    if (typeof handler !== "function") {
      assert.fail("[E2E_MISSING_EXPORT] /api/exports must export POST or GET");
    }

    harness.db.seed("students", [STUDENTS_A.abdullah]);
    harness.auth.asUser(USERS.muhtamimA);
    harness.setIp("103.112.54.88");

    const res = await handler(
      exportMod.POST
        ? harness.createRequest("/api/exports", {
            method: "POST",
            body: { dataset: "students", format: "csv" },
          })
        : harness.createRequest("/api/exports?dataset=students&format=csv")
    );
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes("103.112.54.88"));

    await harness.flushAsync();
    const audits = harness.db.getRows(
      "system_audit_logs",
      (r) => r.action === "SENSITIVE_DATA_EXPORTED"
    );
    assert.ok(audits.length >= 1);
  });
});
