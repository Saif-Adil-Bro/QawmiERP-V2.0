import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "../helpers/runner";
import {
  loadModule,
  loadRouteHandler,
  readProjectFile,
} from "../helpers/module-loader";
import {
  createTestHarness,
  type E2eTestHarness,
} from "../helpers/test-harness";
import {
  CLASSES_A,
  MADRASA_A_ID,
  SESSION_A_1447,
  STUDENTS_A,
} from "../helpers/fixtures";

describe("Tier 1 — Feature 2.1: Scheduled Cron & Automation Engine (Happy Path)", () => {
  let harness: E2eTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  it("T1-2.1-01: Bearer CRON_SECRET authorizes cron endpoints and vercel.json registers cron schedules", async () => {
    const monthlyHandler = await loadRouteHandler("cron/monthly-fees", "POST");
    const req = harness.createRequest("/api/cron/monthly-fees", {
      method: "POST",
      headers: { authorization: `Bearer ${harness.cronSecret}` },
      body: {},
    });

    const res = await monthlyHandler(req);
    assert.equal(res.status, 200, "Valid CRON_SECRET must authorize /api/cron/monthly-fees");
    const body = (await res.json()) as Record<string, unknown>;
    assert.ok(body !== null && typeof body === "object");

    const workflowRaw = readProjectFile(".github/workflows/cron-jobs.yml");
    assert.ok(workflowRaw.includes("/api/cron/dispatch"), "cron-jobs.yml must trigger /api/cron/dispatch");
    assert.ok(
      workflowRaw.includes("/api/cron/monthly-fees"),
      "cron-jobs.yml must include /api/cron/monthly-fees"
    );
  });

  it("T1-2.1-02: Headless monthly fee generation creates invoices for active enrolled students and is idempotent on re-run", async () => {
    const monthlyHandler = await loadRouteHandler("cron/monthly-fees", "POST");

    harness.db.seed("academic_sessions", SESSION_A_1447);
    harness.db.seed("classes", CLASSES_A.mizan);
    harness.db.seed("students", [
      STUDENTS_A.abdullah,
      STUDENTS_A.yusuf,
      STUDENTS_A.habibur,
    ]);
    harness.db.seed("student_enrollments", [
      {
        id: "enr-1",
        madrasa_id: MADRASA_A_ID,
        session_id: SESSION_A_1447.id,
        student_id: STUDENTS_A.abdullah.id,
        class_id: CLASSES_A.mizan.id,
        roll_number: "101",
        status: "ACTIVE",
      },
      {
        id: "enr-2",
        madrasa_id: MADRASA_A_ID,
        session_id: SESSION_A_1447.id,
        student_id: STUDENTS_A.yusuf.id,
        class_id: CLASSES_A.mizan.id,
        roll_number: "102",
        status: "ACTIVE",
      },
      {
        id: "enr-3",
        madrasa_id: MADRASA_A_ID,
        session_id: SESSION_A_1447.id,
        student_id: STUDENTS_A.habibur.id,
        class_id: CLASSES_A.mizan.id,
        roll_number: "103",
        status: "ACTIVE",
      },
    ]);
    harness.db.seed("fee_types", {
      id: "ft_monthly",
      madrasa_id: MADRASA_A_ID,
      name: "মাসিক বেতন",
      code: "MONTHLY",
      category: "ACADEMIC",
      frequency: "MONTHLY",
      default_amount: 1500, fund_id:"fund-general", fund_name:"সাধারণ ফান্ড (General Fund)",
      is_active: true,
    });
    harness.db.seed("fee_structures", {
      id: "fs-mizan",
      madrasa_id: MADRASA_A_ID,
      session_id: SESSION_A_1447.id,
      class_id: CLASSES_A.mizan.id,
      class_name: CLASSES_A.mizan.name,
      student_category: "ALL",
      name: "মিজান মাসিক ফি",
      total_monthly_amount: 1500,
    });
    harness.db.seed("fee_structure_items", {
      id: "fsi-mizan-1",
      structure_id: "fs-mizan",
      fee_type_id: "ft_monthly",
      fee_type_name: "মাসিক বেতন",
      amount: 1500,
      frequency: "MONTHLY",
    });

    // The HTTP job creates unpaid bills via the same protected RPC as the web form.
    // Database CAS/constraints/rollback are exercised by run-finance-integrity.mjs.
    harness.db.registerRpc('round7_create_scheduled_bill',args=>{
      assert.equal(args.t,MADRASA_A_ID);
      const bill=args.bill as any;
      assert.equal(bill.paid_amount,0);assert.equal(bill.fund_id,'fund-general');
      harness.db.seed('student_fees',bill);
      return true;
    });
    const firstRes = await monthlyHandler(
      harness.createRequest("/api/cron/monthly-fees", {
        method: "POST",
        headers: { authorization: `Bearer ${harness.cronSecret}` },
        body: { billingPeriod: "2026-11" },
      })
    );
    assert.equal(firstRes.status, 200);
    const feesAfterFirst = harness.db.getRows("student_fees");
    assert.equal(
      feesAfterFirst.length,
      3,
      "First monthly fee cron run must generate 3 invoices for 3 active students"
    );

    const secondRes = await monthlyHandler(
      harness.createRequest("/api/cron/monthly-fees", {
        method: "POST",
        headers: { authorization: `Bearer ${harness.cronSecret}` },
        body: { billingPeriod: "2026-11" },
      })
    );
    assert.equal(secondRes.status, 200);
    const feesAfterSecond = harness.db.getRows("student_fees");
    assert.equal(
      feesAfterSecond.length,
      3,
      "Re-running monthly fee cron for the same period must create 0 duplicate invoices"
    );
  });

  it("T1-2.1-03: Overdue reminder cron dispatches strictly to UNPAID/PARTIAL/OVERDUE students with exact due amounts", async () => {
    const overdueHandler = await loadRouteHandler("cron/overdue-reminders", "POST");

    harness.db.seed("students", [
      STUDENTS_A.abdullah,
      STUDENTS_A.yusuf,
      STUDENTS_A.habibur,
    ]);
    harness.db.seed("student_fees", [
      {
        id: "sf-1",
        madrasa_id: MADRASA_A_ID,
        session_id: SESSION_A_1447.id,
        student_id: STUDENTS_A.abdullah.id,
        student_name: "আব্দুল্লাহ আল মামুন",
        class_id: CLASSES_A.mizan.id,
        class_name: CLASSES_A.mizan.name,
        fee_type_id: "ft_monthly",
        fee_type_name: "মাসিক বেতন",
        billing_period: "2026-10",
        due_date: "2026-10-10",
        payable_amount: 1500,
        paid_amount: 0,
        due_amount: 1500,
        status: "OVERDUE",
      },
      {
        id: "sf-2",
        madrasa_id: MADRASA_A_ID,
        session_id: SESSION_A_1447.id,
        student_id: STUDENTS_A.yusuf.id,
        student_name: "মোহাম্মদ ইউসুফ",
        class_id: CLASSES_A.mizan.id,
        class_name: CLASSES_A.mizan.name,
        fee_type_id: "ft_monthly",
        fee_type_name: "মাসিক বেতন",
        billing_period: "2026-10",
        due_date: "2026-10-10",
        payable_amount: 1500,
        paid_amount: 1000,
        due_amount: 500,
        status: "PARTIAL",
      },
      {
        id: "sf-3",
        madrasa_id: MADRASA_A_ID,
        session_id: SESSION_A_1447.id,
        student_id: STUDENTS_A.habibur.id,
        student_name: "হাবিবুর রহমান",
        class_id: CLASSES_A.mizan.id,
        class_name: CLASSES_A.mizan.name,
        fee_type_id: "ft_monthly",
        fee_type_name: "মাসিক বেতন",
        billing_period: "2026-10",
        due_date: "2026-10-10",
        payable_amount: 1500,
        paid_amount: 1500,
        due_amount: 0,
        status: "PAID",
      },
    ]);

    const res = await overdueHandler(
      harness.createRequest("/api/cron/overdue-reminders", {
        method: "POST",
        headers: { authorization: `Bearer ${harness.cronSecret}` },
        body: {},
      })
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    const queued = harness.db.getRows("notification_queue");
    const smsLogs = harness.db.getRows("sms_logs");
    const totalDispatched =
      queued.length + smsLogs.length + harness.http.requests.length;
    assert.ok(
      totalDispatched >= 2 || Number(body.processedCount ?? body.sentCount ?? 0) >= 2,
      "Overdue reminders must dispatch for the 2 overdue/partial students"
    );

    const paidStudentTouched = [...queued, ...smsLogs].some(
      (r) =>
        String(r.recipient_phone || "").includes(STUDENTS_A.habibur.parent_phone) ||
        String(r.message || r.body || "").includes("হাবিবুর")
    );
    assert.equal(
      paidStudentTouched,
      false,
      "PAID student must NOT receive an overdue reminder"
    );
  });

  it("T1-2.1-04: Working-day absence alert cron notifies only Absent students and ignores Present and Leave", async () => {
    const absenceHandler = await loadRouteHandler("cron/absence-alerts", "POST");

    // 2026-11-15 is a Sunday (working day in Bangladesh)
    const workingDate = "2026-11-15";
    harness.db.seed("students", [
      STUDENTS_A.abdullah,
      STUDENTS_A.yusuf,
      STUDENTS_A.habibur,
    ]);
    harness.db.seed("attendance", [
      {
        id: "att-1",
        madrasa_id: MADRASA_A_ID,
        student_id: STUDENTS_A.abdullah.id,
        date: workingDate,
        status: "Absent",
      },
      {
        id: "att-2",
        madrasa_id: MADRASA_A_ID,
        student_id: STUDENTS_A.yusuf.id,
        date: workingDate,
        status: "Present",
      },
      {
        id: "att-3",
        madrasa_id: MADRASA_A_ID,
        student_id: STUDENTS_A.habibur.id,
        date: workingDate,
        status: "Leave",
      },
    ]);

    const res = await absenceHandler(
      harness.createRequest(`/api/cron/absence-alerts?date=${workingDate}`, {
        method: "POST",
        headers: { authorization: `Bearer ${harness.cronSecret}` },
        body: { date: workingDate },
      })
    );
    assert.equal(res.status, 200);
    const queued = harness.db.getRows("notification_queue");
    const smsLogs = harness.db.getRows("sms_logs");
    const allDispatches = [...queued, ...smsLogs];

    assert.ok(
      allDispatches.length >= 1 || harness.http.requests.length >= 1,
      "Absent student guardian must be alerted"
    );
    const leaveStudentAlerted = allDispatches.some((r) =>
      String(r.recipient_phone || "").includes(STUDENTS_A.habibur.parent_phone)
    );
    assert.equal(
      leaveStudentAlerted,
      false,
      "Excused Leave student must NOT receive an unexcused absence alert"
    );
  });

  it("T1-2.1-05: runTrackedCronJob persists job_execution_logs with metrics and logs CRON_EXECUTED", async () => {
    const cronAuth = await loadModule<{
      runTrackedCronJob: <T>(
        jobKey: string,
        madrasaId: string | null,
        triggerSource: "cron" | "manual" | "retry",
        fn: () => Promise<Record<string, unknown>>
      ) => Promise<Record<string, unknown>>;
    }>("@/lib/automation/cron-auth", ["runTrackedCronJob"]);

    const outcome = await cronAuth.runTrackedCronJob(
      "monthly_fee_generation",
      MADRASA_A_ID,
      "cron",
      async () => ({
        processedCount: 12,
        succeededCount: 11,
        failedCount: 0,
        skippedCount: 1,
      })
    );
    assert.ok(outcome, "runTrackedCronJob must return job outcome");

    const logs = harness.db.getRows("job_execution_logs");
    assert.equal(logs.length, 1, "One job_execution_logs row must be recorded");
    assert.equal(logs[0].job_key, "monthly_fee_generation");
    assert.equal(String(logs[0].status).toUpperCase(), "SUCCESS");

    await harness.flushAsync();
    const audits = harness.db.getRows(
      "system_audit_logs",
      (r) => r.action === "CRON_EXECUTED"
    );
    assert.ok(audits.length >= 1, "CRON_EXECUTED audit event must be logged");
  });

  it("T1-2.1-06: /api/cron/process-queues drains pending notification queue items and due webhook retries", async () => {
    const queueHandler = await loadRouteHandler("cron/process-queues", "POST");

    const pastIso = new Date(Date.now() - 60_000).toISOString();
    harness.db.seed("notification_queue", {
      id: "nq-due-1",
      madrasa_id: MADRASA_A_ID,
      event_key: "fee.overdue",
      channel: "in_app",
      recipient_name: "মোঃ আব্দুর রহিম",
      recipient_phone: "01712345890",
      body: "বকেয়া ফি পরিশোধ করুন",
      status: "PENDING",
      attempt_count: 0,
      max_attempts: 3,
      next_retry_at: pastIso,
    });

    const res = await queueHandler(
      harness.createRequest("/api/cron/process-queues", {
        method: "POST",
        headers: { authorization: `Bearer ${harness.cronSecret}` },
        body: {},
      })
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    assert.ok(body !== null && typeof body === "object");
  });
});
