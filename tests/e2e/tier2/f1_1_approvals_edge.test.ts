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
  USERS,
  makeLargeExpenseWorkflow,
} from "../helpers/fixtures";

describe("Tier 2 — Feature 1.1: Multi-Level Approval Workflow Engine (Edge, Security & Negative)", () => {
  let harness: E2eTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  it("T2-1.1-01: Two-person non-self-approval rule blocks requester from approving their own request", async () => {
    const mod = await loadModule<{
      canActorDecideStep: (
        actor: Record<string, unknown>,
        request: Record<string, unknown>,
        currentStep: Record<string, unknown>
      ) => { allowed: boolean; reason?: string };
    }>("@/lib/approval-workflow", ["canActorDecideStep"]);

    const wf = makeLargeExpenseWorkflow(MADRASA_A_ID);
    const selfRequest = {
      id: "req-self-1",
      madrasa_id: MADRASA_A_ID,
      workflow_id: wf.id,
      request_type: "LARGE_EXPENSE",
      amount: 25000,
      requester_id: USERS.accountantA.id,
      requested_by: USERS.accountantA.id,
      current_step_order: 1,
      status: "PENDING",
    };

    const result = mod.canActorDecideStep(
      {
        userId: USERS.accountantA.id,
        id: USERS.accountantA.id,
        role: "accountant",
        roles: ["accountant"],
        permissions: ["finance.approve", "approval.approve"],
      },
      selfRequest,
      wf.steps[0]
    );

    assert.equal(
      result.allowed,
      false,
      "Requester MUST NOT be allowed to approve their own request"
    );
    assert.ok(result.reason && result.reason.length > 0);
  });

  it("T2-1.1-02: Role/permission mismatch on current step rejects unauthorized approver", async () => {
    const mod = await loadModule<{
      canActorDecideStep: (
        actor: Record<string, unknown>,
        request: Record<string, unknown>,
        currentStep: Record<string, unknown>
      ) => { allowed: boolean; reason?: string };
    }>("@/lib/approval-workflow", ["canActorDecideStep"]);

    const wf = makeLargeExpenseWorkflow(MADRASA_A_ID);
    const request = {
      id: "req-step2-1",
      madrasa_id: MADRASA_A_ID,
      workflow_id: wf.id,
      request_type: "LARGE_EXPENSE",
      amount: 40000,
      requester_id: USERS.officeStaffA.id,
      current_step_order: 2,
      status: "PENDING",
    };

    const teacherAttempt = mod.canActorDecideStep(
      {
        userId: USERS.teacherA.id,
        id: USERS.teacherA.id,
        role: "teacher",
        roles: ["teacher"],
        permissions: ["attendance.view"],
      },
      request,
      wf.steps[1]
    );
    assert.equal(
      teacherAttempt.allowed,
      false,
      "Teacher without approval.approve / naib_muhtamim role must be rejected at step 2"
    );
  });

  it("T2-1.1-03: Rejection at intermediate step immediately terminates workflow as REJECTED", async () => {
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
      id: "req-rej-1",
      madrasa_id: MADRASA_A_ID,
      workflow_id: wf.id,
      request_type: "LARGE_EXPENSE",
      amount: 30000,
      requester_id: USERS.officeStaffA.id,
      current_step_order: 1,
      total_steps: 3,
      status: "PENDING",
    };

    const res = mod.evaluateStepProgression(request, wf.steps, [], {
      decision: "REJECTED",
      actorId: USERS.accountantA.id,
      notes: "ভাউচার অসম্পূর্ণ",
    });

    const nextStatus = String(res.nextStatus ?? res.status ?? "").toUpperCase();
    assert.equal(nextStatus, "REJECTED");
    assert.equal(
      Boolean(res.isFinal ?? res.completed ?? nextStatus === "REJECTED"),
      true,
      "Rejection at step 1 must immediately finalize the request without advancing to step 2"
    );
  });

  it("T2-1.1-04: SLA timer boundary checks past, future, and null deadlines accurately", async () => {
    const mod = await loadModule<{
      calculateSlaDueAt: (fromDate: Date, slaHours: number) => string;
      isSlaBreached: (slaDueAt: string | null, now?: Date) => boolean;
    }>("@/lib/approval-workflow", ["calculateSlaDueAt", "isSlaBreached"]);

    const base = new Date("2026-11-10T10:00:00.000Z");
    const dueIso = mod.calculateSlaDueAt(base, 24);
    assert.ok(Date.parse(dueIso) > base.getTime());

    assert.equal(
      mod.isSlaBreached(dueIso, new Date("2026-11-11T10:00:01.000Z")),
      true,
      "1 second past SLA due_at must be flagged as breached"
    );
    assert.equal(
      mod.isSlaBreached(dueIso, new Date("2026-11-11T09:59:59.000Z")),
      false,
      "1 second before SLA due_at must not be breached"
    );
    assert.equal(
      mod.isSlaBreached(null, base),
      false,
      "Null SLA deadline must not be flagged as breached"
    );
  });

  it("T2-1.1-05: Cross-tenant isolation blocks Madrasa B from deciding Madrasa A approval request and SQL enforces RLS", async () => {
    verifySqlMigrationContract({
      filePath: "supabase_phase_1_enterprise_migration.sql",
      tables: [
        { tableName: "approval_workflows" },
        { tableName: "approval_workflow_steps" },
        { tableName: "approval_requests" },
        { tableName: "approval_step_decisions" },
      ],
    });

    const decidePost = await loadRouteHandler(
      "approvals/[id]/decision",
      "POST"
    );

    const wf = makeLargeExpenseWorkflow(MADRASA_A_ID);
    harness.db.seed("approval_workflows", wf);
    harness.db.seed("approval_workflow_steps", wf.steps);
    harness.db.seed("approval_requests", {
      id: "req-tenant-a-1",
      madrasa_id: MADRASA_A_ID,
      workflow_id: wf.id,
      request_type: "LARGE_EXPENSE",
      amount: 25000,
      requester_id: USERS.officeStaffA.id,
      current_step_order: 1,
      total_steps: 3,
      status: "PENDING",
    });

    harness.auth.asUser(USERS.muhtamimB);
    const res = await decidePost(
      harness.createRequest("/api/approvals/req-tenant-a-1/decision", {
        method: "POST",
        body: { decision: "APPROVED", notes: "Cross-tenant attempt" },
      }),
      { params: Promise.resolve({ id: "req-tenant-a-1" }) }
    );
    assert.ok(
      res.status === 403 || res.status === 404,
      `Cross-tenant approval decision must be rejected (403/404), got ${res.status}`
    );

    const rows = harness.db.getRows(
      "approval_requests",
      (r) => r.id === "req-tenant-a-1"
    );
    assert.equal(rows[0].status, "PENDING");
    assert.equal(rows[0].current_step_order, 1);
  });

  it("T2-1.1-06: Missing relational approval tables (42P01/PGRST205) fall back cleanly via GET /api/approvals", async () => {
    const getApprovals = await loadRouteHandler("approvals", "GET");

    harness.auth.asUser(USERS.muhtamimA);
    harness.db.markTableMissing("approval_workflows", "42P01");
    harness.db.markTableMissing("approval_workflow_steps", "42P01");
    harness.db.markTableMissing("approval_requests", "PGRST205");
    harness.db.markTableMissing("approval_step_decisions", "PGRST205");

    const res = await getApprovals(harness.createRequest("/api/approvals"));
    assert.equal(
      res.status,
      200,
      "GET /api/approvals must gracefully fall back when relational tables are missing"
    );
  });
});
