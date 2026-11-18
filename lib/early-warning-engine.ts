import type {
  ComputedStudentRisk,
  RiskLevel,
  StudentRiskInput,
} from "@/lib/early-warning";
import { toBanglaNumber, formatBanglaCurrency } from "@/lib/numberToBangla";

function clamp(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, val));
}

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

function toFiniteOrNull(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function toNonNegFinite(val: unknown, fallback = 0): number {
  const n = toFiniteOrNull(val);
  if (n === null) return fallback;
  return Math.max(0, n);
}

export function classifyRiskLevel(compositeScore: number): RiskLevel {
  if (compositeScore >= 70) return "CRITICAL";
  if (compositeScore >= 45) return "HIGH";
  if (compositeScore >= 25) return "MEDIUM";
  return "LOW";
}

/**
 * Pure deterministic 0–100 composite student dropout & fee-default risk scorer.
 * Weights:
 *   - Attendance Risk: 40% (max 40)
 *   - Academic / Exam / Hifz / Kitab / Noorani Risk: 30% (max 30)
 *   - Fee Overdue / Default Risk: 30% (max 30)
 */
export function computeStudentRiskScore(
  input: StudentRiskInput
): ComputedStudentRisk {
  const factors: string[] = [];
  const recommendations: string[] = [];

  // ── 1. Fee Risk (0..30) ────────────────────────────────────────────────────
  const normalizedFeeStatus = (input.feeStatus || "").toUpperCase().trim();
  const isPaidOrWaived =
    Boolean(input.isWaived) ||
    normalizedFeeStatus === "WAIVED" ||
    normalizedFeeStatus === "PAID";

  let feeScore = 0;
  if (!isPaidOrWaived) {
    const overdueInvoices = Math.max(
      0,
      toFiniteOrNull(input.overdueInvoiceCount) ??
        toFiniteOrNull(input.overdueMonthsCount) ??
        0
    );
    const overdueDays = toNonNegFinite(input.overdueDays, 0);
    const overdueAmt = Math.max(
      0,
      toFiniteOrNull(input.overdueAmount) ??
        toFiniteOrNull(input.totalDueAmount) ??
        0
    );
    const totalPayable = toNonNegFinite(input.totalPayableAmount, 0);

    if (overdueInvoices > 0 || overdueAmt > 0 || overdueDays > 0) {
      if (overdueInvoices >= 3) {
        feeScore += 18;
        factors.push(
          `${toBanglaNumber(overdueInvoices)}টি মাসের/কিস্তির ফি বকেয়া রয়েছে`
        );
      } else if (overdueInvoices === 2) {
        feeScore += 12;
        factors.push("২টি কিস্তির ফি বকেয়া রয়েছে");
      } else if (overdueInvoices === 1) {
        feeScore += 6;
        factors.push("১টি বকেয়া ফি ইনভয়েস রয়েছে");
      }

      if (overdueDays >= 60) {
        feeScore += 12;
        factors.push(
          `ফি বকেয়া ${toBanglaNumber(overdueDays)} দিনের বেশি অতিক্রম করেছে`
        );
      } else if (overdueDays >= 30) {
        feeScore += 8;
        factors.push(
          `ফি বকেয়া ${toBanglaNumber(overdueDays)} দিন ধরে অপরিশোধিত`
        );
      } else if (overdueDays >= 15) {
        feeScore += 4;
      }

      if (totalPayable > 0 && overdueAmt > 0) {
        const ratio = overdueAmt / totalPayable;
        if (ratio >= 0.7) {
          feeScore += 10;
        } else if (ratio >= 0.4) {
          feeScore += 6;
        } else {
          feeScore += 3;
        }
      } else if (overdueAmt > 0 && overdueInvoices === 0) {
        feeScore += overdueAmt >= 3000 ? 14 : 8;
        factors.push(`মোট ${formatBanglaCurrency(overdueAmt)} ফি বকেয়া`);
      }

      feeScore = clamp(feeScore, 0, 30);
      if (feeScore >= 15) {
        recommendations.push(
          "অভিভাবকের সাথে বকেয়া ফি পরিশোধের সময়সূচি বা প্রয়োজনে লিল্লাহ/বৃত্তি মওকুফ পর্যালোচনা করুন।"
        );
      } else if (feeScore > 0) {
        recommendations.push("অভিভাবককে বকেয়া ফি রিমাইন্ডার পাঠান।");
      }
    }
  }

  // ── 2. New Student Grace Check ─────────────────────────────────────────────
  const attCount = toFiniteOrNull(input.attendanceRecordsCount) ?? -1;
  const examCount = toFiniteOrNull(input.examRecordsCount) ?? -1;
  const daysSinceAdmission = toFiniteOrNull(input.daysSinceAdmission);
  const consecutiveAbsences = toNonNegFinite(input.consecutiveAbsences, 0);
  const absentDays30d = toNonNegFinite(input.absentDays30d, 0);
  const sabakPausedDays = toNonNegFinite(input.hifzSabakPausedDays, 0);

  const isNewStudentGrace =
    daysSinceAdmission !== null &&
    daysSinceAdmission >= 0 &&
    daysSinceAdmission <= 7 &&
    (attCount === 0 || attCount === -1) &&
    (examCount === 0 || examCount === -1) &&
    consecutiveAbsences === 0 &&
    absentDays30d === 0 &&
    !input.hifzSabakPaused &&
    sabakPausedDays === 0 &&
    feeScore === 0;

  if (isNewStudentGrace) {
    return {
      compositeScore: 0,
      riskScore: 0,
      riskLevel: "LOW",
      attendanceScore: 0,
      academicScore: 0,
      feeScore: 0,
      factors: ["নতুন ভর্তি হওয়া শিক্ষার্থী (প্রাথমিক গ্রেস পিরিয়ড)"],
      recommendations: ["নিয়মিত হাজিরা ও প্রাথমিক ক্লাস পর্যবেক্ষণ চালু রাখুন।"],
    };
  }

  // ── 3. Attendance Risk (0..40) ─────────────────────────────────────────────
  let attendanceScore = 0;
  const currentRate =
    toFiniteOrNull(input.recentAttendanceRate) ??
    toFiniteOrNull(input.attendanceRate30d) ??
    toFiniteOrNull(input.attendanceRate);
  const prevRate = toFiniteOrNull(input.prevAttendanceRate30d);

  if (consecutiveAbsences >= 5) {
    attendanceScore += 32;
    factors.push(
      `টানা ${toBanglaNumber(consecutiveAbsences)} দিন অনুপস্থিত (জরুরি)`
    );
  } else if (consecutiveAbsences >= 3) {
    attendanceScore += 22;
    factors.push(`পরপর ${toBanglaNumber(consecutiveAbsences)} দিন অনুপস্থিত`);
  } else if (consecutiveAbsences >= 1) {
    attendanceScore += consecutiveAbsences * 4;
  }

  if (currentRate !== null && currentRate !== undefined) {
    const rate = clamp(Number(currentRate), 0, 100);
    if (rate < 50) {
      attendanceScore += 28;
      factors.push(`হাজিরার হার অত্যন্ত কম (${toBanglaNumber(round2(rate))}%)`);
    } else if (rate < 70) {
      attendanceScore += 18;
      factors.push(`হাজিরার হার কম (${toBanglaNumber(round2(rate))}%)`);
    } else if (rate < 85) {
      attendanceScore += 8;
    }

    if (prevRate !== null) {
      const clampedPrevRate = clamp(prevRate, 0, 100);
      const drop = clampedPrevRate - rate;
      if (drop >= 25) {
        attendanceScore += 14;
        factors.push(
          `পূর্বের তুলনায় হাজিরা ${toBanglaNumber(round2(drop))}% কমেছে`
        );
      } else if (drop >= 15) {
        attendanceScore += 8;
        factors.push(
          `হাজিরার প্রবণতা নিম্নমুখী (${toBanglaNumber(round2(drop))}% হ্রাস)`
        );
      }
    }
  }

  if (absentDays30d >= 10) {
    attendanceScore += 20;
    if (!factors.some((f) => f.includes("অনুপস্থিত"))) {
      factors.push(`গত ৩০ দিনে ${toBanglaNumber(absentDays30d)} দিন অনুপস্থিত`);
    }
  } else if (absentDays30d >= 6) {
    attendanceScore += 12;
  } else if (absentDays30d >= 3 && consecutiveAbsences === 0) {
    attendanceScore += 6;
  }

  attendanceScore = clamp(round2(attendanceScore), 0, 40);
  if (attendanceScore >= 20) {
    recommendations.push(
      "অবিলম্বে অভিভাবকের সাথে ফোনে যোগাযোগ করে অনুপস্থিতির কারণ যাচাই করুন।"
    );
  } else if (attendanceScore >= 10) {
    recommendations.push("শ্রেণি শিক্ষকের মাধ্যমে শিক্ষার্থীর নিয়মিত উপস্থিতি তদারকি করুন।");
  }

  // ── 4. Academic / Hifz / Kitab / Noorani Risk (0..30) ──────────────────────
  let academicScore = 0;
  const rawPrevExam =
    toFiniteOrNull(input.previousExamPercentage) ??
    toFiniteOrNull(input.previousExamAvg);
  const rawCurrExam =
    toFiniteOrNull(input.currentExamPercentage) ??
    toFiniteOrNull(input.recentExamAvg);
  const prevExam = rawPrevExam !== null ? clamp(rawPrevExam, 0, 100) : null;
  const currExam = rawCurrExam !== null ? clamp(rawCurrExam, 0, 100) : null;

  if (prevExam !== null && currExam !== null) {
    const drop = prevExam - currExam;
    if (drop >= 25) {
      academicScore += 24;
      factors.push(
        `পরীক্ষার নম্বর ${toBanglaNumber(round2(drop))}% হ্রাস পেয়েছে`
      );
    } else if (drop >= 15) {
      academicScore += 16;
      factors.push(
        `পূর্ববর্তী পরীক্ষার চেয়ে ${toBanglaNumber(round2(drop))}% নম্বর কমেছে`
      );
    } else if (drop >= 10) {
      academicScore += 8;
    }
  }

  if (currExam !== null) {
    if (currExam < 40) {
      academicScore += 14;
      factors.push(`সর্বশেষ পরীক্ষার ফলাফল দুর্বল (${toBanglaNumber(round2(currExam))}%)`);
    } else if (currExam < 55) {
      academicScore += 7;
    }
  }

  // Hifz signals
  if (input.hifzSabakPaused || sabakPausedDays >= 3) {
    academicScore += sabakPausedDays >= 7 ? 24 : 18;
    factors.push(
      sabakPausedDays > 0
        ? `হিফজ সবক ${toBanglaNumber(sabakPausedDays)} দিন ধরে বন্ধ রয়েছে`
        : "হিফজ সবক সাময়িকভাবে স্থগিত রয়েছে"
    );
  }
  const hifzPoor = toNonNegFinite(input.hifzPoorRatingCount, 0);
  if (hifzPoor >= 3) {
    academicScore += 12;
    factors.push(`হিফজ সবিনা/আমুখতায় ${toBanglaNumber(hifzPoor)} বার দুর্বল মূল্যায়ন`);
  } else if (hifzPoor >= 1) {
    academicScore += 6;
  }
  const hifzMistakes = toNonNegFinite(input.hifzMistakeCount, 0);
  if (hifzMistakes >= 5) {
    academicScore += 10;
    factors.push(`হিফজ পাঠে অতিরিক্ত ভুল (${toBanglaNumber(hifzMistakes)}টি)`);
  }

  // Kitab signals
  const kitabPoor = toNonNegFinite(input.kitabPoorRatingCount, 0);
  if (kitabPoor >= 3) {
    academicScore += 16;
    factors.push(`কিতাব বিভাগে ${toBanglaNumber(kitabPoor)} বার দুর্বল অগ্রগতি`);
  } else if (kitabPoor >= 1) {
    academicScore += 8;
  }

  // Noorani signals
  const nooraniStalled = toNonNegFinite(
    input.nooraniStalledDays ?? input.nooraniTakhtiStalledDays,
    0
  );
  if (nooraniStalled >= 14) {
    academicScore += 18;
    factors.push(`নূরানী তখতি অগ্রগতি ${toBanglaNumber(nooraniStalled)} দিন ধরে আটকে আছে`);
  } else if (nooraniStalled >= 7) {
    academicScore += 10;
    factors.push(`নূরানী তখতিতে ধীরগতি (${toBanglaNumber(nooraniStalled)} দিন)`);
  }
  const makhrajWeak = toNonNegFinite(input.nooraniMakhrajWeaknessCount, 0);
  if (makhrajWeak >= 3) {
    academicScore += 12;
    factors.push(`মাখরাজ উচ্চারণে ${toBanglaNumber(makhrajWeak)}টি দুর্বলতা শনাক্ত`);
  } else if (makhrajWeak >= 1) {
    academicScore += 6;
  }

  academicScore = clamp(round2(academicScore), 0, 30);
  if (academicScore >= 15) {
    recommendations.push(
      "বিভাগীয় উস্তাদের মাধ্যমে বিশেষ তাকরার/মশক ও নিবিড় পাঠদান ব্যবস্থা করুন।"
    );
  } else if (academicScore >= 8) {
    recommendations.push("পড়াশোনার অগ্রগতি বাড়াতে অতিরিক্ত অনুশীলন নির্ধারণ করুন।");
  }

  // ── 5. Composite Score & Classification ────────────────────────────────────
  const compositeScore = clamp(
    round2(attendanceScore + academicScore + feeScore),
    0,
    100
  );
  const riskLevel = classifyRiskLevel(compositeScore);

  if (factors.length === 0) {
    factors.push("কোনো উল্লেখযোগ্য ঝুঁকিপূর্ণ প্রবণতা পাওয়া যায়নি");
  }
  if (recommendations.length === 0) {
    recommendations.push("স্বাভাবিক একাডেমিক ও হাজিরা কার্যক্রম অব্যাহত রাখুন।");
  }

  return {
    compositeScore,
    riskScore: compositeScore,
    riskLevel,
    attendanceScore,
    academicScore,
    feeScore,
    factors,
    recommendations,
  };
}
