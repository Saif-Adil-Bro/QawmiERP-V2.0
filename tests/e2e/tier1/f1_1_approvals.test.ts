import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "../helpers/runner";
import {
  loadModule,
  loadAction,
  loadRouteHandler,
} from "../helpers/module-loader";
import {
  createTestHarness,
  type E2eTestHarness,
} from "../helpers/test-harness";
import {
  MADRASA_A_ID,
  USERS,
  makeLargeExpenseWorkflow,
} from "../helpers/fixtures";

describe("Tier 1 — Feature 1.1: Multi-Level Approval Workflow Engine (Happy Path)", () => {
  let harness: E2eTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  it("T1-1.1-01: matchApprovalWorkflow selects highest-matching active threshold tier and returns null below threshold", async () => {
    const mod = await loadModule<{
      matchApprovalWorkflow: (
        workflows: unknown[],
        requestType: string,
        amount: number
      ) => Record<string, unknown> | null;
    }>("@/lib/approval-workflow", ["matchApprovalWorkflow"]);

    const tier10k = makeLargeExpenseWorkflow(MADRASA_A_ID);
    const tier50k = {
      ...makeLargeExpenseWorkflow(MADRASA_A_ID),
      id: "wf-large-expense-50k",
      name: "অতি বড় খরচ অনুমোদন (৫০,০০০+)",
      min_amount_threshold: 50000,
      threshold_amount: 50000,
    };
    const inactiveTier = {
      ...makeLargeExpenseWorkflow(MADRASA_A_ID),
      id: "wf-inactive",
      min_amount_threshold: 5000,
      threshold_amount: 5000,
      is_active: false,
    };

    const matched25k = mod.matchApprovalWorkflow(
      [tier10k, tier50k, inactiveTier],
      "LARGE_EXPENSE",
      25000
    );
    assert.ok(matched25k, "25,000 BDT should match the 10,000 threshold workflow");
    assert.equal(matched25k.id, tier10k.id);

    const matched75k = mod.matchApprovalWorkflow(
      [tier10k, tier50k, inactiveTier],
      "LARGE_EXPENSE",
      75000
    );
    assert.ok(matched75k, "75,000 BDT should match the 50,000 threshold workflow");
    assert.equal(matched75k.id, tier50k.id);

    const belowThreshold = mod.matchApprovalWorkflow(
      [tier10k, tier50k, inactiveTier],
      "LARGE_EXPENSE",
      3000
    );
    assert.equal(
      belowThreshold,
      null,
      "Amount below all active thresholds must return null"
    );
  });

  it("T1-1.1-02: Multi-step progression advances Accountant -> Naib Muhtamim -> Muhtamim and finalizes APPROVED", async () => {
    const mod = await loadModule<{
      evaluateStepProgression: (
        request: Record<string, unknown>,
        steps: Record<string, unknown>[],
        decisions: Record<string, unknown>[],
        decisionInput: Record<string, unknown>
      ) => Record<string, unknown>;
    }>("@/lib/approval-workflow", ["evaluateStepProgression"]);

    const wf = makeLargeExpenseWorkflow(MADRASA_A_ID);
    const request: Record<string, unknown> = {
      id: "req-multi-001",
      madrasa_id: MADRASA_A_ID,
      workflow_id: wf.id,
      request_type: "LARGE_EXPENSE",
      amount: 25000,
      requester_id: USERS.officeStaffA.id,
      current_step_order: 1,
      total_steps: 3,
      status: "PENDING",
    };

    const step1Res = mod.evaluateStepProgression(request, wf.steps, [], {
      decision: "APPROVED",
      actorId: USERS.accountantA.id,
      notes: "হিসাব যাচাই সম্পন্ন",
    });
    const nextAfter1 =
      (step1Res.nextStepOrder as number | undefined) ??
      (step1Res.next_step_order as number | undefined);
    const statusAfter1 = String(
      step1Res.nextStatus ?? step1Res.status ?? ""
    ).toUpperCase();
    assert.equal(nextAfter1, 2);
    assert.equal(statusAfter1, "PENDING");

    const step2Req = { ...request, current_step_order: 2 };
    const step2Res = mod.evaluateStepProgression(
      step2Req,
      wf.steps,
      [{ step_order: 1, decision: "APPROVED", actor_id: USERS.accountantA.id }],
      {
        decision: "APPROVED",
        actorId: USERS.naibMuhtamimA.id,
        notes: "নায়েবে মুহতামিম সুপারিশ",
      }
    );
    const nextAfter2 =
      (step2Res.nextStepOrder as number | undefined) ??
      (step2Res.next_step_order as number | undefined);
    const statusAfter2 = String(
      step2Res.nextStatus ?? step2Res.status ?? ""
    ).toUpperCase();
    assert.equal(nextAfter2, 3);
    assert.equal(statusAfter2, "PENDING");

    const step3Req = { ...request, current_step_order: 3 };
    const step3Res = mod.evaluateStepProgression(
      step3Req,
      wf.steps,
      [
        { step_order: 1, decision: "APPROVED", actor_id: USERS.accountantA.id },
        { step_order: 2, decision: "APPROVED", actor_id: USERS.naibMuhtamimA.id },
      ],
      {
        decision: "APPROVED",
        actorId: USERS.muhtamimA.id,
        notes: "চূড়ান্ত অনুমোদন",
      }
    );
    const statusAfter3 = String(
      step3Res.nextStatus ?? step3Res.status ?? ""
    ).toUpperCase();
    assert.equal(statusAfter3, "APPROVED");
  });

  it("T1-1.1-03: Rejection at intermediate step immediately short-circuits request to REJECTED", async () => {
    const mod = await loadModule<{
      evaluateStepProgression: (
        request: Record<string, unknown>,
        steps: Record<string, unknown>[],
        decisions: Record<string, unknown>[],
        decisionInput: Record<string, unknown>
      ) => Record<string, unknown>;
    }>("@/lib/approval-workflow", ["evaluateStepProgression"]);

    const wf = makeLargeExpenseWorkflow(MADRASA_A_ID);
    const request = {
      id: "req-reject-001",
      madrasa_id: MADRASA_A_ID,
      workflow_id: wf.id,
      request_type: "LARGE_EXPENSE",
      amount: 30000,
      requester_id: USERS.officeStaffA.id,
      current_step_order: 2,
      total_steps: 3,
      status: "PENDING",
    };

    const res = mod.evaluateStepProgression(
      request,
      wf.steps,
      [{ step_order: 1, decision: "APPROVED", actor_id: USERS.accountantA.id }],
      {
        decision: "REJECTED",
        actorId: USERS.naibMuhtamimA.id,
        notes: "বাজেট বরাদ্দ অপর্যাপ্ত",
      }
    );

    const finalStatus = String(res.nextStatus ?? res.status ?? "").toUpperCase();
    assert.equal(
      finalStatus,
      "REJECTED",
      "Intermediate rejection must immediately transition request to REJECTED"
    );
  });

  it("T1-1.1-04: SLA deadline calculation and breach detection work accurately", async () => {
    const mod = await loadModule<{
      calculateSlaDueAt: (fromDate: Date, slaHours: number) => string;
      isSlaBreached: (slaDueAt: string | null, now?: Date) => boolean;
    }>("@/lib/approval-workflow", ["calculateSlaDueAt", "isSlaBreached"]);

    const start = new Date("2026-11-18T06:00:00.000Z");
    const dueAt = mod.calculateSlaDueAt(start, 24);
    assert.equal(
      new Date(dueAt).toISOString(),
      "2026-11-19T06:00:00.000Z",
      "24h SLA must equal exact +24 hours ISO timestamp"
    );

    assert.equal(
      mod.isSlaBreached(dueAt, new Date("2026-11-19T05:59:59.000Z")),
      false,
      "Before SLA deadline must not be breached"
    );
    assert.equal(
      mod.isSlaBreached(dueAt, new Date("2026-11-19T06:00:01.000Z")),
      true,
      "After SLA deadline must be breached"
    );
    assert.equal(
      mod.isSlaBreached(null, new Date("2026-11-19T06:00:01.000Z")),
      false,
      "Null SLA must not report breached"
    );
  });

  it("T1-1.1-05: API /api/approvals supports all 5 request types and requester cancellation of PENDING request", async () => {
    const postApprovals = await loadRouteHandler("approvals", "POST");
    const getApprovals = await loadRouteHandler("approvals", "GET");
    const cancelApprovalRequest = await loadAction<
      (requestId: string) => Promise<Record<string, unknown>>
    >("approvals", "cancelApprovalRequest");

    harness.auth.asUser(USERS.accountantA);
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

    const requestTypes = [
      "FEE_WAIVER",
      "LARGE_EXPENSE",
      "SALARY_CHANGE",
      "RESULT_PUBLISH",
      "CERTIFICATE_ISSUE",
    ] as const;

    let createdId = "";
    for (const reqType of requestTypes) {
      const req = harness.createRequest("/api/approvals", {
        method: "POST",
        body: {
          requestType: reqType,
          request_type: reqType,
          title: `অনুমোদন অনুরোধ: ${reqType}`,
          description: "ইটুই টেস্ট অনুরোধ",
          amount: 15000,
          targetId: `target-${reqType}`,
        },
      });
      const res = await postApprovals(req);
      assert.ok(
        res.status === 200 || res.status === 201,
        `POST /api/approvals failed for ${reqType} with status ${res.status}`
      );
      const body = (await res.json()) as Record<string, unknown>;
      const id =
        (body.id as string | undefined) ||
        ((body.data as Record<string, unknown> | undefined)?.id as string | undefined) ||
        ((body.request as Record<string, unknown> | undefined)?.id as string | undefined);
      if (reqType === "LARGE_EXPENSE" && id) createdId = id;
    }

    const listRes = await getApprovals(harness.createRequest("/api/approvals"));
    assert.equal(listRes.status, 200);
    const listBody = (await listRes.json()) as Record<string, unknown>;
    const items = (Array.isArray(listBody)
      ? listBody
      : listBody.requests || listBody.data || []) as unknown[];
    assert.ok(items.length >= 5, "All 5 submitted approval requests should be listed");

    assert.ok(createdId, "Created LARGE_EXPENSE approval request must return an id");
    const cancelRes = await cancelApprovalRequest(createdId);
    assert.ok(
      cancelRes && !cancelRes.error,
      `Requester must be able to cancel PENDING request: ${JSON.stringify(cancelRes)}`
    );
  });

  it("T1-1.1-06: Missing relational approval tables (42P01/PGRST205) gracefully fall back to madrasa store", async () => {
    const submitApprovalRequest = await loadAction<
      (input: Record<string, unknown>) => Promise<Record<string, unknown>>
    >("approvals", "submitApprovalRequest");
    const getApprovalRequests = await loadAction<
      (filters?: Record<string, unknown>) => Promise<unknown>
    >("approvals", "getApprovalRequests");

    harness.auth.asUser(USERS.accountantA);
    harness.db.markTableMissing("approval_workflows", "PGRST205");
    harness.db.markTableMissing("approval_workflow_steps", "PGRST205");
    harness.db.markTableMissing("approval_requests", "42P01");
    harness.db.markTableMissing("approval_step_decisions", "42P01");

    const submitted = await submitApprovalRequest({
      requestType: "FEE_WAIVER",
      title: "এতিম ছাত্রের ফি মওকুফ (ফলব্যাক)",
      description: "টেবিল অনুপস্থিত অবস্থায় টেস্ট",
      amount: 1500,
      targetId: "stu-fallback-1",
    });
    assert.ok(
      submitted && !submitted.error,
      `Fallback submission must succeed without throwing: ${JSON.stringify(submitted)}`
    );

    const listed = await getApprovalRequests();
    const arr = Array.isArray(listed)
      ? listed
      : ((listed as Record<string, unknown>)?.requests ||
          (listed as Record<string, unknown>)?.data ||
          []) as unknown[];
    assert.ok(
      arr.length >= 1,
      "Fallback store must persist and return submitted approval request"
    );
  });
});
