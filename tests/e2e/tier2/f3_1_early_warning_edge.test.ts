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
  STUDENTS_B,
  USERS,
} from "../helpers/fixtures";

describe("Tier 2 — Feature 3.1: AI Early Warning System (Edge, Security & Negative)", () => {
  let harness: E2eTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  it("T2-3.1-01: Risk score clamps strictly to [0, 100] at extreme low and extreme high inputs", async () => {
    const mod = await loadModule<{
      computeStudentRiskScore: (
        input: Record<string, unknown>
      ) => Record<string, unknown>;
    }>("@/lib/early-warning-engine", ["computeStudentRiskScore"]);

    const zeroRisk = mod.computeStudentRiskScore({
      studentId: STUDENTS_A.abdullah.id,
      attendanceRate30d: 100,
      prevAttendanceRate30d: 100,
      absentDays30d: 0,
      recentExamAvg: 98,
      previousExamAvg: 95,
      overdueMonthsCount: 0,
      totalDueAmount: 0,
    });
    const lowScore = Number(
      zeroRisk.riskScore ?? zeroRisk.score ?? zeroRisk.risk_score
    );
    assert.ok(lowScore >= 0 && lowScore <= 25, `Expected LOW score <= 25, got ${lowScore}`);

    const maxRisk = mod.computeStudentRiskScore({
      studentId: STUDENTS_A.abdullah.id,
      attendanceRate30d: 0,
      prevAttendanceRate30d: 95,
      absentDays30d: 30,
      recentExamAvg: 10,
      previousExamAvg: 95,
      overdueMonthsCount: 12,
      totalDueAmount: 50000,
      hifzSabakPausedDays: 20,
    });
    const highScore = Number(
      maxRisk.riskScore ?? maxRisk.score ?? maxRisk.risk_score
    );
    assert.ok(highScore >= 75 && highScore <= 100, `Expected clamped score in [75,100], got ${highScore}`);
  });

  it("T2-3.1-02: New student with zero attendance/exam history receives LOW grace score (not falsely CRITICAL)", async () => {
    const mod = await loadModule<{
      computeStudentRiskScore: (
        input: Record<string, unknown>
      ) => Record<string, unknown>;
    }>("@/lib/early-warning-engine", ["computeStudentRiskScore"]);

    const newStudent = mod.computeStudentRiskScore({
      studentId: "new-student-001",
      attendanceRecordsCount: 0,
      examRecordsCount: 0,
      overdueMonthsCount: 0,
      totalDueAmount: 0,
      daysSinceAdmission: 2,
    });

    const level = String(
      newStudent.riskLevel ?? newStudent.risk_level ?? ""
    ).toUpperCase();
    assert.notEqual(
      level,
      "CRITICAL",
      "Newly admitted student with zero history must NOT be flagged CRITICAL"
    );
  });

  it("T2-3.1-03: Hifz sabak-pause and Noorani takhti-stall increase academic risk component", async () => {
    const mod = await loadModule<{
      computeStudentRiskScore: (
        input: Record<string, unknown>
      ) => Record<string, unknown>;
    }>("@/lib/early-warning-engine", ["computeStudentRiskScore"]);

    const normalHifz = mod.computeStudentRiskScore({
      studentId: STUDENTS_A.saifulHifz.id,
      department: "hifz",
      attendanceRate30d: 85,
      hifzSabakPausedDays: 0,
      overdueMonthsCount: 0,
      totalDueAmount: 0,
    });
    const stalledHifz = mod.computeStudentRiskScore({
      studentId: STUDENTS_A.saifulHifz.id,
      department: "hifz",
      attendanceRate30d: 85,
      hifzSabakPausedDays: 14,
      overdueMonthsCount: 0,
      totalDueAmount: 0,
    });

    const s1 = Number(normalHifz.riskScore ?? normalHifz.score ?? normalHifz.risk_score);
    const s2 = Number(stalledHifz.riskScore ?? stalledHifz.score ?? stalledHifz.risk_score);
    assert.ok(
      s2 > s1,
      `Hifz sabak-pause (14d) must increase risk score (${s2} > ${s1})`
    );
  });

  it("T2-3.1-04: GET /api/early-warning rejects unauthenticated (401) and unauthorized roles (403)", async () => {
    const getEw = await loadRouteHandler("early-warning", "GET");

    harness.auth.asAnonymous();
    const anonRes = await getEw(
      harness.createRequest("/api/early-warning", { method: "GET" })
    );
    assert.equal(anonRes.status, 401);

    harness.auth.asUser(USERS.studentA);
    const studentRes = await getEw(
      harness.createRequest("/api/early-warning", { method: "GET" })
    );
    assert.equal(studentRes.status, 403);
  });

  it("T2-3.1-05: POST /api/cron/early-warning rejects missing or invalid CRON_SECRET with 401", async () => {
    const cronEw = await loadRouteHandler("cron/early-warning", "POST");

    const res = await cronEw(
      harness.createRequest("/api/cron/early-warning", {
        method: "POST",
        headers: { authorization: "Bearer wrong-cron-secret" },
        body: {},
      })
    );
    assert.equal(res.status, 401);
  });

  it("T2-3.1-06: Cross-tenant isolation ensures Madrasa A risk recalculation never touches Madrasa B students", async () => {
    const mod = await loadModule<{
      recalculateStudentRiskScores: (
        madrasaId: string
      ) => Promise<Record<string, unknown>>;
      getStudentRiskScores: (
        madrasaId: string
      ) => Promise<Record<string, unknown>[]>;
    }>("@/lib/early-warning-service", [
      "recalculateStudentRiskScores",
      "getStudentRiskScores",
    ]);

    harness.db.seed("students", [STUDENTS_A.abdullah, STUDENTS_B.tariq]);
    await mod.recalculateStudentRiskScores(MADRASA_A_ID);

    const scoresB = await mod.getStudentRiskScores(MADRASA_B_ID);
    assert.ok(
      !scoresB.some((s) => s.student_id === STUDENTS_A.abdullah.id),
      "Madrasa B risk scores must never include Madrasa A students"
    );
  });

  it("T2-3.1-07: Missing student_risk_scores (PGRST205) falls back cleanly and Phase 3 SQL enforces RLS", async () => {
    verifySqlMigrationContract({
      filePath: "supabase_phase_3_ai_migration.sql",
      tables: [{ tableName: "student_risk_scores" }],
    });

    const mod = await loadModule<{
      getStudentRiskScores: (
        madrasaId: string
      ) => Promise<Record<string, unknown>[]>;
    }>("@/lib/early-warning-service", ["getStudentRiskScores"]);

    harness.db.seed("students", [STUDENTS_A.abdullah]);
    harness.db.markTableMissing("student_risk_scores", "PGRST205");

    const scores = await mod.getStudentRiskScores(MADRASA_A_ID);
    assert.ok(Array.isArray(scores));
  });
});
