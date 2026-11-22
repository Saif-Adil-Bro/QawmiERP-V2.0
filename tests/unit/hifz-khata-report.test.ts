import { describe, it, expect } from "vitest";
import {
  getWeekThursdayDate,
  getKhataWeekDays,
  getKhataMonthDays,
  mapLogToKhataRow,
  findWeeklySabinaForWeek,
  formatSabinaBreakdownBn,
  formatSabinaParaRangeBn,
} from "@/lib/hifz-khata";
import { parseInput, weeklyInput } from "@/lib/hifz/entries";

describe("Qawmi Khata Weekly (A5) & Monthly (A4) Report Engine", () => {
  it("computes exact Thursday date for Weeks 1..5 and 7-day Saturday->Friday Khata week", () => {
    // November 2026: Thursdays are Nov 5, 12, 19, 26
    expect(getWeekThursdayDate("2026-11", 1)).toBe("2026-11-05");
    expect(getWeekThursdayDate("2026-11", 2)).toBe("2026-11-12");
    expect(getWeekThursdayDate("2026-11", 3)).toBe("2026-11-19");
    expect(getWeekThursdayDate("2026-11", 4)).toBe("2026-11-26");
    // Week 5 clamps cleanly to month end when no 5th Thursday exists
    expect(getWeekThursdayDate("2026-11", 5)).toBe("2026-11-30");

    const week2 = getKhataWeekDays("2026-11", 2);
    expect(week2.thursdayDate).toBe("2026-11-12");
    expect(week2.saturdayDate).toBe("2026-11-07");
    expect(week2.fridayDate).toBe("2026-11-13");
    expect(week2.days).toHaveLength(7);
    expect(week2.days[0].dayBn).toBe("শনিবার");
    expect(week2.days[5].dayBn).toBe("বৃহস্পতিবার");
    expect(week2.days[6].dayBn).toBe("শুক্রবার");
  });

  it("returns exact 28/29/30/31 uniform daily rows for Monthly Full A4 Khata", () => {
    expect(getKhataMonthDays("2026-11")).toHaveLength(30);
    expect(getKhataMonthDays("2026-12")).toHaveLength(31);
    expect(getKhataMonthDays("2026-02")).toHaveLength(28);
  });

  it("maps Sabqi and Khatmi daily logs into exact Khata table cells", () => {
    const sabqiRow = mapLogToKhataRow({
      sabak_para: 3,
      sabak_page: 12,
      saboki_para: 2,
      amukhta_para: 1,
      sat_sabak_mistakes: 1,
      amukhta_mistakes: 2,
      notes: "",
    });
    expect(sabqiRow.sabakPara).toBe("৩");
    expect(sabqiRow.sabakPage).toBe("১২");
    expect(sabqiRow.satPara).toBe("২");
    expect(sabqiRow.satMistakes).toBe("১");
    expect(sabqiRow.amukhtaPara).toBe("১");
    expect(sabqiRow.amukhtaMistakes).toBe("২");

    const khatmiRow = mapLogToKhataRow({
      student_category: "khatmi",
      morning_session_done: true,
      morning_para_from: 1,
      morning_para_to: 2,
      morning_pages: 20,
      morning_mistakes: 1,
      afternoon_session_done: true,
      afternoon_para_from: 3,
      afternoon_para_to: 3,
      afternoon_pages: 10,
      afternoon_mistakes: 0,
    });
    expect(khatmiRow.sabakPara).toBe("খতমী");
    expect(khatmiRow.satPara).toBe("১–২");
    expect(khatmiRow.satPage).toBe("২০");
    expect(khatmiRow.amukhtaPara).toBe("৩");
    expect(khatmiRow.amukhtaPage).toBe("১০");
  });

  it("matches weekly Sabina by explicit week_number/month_key and allows custom dates when week_number is set", () => {
    const stuId = "11111111-1111-4111-8111-111111111111";
    const parsed = parseInput(weeklyInput, {
      student_id: stuId,
      sabina_date: "2026-11-13", // Friday custom date allowed when week_number is set
      week_number: 2,
      month_key: "2026-11",
      hijri_month_label: "জুমাদাল উলা ১৪৪৮ হি.",
      listener_student_id: null,
      para_from: 1,
      para_to: 3,
      counts: { "1": 2, "2": 0, "3": 1 },
      status: "completed",
      remarks: "",
    });
    expect(parsed.week_number).toBe(2);
    expect(parsed.month_key).toBe("2026-11");
    expect(parsed.hijri_month_label).toBe("জুমাদাল উলা ১৪৪৮ হি.");

    const found = findWeeklySabinaForWeek(
      [
        {
          id: "w1",
          madrasa_id: "m1",
          student_id: stuId,
          sabina_date: "2026-11-13",
          week_number: 2,
          month_key: "2026-11",
          hijri_month_label: "জুমাদাল উলা ১৪৪৮ হি.",
          listener_student_id: null,
          verified_by_teacher_id: null,
          assigned_para_from: 1,
          assigned_para_to: 3,
          para_breakdown: [
            { para: 1, mistakes: 2, status: "good" },
            { para: 2, mistakes: 0, status: "perfect" },
            { para: 3, mistakes: 1, status: "perfect" },
          ],
          total_paras_recited: 3,
          total_mistakes: 3,
          status: "completed",
          remarks: "",
        },
      ],
      stuId,
      "2026-11",
      2,
    );

    expect(found?.id).toBe("w1");
    expect(formatSabinaParaRangeBn(found?.assigned_para_from, found?.assigned_para_to)).toBe("১ – ৩ পারা");
    expect(formatSabinaBreakdownBn(found)).toBe("১নং (২ ভুল), ২নং (০ ভুল), ৩নং (১ ভুল)");
  });
});
