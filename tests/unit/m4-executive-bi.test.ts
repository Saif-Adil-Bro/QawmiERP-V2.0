import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { buildDigestHtml, buildDigestWorkbook } from "@/lib/bi/digest-generator";
import {
  executeCustomReport,
  getExecutiveBiSnapshot,
  type ExecutiveBiSnapshot,
} from "@/lib/bi/executive-bi-service";
import { buildExportWatermark } from "@/lib/export-watermark";

function makeSampleSnapshot(): ExecutiveBiSnapshot {
  return {
    madrasaId: "11111111-1111-4111-8111-111111111111",
    months: 6,
    sessionId: null,
    source: "fallback",
    generatedAt: "2026-11-18T00:00:00.000Z",
    totalFeeCollections: 150000,
    summary: {
      totalFeeCollections: 150000,
      totalFeePayable: 200000,
      totalFeePaid: 150000,
      totalFeeDue: 50000,
      overallDueRatioPct: 25,
      totalBazarExpense: 45000,
      totalBoardingFeeIncome: 60000,
      avgPerCapitaBazarCost: 1500,
      totalFundBalance: 300000,
      totalFundTarget: 500000,
      totalDonations: 120000,
    },
    boarding: [
      {
        month_key: "2026-10",
        total_bazar_expense: 45000,
        active_meal_days: 900,
        active_boarders: 30,
        boarding_fee_income: 60000,
        per_capita_bazar_cost: 1500,
      },
    ],
    boarding_monthly: [],
    funds: [
      {
        fund_id: "f1",
        fund_name: "যাকাত ফান্ড",
        fund_code: "ZKT",
        category: "Zakat",
        target_amount: 500000,
        current_balance: 300000,
        is_active: true,
        target_attainment_pct: 60,
      },
    ],
    fundHealth: [],
    fund_health: [],
    donationsByType: [
      { donation_type: "Zakat", total_amount: 120000, count: 12 },
    ],
    classFeeDues: [
      {
        session_id: null,
        class_key: "c1",
        class_name: "মিজান",
        student_count: 40,
        total_payable: 200000,
        total_paid: 150000,
        total_due: 50000,
        due_ratio_pct: 25,
      },
    ],
    class_fee_dues: [],
    sessionExamComparison: [
      {
        exam_id: "e1",
        exam_title: "বার্ষিক পরীক্ষা ২০২৬",
        exam_year: 2026,
        exam_status: "PUBLISHED",
        session_id: null,
        session_name: "১৪৪৭-৪৮ হিজরি",
        result_entries: 40,
        examined_students: 40,
        avg_percentage: 78.5,
        pass_rate_pct: 95,
      },
    ],
    session_exam_results: [],
  };
}

function assertNoNaNOrInfinity(obj: unknown, path = "root"): void {
  if (typeof obj === "number") {
    expect(Number.isFinite(obj), `Expected finite number at ${path}, got ${obj}`).toBe(true);
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => assertNoNaNOrInfinity(item, `${path}[${i}]`));
    return;
  }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      assertNoNaNOrInfinity(v, `${path}.${k}`);
    }
  }
}

describe("Feature 2.3: Executive BI Digest Generator (HTML & XLSX)", () => {
  it("buildDigestHtml generates A4 Bangla HTML with currency, numbers, and watermark", () => {
    const snapshot = makeSampleSnapshot();
    const watermark = buildExportWatermark({
      exportedBy: "মাওলানা আব্দুল্লাহ",
      actorRole: "muhtamim",
      ipAddress: "203.0.113.10",
      madrasaName: "জামিয়া ইসলামিয়া",
      dataset: "executive_bi_digest",
      exportId: "EXP-TEST-BI-001",
    });

    const html = buildDigestHtml(snapshot, watermark, {
      title: "সাপ্তাহিক নির্বাহী বিআই প্রতিবেদন",
    });

    expect(html).toContain("@page { size: A4;");
    expect(html).toContain('lang="bn"');
    expect(html).toContain("৳");
    expect(html).toContain("১,৫০,০০০");
    expect(html).toContain("মিজান");
    expect(html).toContain("যাকাত ফান্ড");
    expect(html).toContain("EXP-TEST-BI-001");
    expect(html).toContain("মাওলানা আব্দুল্লাহ");
    expect(html).toContain("203.0.113.10");
  });

  it("buildDigestHtml escapes HTML/XSS payloads in titles, names, and watermark fields", () => {
    const snapshot = makeSampleSnapshot();
    snapshot.funds[0].fund_name = '<script>alert("xss-fund")</script>';
    snapshot.classFeeDues[0].class_name = '<img src=x onerror="alert(1)">';
    snapshot.sessionExamComparison[0].exam_title = '<svg onload="alert(2)">';

    const html = buildDigestHtml(
      snapshot,
      {
        exportedBy: '<script>alert("actor")</script>',
        actorRole: "muhtamim",
        ipAddress: "127.0.0.1",
        madrasaName: '<b>মাদ্রাসা</b><script>bad()</script>',
        exportId: "EXP-XSS-001",
      },
      { title: '<script>alert("title")</script>' }
    );

    expect(html).not.toContain('<script>alert("xss-fund")</script>');
    expect(html).not.toContain('<script>alert("actor")</script>');
    expect(html).not.toContain('<script>alert("title")</script>');
    expect(html).not.toContain("<script>bad()</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("buildDigestWorkbook returns a valid XLSX ZIP buffer with watermark metadata", () => {
    const snapshot = makeSampleSnapshot();
    const watermark = buildExportWatermark({
      exportedBy: "Muhtamim Admin",
      actorRole: "muhtamim",
      ipAddress: "198.51.100.42",
      madrasaName: "Jamia Test",
      dataset: "executive_bi_digest",
      exportId: "EXP-XLSX-999",
    });

    const buf = buildDigestWorkbook(snapshot, watermark);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(100);
    // ZIP/XLSX magic bytes: PK (0x50 0x4B)
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);

    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames.length).toBeGreaterThan(0);
    const allText = wb.SheetNames.map((name) =>
      JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 }))
    ).join(" ");
    expect(allText).toContain("EXP-XLSX-999");
    expect(allText).toContain("Muhtamim Admin");
    expect(allText).toContain("198.51.100.42");
  });
});

