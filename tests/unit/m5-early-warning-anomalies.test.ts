import { describe, it, expect } from "vitest";
import {
  computeStudentRiskScore,
  classifyRiskLevel,
} from "@/lib/early-warning-engine";
import {
  detectMovingAverageZScoreAnomalies,
  detectDuplicateVouchers,
  detectExcessiveWaivers,
  detectPaymentVoidSpikes,
} from "@/lib/anomaly-detection";

describe("Feature 3.1: AI Early Warning Risk Scoring Engine", () => {
  it("computes deterministic 0-100 composite score with 40/30/30 weights", () => {
    const healthy = computeStudentRiskScore({
      studentId: "s-healthy",
      consecutiveAbsences: 0,
      attendanceRate: 98,
      previousExamPercentage: 85,
      currentExamPercentage: 88,
      overdueInvoiceCount: 0,
      overdueDays: 0,
      overdueAmount: 0,
      totalPayableAmount: 2000,
    });
    expect(healthy.compositeScore).toBe(0);
    expect(healthy.riskScore).toBe(0);
    expect(healthy.riskLevel).toBe("LOW");

    const critical = computeStudentRiskScore({
      studentId: "s-critical",
      consecutiveAbsences: 7,
      attendanceRate: 30,
      previousExamPercentage: 88,
      currentExamPercentage: 35,
      overdueInvoiceCount: 4,
      overdueDays: 90,
      overdueAmount: 6000,
      totalPayableAmount: 6000,
    });
    expect(critical.attendanceScore).toBeLessThanOrEqual(40);
    expect(critical.academicScore).toBeLessThanOrEqual(30);
    expect(critical.feeScore).toBeLessThanOrEqual(30);
    expect(critical.compositeScore).toBeGreaterThanOrEqual(80);
    expect(critical.compositeScore).toBeLessThanOrEqual(100);
    expect(critical.riskLevel).toBe("CRITICAL");
  });

  it("grants LOW grace score to newly admitted students with no history", () => {
    const res = computeStudentRiskScore({
      studentId: "s-new",
      daysSinceAdmission: 3,
      attendanceRecordsCount: 0,
      examRecordsCount: 0,
      overdueInvoiceCount: 0,
      overdueAmount: 0,
    });
    expect(res.compositeScore).toBe(0);
    expect(res.riskLevel).toBe("LOW");
  });

  it("flags Hifz sabak pause, Kitab poor ratings, and Noorani takhti stall", () => {
    const hifz = computeStudentRiskScore({
      studentId: "s-hifz",
      attendanceRate: 95,
      hifzSabakPaused: true,
      hifzPoorRatingCount: 3,
    });
    expect(hifz.academicScore).toBeGreaterThan(0);

    const kitab = computeStudentRiskScore({
      studentId: "s-kitab",
      attendanceRate: 95,
      kitabPoorRatingCount: 3,
    });
    expect(kitab.academicScore).toBeGreaterThan(0);

    const noorani = computeStudentRiskScore({
      studentId: "s-noorani",
      attendanceRate: 95,
      nooraniStalledDays: 20,
      nooraniMakhrajWeaknessCount: 4,
    });
    expect(noorani.academicScore).toBeGreaterThan(0);
  });

  it("excludes PAID and Lillah WAIVED students from fee risk", () => {
    const waived = computeStudentRiskScore({
      studentId: "s-waived",
      attendanceRate: 95,
      overdueInvoiceCount: 3,
      overdueDays: 90,
      overdueAmount: 5000,
      isWaived: true,
    });
    expect(waived.feeScore).toBe(0);
    expect(classifyRiskLevel(70)).toBe("CRITICAL");
    expect(classifyRiskLevel(45)).toBe("HIGH");
    expect(classifyRiskLevel(25)).toBe("MEDIUM");
    expect(classifyRiskLevel(10)).toBe("LOW");
  });

  it("sanitizes NaN attendance/fee inputs, negative daysSinceAdmission, and out-of-range exam percentages", () => {
    // 1. NaN attendanceRate30d must NOT add +28 risk points
    const nanAtt = computeStudentRiskScore({
      studentId: "s-nan-att",
      attendanceRate30d: Number.NaN,
    });
    expect(nanAtt.attendanceScore).toBe(0);

    // 2. NaN overdueInvoiceCount must NOT zero out overdueAmount fee scoring
    const nanFee = computeStudentRiskScore({
      studentId: "s-nan-fee",
      overdueInvoiceCount: Number.NaN,
      overdueAmount: 5000,
    });
    expect(nanFee.feeScore).toBe(14);

    // 3. Negative daysSinceAdmission must NOT trigger 7-day grace period
    const negDays = computeStudentRiskScore({
      studentId: "s-neg-days",
      daysSinceAdmission: -5,
      hifzSabakPaused: true,
      hifzSabakPausedDays: 10,
    });
    expect(negDays.compositeScore).toBeGreaterThan(0);
    expect(negDays.academicScore).toBe(24);

    // 4. Exam percentages >100 or <0 must be clamped to [0, 100]
    const overExam = computeStudentRiskScore({
      studentId: "s-over-exam",
      previousExamPercentage: 200,
      currentExamPercentage: 100,
    });
    expect(overExam.academicScore).toBe(0);

    const negExam = computeStudentRiskScore({
      studentId: "s-neg-exam",
      previousExamPercentage: -20,
      currentExamPercentage: -10,
    });
    expect(negExam.academicScore).toBe(14);
  });
});

