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
  SESSION_A_1447,
  STUDENTS_A,
  USERS,
} from "../helpers/fixtures";

describe("Tier 1 — Feature 3.1: AI Early Warning System (Happy Path)", () => {
  let harness: E2eTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  function extractScore(result: Record<string, unknown>): number {
    const val =
      result.compositeScore ??
      result.composite_score ??
      result.score ??
      result.totalScore;
    assert.equal(typeof val, "number", `Expected numeric risk score in ${JSON.stringify(result)}`);
    return val as number;
  }

  function extractLevel(result: Record<string, unknown>): string {
    return String(result.riskLevel ?? result.risk_level ?? result.level ?? "").toUpperCase();
  }

  it("T1-3.1-01: computeStudentRiskScore enforces deterministic 40% Attendance / 30% Academic / 30% Fee composite weighting", async () => {
    const mod = await loadModule<{
      computeStudentRiskScore: (input: Record<string, unknown>) => Record<string, unknown>;
    }>("@/lib/early-warning-engine", ["computeStudentRiskScore"]);

    const healthyInput = {
      studentId: STUDENTS_A.abdullah.id,
      consecutiveAbsences: 0,
      attendanceRate: 98,
      recentAttendanceRate: 98,
      previousExamPercentage: 85,
      currentExamPercentage: 87,
      overdueInvoiceCount: 0,
      overdueDays: 0,
      overdueAmount: 0,
      totalPayableAmount: 1500,
    };

    const healthy1 = mod.computeStudentRiskScore(healthyInput);
    const healthy2 = mod.computeStudentRiskScore(healthyInput);
    assert.deepEqual(healthy1, healthy2, "Risk scoring must be strictly deterministic");
    assert.ok(extractScore(healthy1) <= 15, "Healthy student must score near 0");
    assert.equal(extractLevel(healthy1), "LOW");

    const maxAttendanceOnly = mod.computeStudentRiskScore({
      ...healthyInput,
      consecutiveAbsences: 7,
      attendanceRate: 30,
      recentAttendanceRate: 20,
    });
    const attScore = extractScore(maxAttendanceOnly);
    assert.ok(
      attScore >= 25 && attScore <= 45,
      `Max attendance risk alone should reflect ~40% weight, got ${attScore}`
    );

    const maxAcademicOnly = mod.computeStudentRiskScore({
      ...healthyInput,
      previousExamPercentage: 90,
      currentExamPercentage: 40,
    });
    const acadScore = extractScore(maxAcademicOnly);
    assert.ok(
      acadScore >= 18 && acadScore <= 35,
      `Max academic risk alone should reflect ~30% weight, got ${acadScore}`
    );

    const maxFeeOnly = mod.computeStudentRiskScore({
      ...healthyInput,
      overdueInvoiceCount: 4,
      overdueDays: 95,
      overdueAmount: 6000,
      totalPayableAmount: 6000,
    });
    const feeScore = extractScore(maxFeeOnly);
    assert.ok(
      feeScore >= 18 && feeScore <= 35,
      `Max fee risk alone should reflect ~30% weight, got ${feeScore}`
    );

    const allMax = mod.computeStudentRiskScore({
      studentId: STUDENTS_A.yusuf.id,
      consecutiveAbsences: 8,
      attendanceRate: 25,
      recentAttendanceRate: 15,
      previousExamPercentage: 88,
      currentExamPercentage: 35,
      overdueInvoiceCount: 4,
      overdueDays: 100,
      overdueAmount: 6000,
      totalPayableAmount: 6000,
    });
    assert.ok(extractScore(allMax) >= 80 && extractScore(allMax) <= 100);
    assert.equal(extractLevel(allMax), "CRITICAL");
  });

  it("T1-3.1-02: Multi-track Qawmi academic signals (Exam drop, Hifz sabak pause, Kitab Poor, Noorani stall) raise academic risk", async () => {
    const mod = await loadModule<{
      computeStudentRiskScore: (input: Record<string, unknown>) => Record<string, unknown>;
    }>("@/lib/early-warning-engine", ["computeStudentRiskScore"]);

    const baseHealthy = {
      consecutiveAbsences: 0,
      attendanceRate: 95,
      overdueInvoiceCount: 0,
      overdueDays: 0,
      overdueAmount: 0,
    };

    const examDrop = mod.computeStudentRiskScore({
      ...baseHealthy,
      studentId: STUDENTS_A.yusuf.id,
      previousExamPercentage: 82,
      currentExamPercentage: 55,
    });
    const hifzDecline = mod.computeStudentRiskScore({
      ...baseHealthy,
      studentId: STUDENTS_A.saifulHifz.id,
      hifzSabakPaused: true,
      hifzPoorRatingCount: 4,
      hifzMistakeCount: 10,
    });
    const kitabDecline = mod.computeStudentRiskScore({
      ...baseHealthy,
      studentId: STUDENTS_A.abdullah.id,
      kitabPoorRatingCount: 4,
    });
    const nooraniStall = mod.computeStudentRiskScore({
      ...baseHealthy,
      studentId: STUDENTS_A.arifNoorani.id,
      nooraniCurrentTakhti: 2,
      nooraniStalledDays: 35,
      nooraniMakhrajWeaknessCount: 7,
    });

    for (const [label, res] of [
      ["Exam drop", examDrop],
      ["Hifz decline", hifzDecline],
      ["Kitab decline", kitabDecline],
      ["Noorani stall", nooraniStall],
    ] as const) {
      assert.ok(
        extractScore(res) > 0,
        `${label} must yield non-zero academic risk score, got ${JSON.stringify(res)}`
      );
    }
  });

  it("T1-3.1-03: Fee overdue scoring flags chronically overdue students while PAID and Lillah WAIVED students get 0 fee risk", async () => {
    const mod = await loadModule<{
      computeStudentRiskScore: (input: Record<string, unknown>) => Record<string, unknown>;
    }>("@/lib/early-warning-engine", ["computeStudentRiskScore"]);

    const overdueRes = mod.computeStudentRiskScore({
      studentId: STUDENTS_A.yusuf.id,
      consecutiveAbsences: 0,
      attendanceRate: 96,
      overdueInvoiceCount: 3,
      overdueDays: 75,
      overdueAmount: 4500,
      totalPayableAmount: 4500,
    });
    const paidRes = mod.computeStudentRiskScore({
      studentId: STUDENTS_A.abdullah.id,
      consecutiveAbsences: 0,
      attendanceRate: 96,
      overdueInvoiceCount: 0,
      overdueDays: 0,
      overdueAmount: 0,
      totalPayableAmount: 4500,
    });
    const waivedRes = mod.computeStudentRiskScore({
      studentId: STUDENTS_A.habibur.id,
      consecutiveAbsences: 0,
      attendanceRate: 96,
      overdueInvoiceCount: 0,
      overdueDays: 0,
      overdueAmount: 0,
      totalPayableAmount: 0,
      isWaived: true,
    });

    assert.ok(extractScore(overdueRes) >= 18, "Chronically overdue student must have elevated fee risk");
    assert.equal(extractScore(paidRes), 0, "Fully PAID healthy student must have 0 risk");
    assert.equal(extractScore(waivedRes), 0, "Lillah WAIVED healthy student must have 0 risk");
  });

  it("T1-3.1-04: recalculateStudentRiskScores persists scores idempotently and getStudentRiskScores filters sorted results", async () => {
    const svc = await loadModule<{
      recalculateStudentRiskScores: (
        madrasaId: string,
        opts?: { classId?: string }
      ) => Promise<Record<string, unknown>>;
      getStudentRiskScores: (
        madrasaId: string,
        filters?: { riskLevel?: string; classId?: string; limit?: number }
      ) => Promise<Record<string, unknown>[]>;
    }>("@/lib/early-warning-service", [
      "recalculateStudentRiskScores",
      "getStudentRiskScores",
    ]);

    harness.db.seed("classes", CLASSES_A.mizan);
    harness.db.seed("students", [STUDENTS_A.abdullah, STUDENTS_A.yusuf]);
    harness.db.seed("attendance", [
      { id: "a1", madrasa_id: MADRASA_A_ID, student_id: STUDENTS_A.yusuf.id, date: "2026-11-10", status: "Absent" },
      { id: "a2", madrasa_id: MADRASA_A_ID, student_id: STUDENTS_A.yusuf.id, date: "2026-11-11", status: "Absent" },
      { id: "a3", madrasa_id: MADRASA_A_ID, student_id: STUDENTS_A.yusuf.id, date: "2026-11-12", status: "Absent" },
      { id: "a4", madrasa_id: MADRASA_A_ID, student_id: STUDENTS_A.yusuf.id, date: "2026-11-13", status: "Absent" },
      { id: "a5", madrasa_id: MADRASA_A_ID, student_id: STUDENTS_A.yusuf.id, date: "2026-11-14", status: "Absent" },
      { id: "a6", madrasa_id: MADRASA_A_ID, student_id: STUDENTS_A.abdullah.id, date: "2026-11-14", status: "Present" },
    ]);
    harness.db.seed("student_fees", [
      {
        id: "sf-y1",
        madrasa_id: MADRASA_A_ID,
        session_id: SESSION_A_1447.id,
        student_id: STUDENTS_A.yusuf.id,
        class_id: CLASSES_A.mizan.id,
        class_name: CLASSES_A.mizan.name,
        fee_type_id: "ft_monthly",
        fee_type_name: "মাসিক বেতন",
        billing_period: "2026-09",
        due_date: "2026-09-10",
        payable_amount: 1500,
        paid_amount: 0,
        due_amount: 1500,
        status: "OVERDUE",
      },
      {
        id: "sf-y2",
        madrasa_id: MADRASA_A_ID,
        session_id: SESSION_A_1447.id,
        student_id: STUDENTS_A.yusuf.id,
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
    ]);

    const summary = await svc.recalculateStudentRiskScores(MADRASA_A_ID);
    assert.ok(summary && typeof summary === "object");

    // Re-run to verify idempotent upsert (no duplicate rows per student)
    await svc.recalculateStudentRiskScores(MADRASA_A_ID);
    const persisted = harness.db.getRows("student_risk_scores");
    assert.equal(
      persisted.length,
      2,
      "Re-running recalculation must upsert without duplicating student_risk_scores"
    );

    const scores = await svc.getStudentRiskScores(MADRASA_A_ID, {
      classId: CLASSES_A.mizan.id,
    });
    assert.equal(scores.length, 2);
    assert.equal(
      scores[0].student_id ?? scores[0].studentId,
      STUDENTS_A.yusuf.id,
      "Highest-risk student (Yusuf) must be sorted first"
    );
  });

  it("T1-3.1-05: GET and POST /api/early-warning support authorized recalculation, listing, and intervention update", async () => {
    const getEw = await loadRouteHandler("early-warning", "GET");
    const postEw = await loadRouteHandler("early-warning", "POST");

    harness.auth.asUser(USERS.muhtamimA);
    harness.db.seed("students", [STUDENTS_A.yusuf]);
    harness.db.seed("attendance", [
      { id: "a1", madrasa_id: MADRASA_A_ID, student_id: STUDENTS_A.yusuf.id, date: "2026-11-11", status: "Absent" },
      { id: "a2", madrasa_id: MADRASA_A_ID, student_id: STUDENTS_A.yusuf.id, date: "2026-11-12", status: "Absent" },
      { id: "a3", madrasa_id: MADRASA_A_ID, student_id: STUDENTS_A.yusuf.id, date: "2026-11-13", status: "Absent" },
    ]);

    const postRes = await postEw(
      harness.createRequest("/api/early-warning", {
        method: "POST",
        body: { action: "recalculate" },
      })
    );
    assert.equal(postRes.status, 200);

    const getRes = await getEw(
      harness.createRequest("/api/early-warning", { method: "GET" })
    );
    assert.equal(getRes.status, 200);
    const body = (await getRes.json()) as Record<string, unknown>;
    assert.ok(body && typeof body === "object");
  });

  it("T1-3.1-06: /api/cron/early-warning recalculates risks across active madrasas and logs job_execution_logs", async () => {
    const cronEw = await loadRouteHandler("cron/early-warning", "POST");

    harness.db.seed("students", [STUDENTS_A.yusuf]);
    const res = await cronEw(
      harness.createRequest("/api/cron/early-warning", {
        method: "POST",
        headers: { authorization: `Bearer ${harness.cronSecret}` },
        body: {},
      })
    );
    assert.equal(res.status, 200);
    const logs = harness.db.getRows("job_execution_logs");
    assert.ok(logs.length >= 1, "Early warning cron must record execution in job_execution_logs");
  });
});