describe("Feature 2.3: Executive BI Service Guards & Empty-Dataset Safety", () => {
  it("executeCustomReport rejects missing madrasaId", async () => {
    await expect(
      executeCustomReport("", { dataset: "fees", groupBy: "class_name" })
    ).rejects.toThrow();
  });

  it("executeCustomReport rejects non-whitelisted and SQLi dataset names", async () => {
    await expect(
      executeCustomReport("11111111-1111-4111-8111-111111111111", {
        dataset: "users; DROP TABLE students;--",
        groupBy: "class_name",
      })
    ).rejects.toThrow();

    await expect(
      executeCustomReport("11111111-1111-4111-8111-111111111111", {
        dataset: "auth.users",
      })
    ).rejects.toThrow();
  });

  it("executeCustomReport rejects non-whitelisted and SQLi groupBy columns", async () => {
    await expect(
      executeCustomReport("11111111-1111-4111-8111-111111111111", {
        dataset: "fees",
        groupBy: "class_name; SELECT * FROM users--",
      })
    ).rejects.toThrow();

    await expect(
      executeCustomReport("11111111-1111-4111-8111-111111111111", {
        dataset: "students",
        groupBy: "password_hash",
      })
    ).rejects.toThrow();
  });

  it("getExecutiveBiSnapshot returns a safe zeroed snapshot with no NaN or Infinity when madrasaId is empty", async () => {
    const snapshot = await getExecutiveBiSnapshot("");
    expect(snapshot.madrasaId).toBe("");
    expect(snapshot.totalFeeCollections).toBe(0);
    expect(snapshot.summary.overallDueRatioPct).toBe(0);
    expect(snapshot.summary.avgPerCapitaBazarCost).toBe(0);
    expect(snapshot.boarding).toEqual([]);
    expect(snapshot.funds).toEqual([]);
    expect(snapshot.classFeeDues).toEqual([]);
    expect(snapshot.sessionExamComparison).toEqual([]);
    assertNoNaNOrInfinity(snapshot);
  });

  it("buildDigestHtml renders cleanly with zeroed snapshot without NaN or Infinity", () => {
    const emptySnapshot: ExecutiveBiSnapshot = {
      madrasaId: "",
      months: 6,
      sessionId: null,
      source: "fallback",
      generatedAt: "2026-11-18T00:00:00.000Z",
      totalFeeCollections: 0,
      summary: {
        totalFeeCollections: 0,
        totalFeePayable: 0,
        totalFeePaid: 0,
        totalFeeDue: 0,
        overallDueRatioPct: 0,
        totalBazarExpense: 0,
        totalBoardingFeeIncome: 0,
        avgPerCapitaBazarCost: 0,
        totalFundBalance: 0,
        totalFundTarget: 0,
        totalDonations: 0,
      },
      boarding: [],
      boarding_monthly: [],
      funds: [],
      fundHealth: [],
      fund_health: [],
      donationsByType: [],
      classFeeDues: [],
      class_fee_dues: [],
      sessionExamComparison: [],
      session_exam_results: [],
    };
    const html = buildDigestHtml(emptySnapshot, {
      exportedBy: "System",
      actorRole: "muhtamim",
      ipAddress: "127.0.0.1",
      exportId: "EXP-EMPTY-001",
    });
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
    expect(html).toContain("@page { size: A4;");
  });
});