describe("Feature 3.2: Financial & Boarding Anomaly Detectors", () => {
  it("detects moving-average Z-score spikes and ignores zero-variance or short series", () => {
    const flat = [
      { date: "2026-11-01", amount: 5000 },
      { date: "2026-11-02", amount: 5000 },
      { date: "2026-11-03", amount: 5000 },
      { date: "2026-11-04", amount: 5000 },
    ];
    expect(detectMovingAverageZScoreAnomalies(flat)).toEqual([]);
    expect(
      detectMovingAverageZScoreAnomalies([{ date: "2026-11-01", amount: 5000 }])
    ).toEqual([]);

    const series = [];
    for (let d = 1; d <= 14; d++) {
      series.push({
        date: `2026-10-${String(d).padStart(2, "0")}`,
        value: 6000 + (d % 3) * 150,
      });
    }
    series.push({ date: "2026-10-15", value: 19000 });

    const anomalies = detectMovingAverageZScoreAnomalies(series, {
      windowSize: 14,
      warningZScore: 2.0,
      criticalZScore: 3.0,
    });
    expect(anomalies.length).toBe(1);
    expect(anomalies[0].severity).toBe("CRITICAL");
    expect(anomalies[0].zScore).toBeGreaterThanOrEqual(3.0);
  });

  it("detects same-day duplicate vouchers while ignoring different dates", () => {
    const anomalies = detectDuplicateVouchers([
      {
        id: "e1",
        expense_date: "2026-11-10",
        category: "Utility",
        amount: 4500,
        description: "বিদ্যুৎ বিল",
      },
      {
        id: "e2",
        expense_date: "2026-11-10",
        category: "Utility",
        amount: 4500,
        description: "বিদ্যুৎ বিল",
      },
      {
        id: "e3",
        expense_date: "2026-11-11",
        category: "Utility",
        amount: 4500,
        description: "বিদ্যুৎ বিল",
      },
    ]);
    expect(anomalies.length).toBe(1);
    expect(anomalies[0].anomalyType).toBe("DUPLICATE_VOUCHER");
  });

  it("detects excessive fee waivers per approver without flagging normal users", () => {
    const waivers = [];
    for (let i = 1; i <= 7; i++) {
      waivers.push({
        id: `w-${i}`,
        approved_by: "user-excessive",
        actor_name: "হিসাবরক্ষক",
        amount: 2000,
        status: "APPROVED",
      });
    }
    waivers.push({
      id: "w-ok",
      approved_by: "user-normal",
      actor_name: "মুহতামিম",
      amount: 1000,
      status: "APPROVED",
    });

    const flagged = detectExcessiveWaivers(waivers, {
      maxCountPerUser: 5,
      maxTotalAmountPerUser: 10000,
    });
    expect(flagged.length).toBe(1);
    expect(flagged[0].entityId).toBe("user-excessive");
  });

  it("detects abnormal payment void/reversal spikes", () => {
    const payments = [
      { id: "p1", status: "VOID", amount: 1500, payment_date: "2026-11-12" },
      { id: "p2", status: "REVERSED", amount: 2000, payment_date: "2026-11-12" },
      { id: "p3", status: "VOID", amount: 1200, payment_date: "2026-11-12" },
      { id: "p4", status: "PAID", amount: 1500, payment_date: "2026-11-12" },
      { id: "p5", status: "PAID", amount: 1500, payment_date: "2026-11-13" },
    ];
    const anomalies = detectPaymentVoidSpikes(payments, {
      maxVoidCountPerDay: 3,
    });
    expect(anomalies.length).toBe(1);
    expect(anomalies[0].anomalyType).toBe("PAYMENT_VOID_SPIKE");
  });
});
