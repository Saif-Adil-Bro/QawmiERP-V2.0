import { describe, it, expect, vi } from "vitest";
import {
  calculateSlaDueAt,
  canActorDecideStep,
  evaluateStepProgression,
  isSlaBreached,
  listWorkflowsForMadrasa,
  matchApprovalWorkflow,
  upsertWorkflowForMadrasa,
} from "@/lib/approval-workflow";
import * as adminMod from "@/lib/supabase/admin";

describe("Multi-Level Approval Workflow Engine (lib/approval-workflow.ts)", () => {
  const sampleWorkflows = [
    {
      id: "wf-10k",
      madrasa_id: "m1",
      name: "১০ হাজার+ খরচ",
      request_type: "LARGE_EXPENSE",
      min_amount: 10000,
      priority: 1,
      is_active: true,
      steps: [
        { id: "s1", step_order: 1, step_name: "Accountant", approver_role: "accountant", required_permission: "finance.approve", sla_hours: 24 },
        { id: "s2", step_order: 2, step_name: "Naib Muhtamim", approver_role: "naib_muhtamim", required_permission: "approval.approve", sla_hours: 24 },
        { id: "s3", step_order: 3, step_name: "Muhtamim", approver_role: "muhtamim", required_permission: "finance.approve", sla_hours: 48 },
      ],
    },
    {
      id: "wf-50k",
      madrasa_id: "m1",
      name: "৫০ হাজার+ খরচ",
      request_type: "LARGE_EXPENSE",
      min_amount_threshold: 50000,
      max_amount: 200000,
      priority: 2,
      is_active: true,
      steps: [
        { id: "s1", step_order: 1, step_name: "Accountant", approver_role: "accountant", sla_hours: 12 },
        { id: "s2", step_order: 2, step_name: "Muhtamim", approver_role: "muhtamim", sla_hours: 24 },
      ],
    },
    {
      id: "wf-inactive",
      madrasa_id: "m1",
      name: "নিষ্ক্রিয় ওয়ার্কফ্লো",
      request_type: "LARGE_EXPENSE",
      threshold_amount: 1000,
      priority: 99,
      is_active: false,
      steps: [],
    },
  ];

  it("matches highest active threshold tier and ignores inactive/below-threshold workflows", () => {
    expect(matchApprovalWorkflow(sampleWorkflows, "LARGE_EXPENSE", 5000)).toBeNull();
    expect(matchApprovalWorkflow(sampleWorkflows, "LARGE_EXPENSE", 25000)?.id).toBe("wf-10k");
    expect(matchApprovalWorkflow(sampleWorkflows, "LARGE_EXPENSE", 75000)?.id).toBe("wf-50k");
    // Above max_amount of wf-50k (200,000), falls back to wf-10k (no max_amount)
    expect(matchApprovalWorkflow(sampleWorkflows, "LARGE_EXPENSE", 300000)?.id).toBe("wf-10k");
    expect(matchApprovalWorkflow(sampleWorkflows, "FEE_WAIVER", 25000)).toBeNull();
  });

  it("uses priority DESC tie-breaker when min_amount is equal", () => {
    const tied = [
      { id: "wf-low", request_type: "FEE_WAIVER", min_amount: 1000, priority: 1, is_active: true, steps: [] },
      { id: "wf-high", request_type: "FEE_WAIVER", min_amount: 1000, priority: 10, is_active: true, steps: [] },
    ];
    expect(matchApprovalWorkflow(tied, "FEE_WAIVER", 1500)?.id).toBe("wf-high");
  });

  it("evaluates multi-step progression and immediate rejection short-circuit", () => {
    const steps = sampleWorkflows[0].steps;
    const req1 = { id: "r1", current_step_order: 1, total_steps: 3, status: "PENDING" };

    const res1 = evaluateStepProgression(req1, steps, [], { decision: "APPROVED", actorId: "u1" });
    expect(res1.nextStepOrder).toBe(2);
    expect(res1.nextStatus).toBe("PENDING");
    expect(res1.isFinal).toBe(false);

    const res2 = evaluateStepProgression({ ...req1, current_step_order: 2 }, steps, [], {
      decision: "APPROVED",
      actorId: "u2",
    });
    expect(res2.nextStepOrder).toBe(3);
    expect(res2.nextStatus).toBe("PENDING");
    expect(res2.isFinal).toBe(false);

    const res3 = evaluateStepProgression({ ...req1, current_step_order: 3 }, steps, [], {
      decision: "APPROVED",
      actorId: "u3",
    });
    expect(res3.nextStatus).toBe("APPROVED");
    expect(res3.isFinal).toBe(true);
    expect(res3.completed).toBe(true);

    const rej = evaluateStepProgression({ ...req1, current_step_order: 2 }, steps, [], {
      decision: "REJECTED",
      actorId: "u2",
    });
    expect(rej.nextStatus).toBe("REJECTED");
    expect(rej.isFinal).toBe(true);
    expect(rej.completed).toBe(true);
  });

  it("calculates SLA deadlines and detects breaches accurately", () => {
    const base = new Date("2026-11-18T00:00:00.000Z");
    const due = calculateSlaDueAt(base, 24);
    expect(due).toBe("2026-11-19T00:00:00.000Z");

    expect(isSlaBreached(due, new Date("2026-11-18T23:59:59.000Z"))).toBe(false);
    expect(isSlaBreached(due, new Date("2026-11-19T00:00:00.000Z"))).toBe(false);
    expect(isSlaBreached(due, new Date("2026-11-19T00:00:01.000Z"))).toBe(true);
    expect(isSlaBreached(null, base)).toBe(false);
  });

  it("enforces two-person non-self-approval and step role/permission authorization", () => {
    const step = sampleWorkflows[0].steps[1]; // naib_muhtamim / approval.approve
    const req = { id: "r1", requested_by: "staff-1", requester_id: "staff-1" };

    // Self-approval blocked
    const selfRes = canActorDecideStep(
      { userId: "staff-1", role: "naib_muhtamim", permissions: ["approval.approve"] },
      req,
      step
    );
    expect(selfRes.allowed).toBe(false);

    // Self-approval allowed only when require_two_person === false
    const selfAllowed = canActorDecideStep(
      { userId: "staff-1", role: "naib_muhtamim", permissions: ["approval.approve"] },
      req,
      step,
      { require_two_person: false }
    );
    expect(selfAllowed.allowed).toBe(true);

    // Unauthorized role/permission blocked
    const teacherRes = canActorDecideStep(
      { userId: "teacher-1", role: "teacher", permissions: ["attendance.view"] },
      req,
      step
    );
    expect(teacherRes.allowed).toBe(false);

    // Authorized by role or permission
    const naibRes = canActorDecideStep(
      { userId: "naib-1", role: "naib_muhtamim", permissions: [] },
      req,
      step
    );
    expect(naibRes.allowed).toBe(true);

    // Specific approver_user_id check
    const specificStep = { ...step, approver_user_id: "u-specific" };
    expect(
      canActorDecideStep({ userId: "naib-1", role: "naib_muhtamim" }, req, specificStep).allowed
    ).toBe(false);
    expect(
      canActorDecideStep({ userId: "u-specific", role: "staff" }, req, specificStep).allowed
    ).toBe(true);
  });

  it("persists and reloads step-level require_step_up in relational mode", async () => {
    const db: Record<string, any[]> = {
      approval_workflows: [],
      approval_workflow_steps: [],
    };

    const makeQuery = (table: string) => {
      const state: { filters: Array<[string, any]> } = { filters: [] };
      const api: any = {
        select: () => api,
        eq: (col: string, val: any) => {
          state.filters.push([col, val]);
          return api;
        },
        order: () => {
          const rows = db[table].filter((r) =>
            state.filters.every(([c, v]) => r[c] === v)
          );
          return Promise.resolve({ data: rows, error: null });
        },
        upsert: (row: any) => {
          const idx = db[table].findIndex((r) => r.id === row.id);
          if (idx >= 0) db[table][idx] = row;
          else db[table].push(row);
          return Promise.resolve({ data: row, error: null });
        },
        delete: () => ({
          eq: (c1: string, v1: any) => ({
            eq: (c2: string, v2: any) => {
              db[table] = db[table].filter((r) => !(r[c1] === v1 && r[c2] === v2));
              return Promise.resolve({ error: null });
            },
          }),
        }),
        insert: (rows: any[]) => {
          db[table].push(...rows);
          return Promise.resolve({ data: rows, error: null });
        },
      };
      return api;
    };

    const spy = vi.spyOn(adminMod, "createAdminClient").mockResolvedValue({
      from: (table: string) => makeQuery(table),
    } as any);

    try {
      const saved = await upsertWorkflowForMadrasa("m-rel-1", "u-admin", {
        name: "Critical Step-Up Workflow",
        request_type: "LARGE_EXPENSE",
        min_amount: 10000,
        steps: [
          {
            step_order: 1,
            step_name: "Accountant",
            approver_role: "accountant",
            sla_hours: 24,
            require_step_up: false,
          },
          {
            step_order: 2,
            step_name: "Muhtamim Final",
            approver_role: "muhtamim",
            sla_hours: 48,
            require_step_up: true,
          },
        ],
      });

      expect(saved.steps[1].require_step_up).toBe(true);

      const reloaded = await listWorkflowsForMadrasa("m-rel-1");
      expect(reloaded).toHaveLength(1);
      expect(reloaded[0].steps[0].require_step_up).toBe(false);
      expect(reloaded[0].steps[1].require_step_up).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});
