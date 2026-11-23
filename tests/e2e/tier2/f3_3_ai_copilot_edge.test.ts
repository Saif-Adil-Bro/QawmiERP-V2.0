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
  MADRASA_B_ID,
  SESSION_A_1446,
  SESSION_A_1447,
  STUDENTS_A,
  USERS,
} from "../helpers/fixtures";

type AiToolMap = Record<
  string,
  { execute: (args: Record<string, unknown>) => Promise<Record<string, unknown>> }
>;

describe("Tier 2 — Feature 3.3: Voice-First Bangla AI Assistant & Action Copilot (Edge, Security & BUG-AI-1..5 Regressions)", () => {
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
    assert.ok(ctx, "Permission context must load");
    return ctx;
  }

  it("T2-3.3-01: BUG-AI-1 regression — collect_fee / fee payment writes total_amount_received (never amount_paid) under strict schema", async () => {
    const confirmPost = await loadRouteHandler("ai/confirm", "POST");

    harness.db.seed("academic_sessions", SESSION_A_1447);
    harness.db.seed("classes", CLASSES_A.mizan);
    harness.db.seed("students", [STUDENTS_A.abdullah]);
    harness.db.seed("student_fees", [
      {
        id: "sf-ai-1",fund_id:"fund-general",fund_name:"General",
        madrasa_id: MADRASA_A_ID,
        session_id: SESSION_A_1447.id,
        student_id: STUDENTS_A.abdullah.id,
        class_id: CLASSES_A.mizan.id,
        class_name: CLASSES_A.mizan.name,
        fee_type_id: "ft_monthly",
        fee_type_name: "মাসিক বেতন",
        billing_period: "2026-11",
        payable_amount: 1500,
        paid_amount: 0,
        due_amount: 1500,
        status: "UNPAID",
      },
    ]);

    harness.db.registerRpc('finance_posting_fund',()=>({id:'fund-general',name:'General'}));
    // The SQL runner verifies writes and rollback. This route test checks the RPC contract.
    const posted:Record<string,any>[]=[];
    harness.db.registerRpc('finance_collect_fee',args=>{
      assert.equal(args.p_tenant,MADRASA_A_ID);assert.equal(args.p_actor,USERS.accountantA.id);
      const p=args.p as Record<string,any>;assert.equal(p.allocations[0].student_fee_id,'sf-ai-1');posted.push(p);return {...p,receipt_no:p.receipt_no || 'MR-2026-00101'};
    });
    harness.auth.asUser(USERS.accountantA);
    const res = await confirmPost(
      harness.createRequest("/api/ai/confirm", {
        method: "POST",
        body: {
          action: "collect_fee",
          payload: {
            studentId: STUDENTS_A.abdullah.id,
            studentFeeId: "sf-ai-1",
            amount: 1500,
            paymentMethod: "Cash",
          },
        },
      })
    );
    assert.equal(
      res.status,
      200,
      `collect_fee must succeed under strict schema (no 42703 amount_paid error), got ${res.status}`
    );

    const payments=posted;
    assert.ok(payments.length >= 1);
    assert.equal(payments[0].total_amount_received, 1500);
    assert.equal("amount_paid" in payments[0], false);
  });

  it("T2-3.3-02: BUG-AI-2 regression — add_expense rejects writing into a locked academic session", async () => {
    const confirmPost = await loadRouteHandler("ai/confirm", "POST");

    harness.db.seed("academic_sessions", [SESSION_A_1446, SESSION_A_1447]);
    harness.auth.asUser(USERS.accountantA);

    const res = await confirmPost(
      harness.createRequest("/api/ai/confirm", {
        method: "POST",
        body: {
          action: "add_expense",
          payload: {
            sessionId: SESSION_A_1446.id,
            amount: 5000,
            category: "Other",
            description: "লকড সেশনে খরচ প্রচেষ্টা",
            expenseDate: "2025-12-15",
          },
        },
      })
    );

    assert.ok(
      res.status >= 400 && res.status < 500,
      `Writing expense to locked session must be rejected (4xx), got ${res.status}`
    );
    const expenses = harness.db.getRows("expenses");
    assert.equal(expenses.length, 0);
  });

  it("T2-3.3-03: BUG-AI-3 regression — create_student_fee uses real student_fees columns (fee_type_name, payable_amount, due_amount)", async () => {
    const confirmPost = await loadRouteHandler("ai/confirm", "POST");

    harness.db.seed("academic_sessions", SESSION_A_1447);
    harness.db.seed("classes", CLASSES_A.mizan);
    harness.db.seed("students", [STUDENTS_A.abdullah]);
    harness.db.seed('fee_types',{id:'exam',madrasa_id:MADRASA_A_ID,name:'পরীক্ষার ফি',code:'EXAM',is_active:true,fund_id:'library',fund_name:'Library'});
    harness.db.registerRpc('finance_posting_fund',()=>({id:'library',name:'Library'}));
    harness.db.registerRpc('finance_edit_bills',args=>{
      assert.equal(args.p_tenant,MADRASA_A_ID);for(const c of args.p_changes as any[]){assert.equal(c.before,null);assert.equal(c.after.fee_type_id,'exam');assert.equal(c.after.fund_id,'library');harness.db.seed('student_fees',c.after);}return null;
    });
    harness.auth.asUser(USERS.accountantA);

    const res = await confirmPost(
      harness.createRequest("/api/ai/confirm", {
        method: "POST",
        body: {
          action: "create_student_fee",
          payload: {
            studentId: STUDENTS_A.abdullah.id,
            feeTypeName: "পরীক্ষার ফি",
            billingPeriod: "2026-11",
            amount: 500,
          },
        },
      })
    );
    assert.equal(
      res.status,
      200,
      `create_student_fee must succeed under strict student_fees schema, got ${res.status}`
    );

    const fees = harness.db.getRows("student_fees");
    assert.ok(fees.length >= 1);
    assert.equal(fees[0].payable_amount, 500);
    assert.equal(fees[0].due_amount, 500);
    assert.equal("title" in fees[0], false);
    assert.equal("total_amount" in fees[0], false);
  });

  it("T2-3.3-04: BUG-AI-4 regression — getExamResultsSummary queries exams.title & subjects.name without non-existent columns", async () => {
    const aiMod = await loadModule<{
      createErpTools: (ctx: Record<string, unknown>) => AiToolMap;
    }>("@/lib/ai/erp-tools", ["createErpTools"]);

    harness.db.seed("academic_sessions", SESSION_A_1447);
    harness.db.seed("classes", CLASSES_A.mizan);
    harness.db.seed("students", [STUDENTS_A.abdullah]);
    harness.db.seed("exams", {
      id: "ex-ai-1",
      madrasa_id: MADRASA_A_ID,
      session_id: SESSION_A_1447.id,
      title: "সাময়িক পরীক্ষা ১৪৪৭",
      year: 2026,
      status: "Completed",
    });
    harness.db.seed("subjects", {
      id: "sub-ai-1",
      madrasa_id: MADRASA_A_ID,
      name: "নাহু-ছরফ",
      code: "NH-101",
    });
    harness.db.seed("exam_results", {
      id: "er-ai-1",
      madrasa_id: MADRASA_A_ID,
      exam_id: "ex-ai-1",
      student_id: STUDENTS_A.abdullah.id,
      subject_name: "নাহু-ছরফ",
      marks_obtained: 88,
      total_marks: 100,
    });

    const ctx = await buildPermContext(USERS.muhtamimA);
    const tools = aiMod.createErpTools(ctx);
    const examTool = tools.getExamResultsSummary || tools.getExamResults;
    if (!examTool) {
      assert.fail("[E2E_MISSING_EXPORT] createErpTools must export getExamResultsSummary");
    }

    const res = await examTool.execute({ examTitle: "সাময়িক পরীক্ষা ১৪৪৭" });
    assert.ok(res && typeof res === "object");
    assert.equal(
      Boolean((res as Record<string, unknown>).error),
      false,
      `Exam summary tool must not fail with 42703: ${JSON.stringify(res)}`
    );
  });

  it("T2-3.3-05: BUG-AI-5 regression — send_due_fee_reminders enforces RBAC and never sends fake 1200 due amounts", async () => {
    const confirmPost = await loadRouteHandler("ai/confirm", "POST");

    harness.db.seed("classes", CLASSES_A.mizan);
    harness.db.seed("students", [STUDENTS_A.abdullah]);
    harness.db.seed("student_fees", {
      id: "sf-bug5-1",
      madrasa_id: MADRASA_A_ID,
      session_id: SESSION_A_1447.id,
      student_id: STUDENTS_A.abdullah.id,
      class_id: CLASSES_A.mizan.id,
      class_name: CLASSES_A.mizan.name,
      fee_type_id: "ft_monthly",
      fee_type_name: "মাসিক বেতন",
      billing_period: "2026-10",
      payable_amount: 3250,
      paid_amount: 0,
      due_amount: 3250,
      status: "OVERDUE",
    });

    harness.http.onRequest(/.*/, () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    harness.auth.asUser(USERS.muhtamimA);
    const res = await confirmPost(
      harness.createRequest("/api/ai/confirm", {
        method: "POST",
        body: {
          action: "send_due_fee_reminders",
          payload: { className: "মিজান জামাত" },
        },
      })
    );
    assert.equal(res.status, 200);
    await harness.flushAsync();

    const outbound = harness.http.requests
      .map((r) => r.body || "")
      .join("\n");
    const queue = JSON.stringify(harness.db.getRows("notification_queue"));
    assert.ok(!(outbound + queue).includes("1200"));
  });

  it("T2-3.3-06: /api/ai/confirm rejects unauthenticated (401), SUSPENDED (403), and unauthorized student (403)", async () => {
    const confirmPost = await loadRouteHandler("ai/confirm", "POST");

    harness.auth.asAnonymous();
    const anonRes = await confirmPost(
      harness.createRequest("/api/ai/confirm", {
        method: "POST",
        body: { action: "send_absent_guardian_notices", payload: {} },
      })
    );
    assert.equal(anonRes.status, 401);

    harness.auth.asUser(USERS.suspendedStaffA);
    const suspRes = await confirmPost(
      harness.createRequest("/api/ai/confirm", {
        method: "POST",
        body: { action: "send_absent_guardian_notices", payload: {} },
      })
    );
    assert.ok(suspRes.status === 401 || suspRes.status === 403);

    harness.auth.asUser(USERS.studentA);
    const studRes = await confirmPost(
      harness.createRequest("/api/ai/confirm", {
        method: "POST",
        body: {
          action: "create_student",
          payload: { firstName: "Hacker", classId: CLASSES_A.mizan.id },
        },
      })
    );
    assert.equal(studRes.status, 403);
  });

  it("T2-3.3-07: Cross-tenant isolation blocks Madrasa B AI tools from reading Madrasa A dues", async () => {
    const aiMod = await loadModule<{
      createErpTools: (ctx: Record<string, unknown>) => AiToolMap;
    }>("@/lib/ai/erp-tools", ["createErpTools"]);

    harness.db.seed("classes", CLASSES_A.mizan);
    harness.db.seed("students", [STUDENTS_A.abdullah]);
    harness.db.seed("student_fees", {
      id: "sf-a-secret",
      madrasa_id: MADRASA_A_ID,
      session_id: SESSION_A_1447.id,
      student_id: STUDENTS_A.abdullah.id,
      class_id: CLASSES_A.mizan.id,
      class_name: "মিজান জামাত",
      fee_type_id: "ft_monthly",
      fee_type_name: "মাসিক বেতন",
      billing_period: "2026-10",
      payable_amount: 5555,
      paid_amount: 0,
      due_amount: 5555,
      status: "OVERDUE",
    });

    const ctxB = await buildPermContext(USERS.muhtamimB);
    const toolsB = aiMod.createErpTools(ctxB);
    assert.ok(
      toolsB.getClassOverdueFees,
      "[E2E_MISSING_EXPORT] createErpTools must expose getClassOverdueFees"
    );
    const resB = await toolsB.getClassOverdueFees.execute({
      className: "মিজান জামাত",
      billingPeriod: "2026-10",
    });
    assert.ok(!JSON.stringify(resB).includes("5555"));
    assert.notEqual(MADRASA_A_ID, MADRASA_B_ID);
  });

  it("T2-3.3-08: erp-knowledge-base includes routes for all new Phase 1–3 enterprise pages", async () => {
    const kbMod = await loadModule<Record<string, unknown>>(
      "@/lib/ai/erp-knowledge-base"
    );
    const serialized = JSON.stringify(kbMod);

    const expectedRoutes = [
      "/dashboard/approvals",
      "/dashboard/settings/security",
      "/dashboard/settings/automation",
      "/dashboard/communication/orchestrator",
      "/dashboard/settings/webhooks",
      "/dashboard/analytics/executive-bi",
      "/dashboard/analytics/early-warning",
      "/dashboard/accounting/anomalies",
    ];

    for (const route of expectedRoutes) {
      assert.ok(
        serialized.includes(route),
        `erp-knowledge-base must include route knowledge for ${route}`
      );
    }
  });
});
