import { describe, it, expect } from "vitest";
import {
  MUSHAF_TOTAL_PAGES,
  getParaPageIndexRange,
  computeSabqiParaProgress,
  computeKhatmiProgress,
  getPeriodDateRange,
  computePeriodHifzReport,
} from "@/lib/hifz-mushaf";
import { getTotalPagesInPara } from "@/lib/hifz-utils";

describe("Qawmi 610-page Mushaf Progress Engine", () => {
  it("matches Bangladesh Qawmi / Hafezi 610-page pagination across all 30 Paras", () => {
    expect(getTotalPagesInPara(1)).toBe(21);
    for (let p = 2; p <= 28; p++) {
      expect(getTotalPagesInPara(p)).toBe(20);
    }
    expect(getTotalPagesInPara(29)).toBe(24);
    expect(getTotalPagesInPara(30)).toBe(25);

    let sum = 0;
    for (let p = 1; p <= 30; p++) {
      sum += getTotalPagesInPara(p);
    }
    expect(sum).toBe(MUSHAF_TOTAL_PAGES);
    expect(MUSHAF_TOTAL_PAGES).toBe(610);

    expect(getParaPageIndexRange(1)).toEqual({
      para: 1,
      totalPages: 21,
      mushafStartPage: 1,
      mushafEndPage: 21,
    });
    expect(getParaPageIndexRange(2)).toEqual({
      para: 2,
      totalPages: 20,
      mushafStartPage: 22,
      mushafEndPage: 41,
    });
    expect(getParaPageIndexRange(29)).toEqual({
      para: 29,
      totalPages: 24,
      mushafStartPage: 562,
      mushafEndPage: 585,
    });
    expect(getParaPageIndexRange(30)).toEqual({
      para: 30,
      totalPages: 25,
      mushafStartPage: 586,
      mushafEndPage: 610,
    });
  });

  it("auto-detects Sabqi Running Para and marks 1..N pages completed (e.g. page 12 = 60%)", () => {
    const profile: any = {
      student_id: "stu-1",
      hifz_category: "sabqi",
      previously_memorized_paras: [30],
    };
    const logs = [
      {
        id: "l1",
        student_id: "stu-1",
        log_date: "2026-11-20",
        sabak_para: 2,
        sabak_page: 12,
        notes: "",
      },
    ];

    const summary = computeSabqiParaProgress(profile, logs);

    expect(summary.runningPara).toBe(2);
    expect(summary.runningParaPagesDone).toBe(12);
    expect(summary.runningParaTotalPages).toBe(20);
    expect(summary.runningParaPercent).toBe(60);

    // Para 30 is pre-memorized (25 pages, no revision pending)
    expect(summary.paras[29].isPreMemorized).toBe(true);
    expect(summary.paras[29].isCompleted).toBe(true);
    expect(summary.paras[29].revisionPending).toBe(false);

    // Para 2 is running with 12/20 pages
    expect(summary.paras[1].isRunning).toBe(true);
    expect(summary.paras[1].completedPages).toBe(12);
    expect(summary.paras[1].percent).toBe(60);

    // Total pages done = 25 (Para 30) + 12 (Para 2) = 37 / 610
    expect(summary.totalPagesDone).toBe(37);
    expect(summary.completedParasCount).toBe(1);
  });

  it("marks newly completed Sabqi Para as revisionPending until revised=true is saved", () => {
    const profile: any = {
      student_id: "stu-1",
      hifz_category: "sabqi",
      previously_memorized_paras: [],
    };
    const logs = [
      {
        id: "l1",
        student_id: "stu-1",
        log_date: "2026-11-18",
        sabak_para: 1,
        sabak_page: 21, // Last page of Para 1 (21 pages)
        notes: "",
      },
    ];

    const beforeRevision = computeSabqiParaProgress(profile, logs);
    expect(beforeRevision.paras[0].isCompleted).toBe(true);
    expect(beforeRevision.paras[0].completedPages).toBe(21);
    expect(beforeRevision.paras[0].percent).toBe(100);
    expect(beforeRevision.paras[0].revisionPending).toBe(true);
    expect(beforeRevision.pendingRevisionParas).toEqual([1]);

    const afterRevision = computeSabqiParaProgress(profile, logs, [], {
      1: {
        para: 1,
        revised: true,
        revision_date: "2026-11-20",
        mistakes: 1,
        rating: "perfect",
        notes: "চমৎকার রিভিশন হয়েছে",
      },
    });
    expect(afterRevision.paras[0].revisionPending).toBe(false);
    expect(afterRevision.pendingRevisionParas).toEqual([]);
    expect(afterRevision.paras[0].revision?.rating).toBe("perfect");
  });

  it("accumulates Khatmi partial-Para pages (10p = 50%, 5p = 25%) and auto-increments Khatam at 610/610", () => {
    const profile: any = {
      student_id: "stu-k",
      hifz_category: "khatmi",
      total_khatams_completed: 0,
    };

    const partialLogs = [
      {
        id: "k1",
        student_id: "stu-k",
        log_date: "2026-11-18",
        student_category: "khatmi",
        morning_session_done: true,
        morning_para_from: 5,
        morning_para_to: 5,
        morning_pages: 10, // 50% of Para 5 (20 pages)
      },
      {
        id: "k2",
        student_id: "stu-k",
        log_date: "2026-11-19",
        student_category: "khatmi",
        morning_session_done: true,
        morning_para_from: 6,
        morning_para_to: 6,
        morning_pages: 5, // 25% of Para 6 (20 pages)
      },
      {
        id: "k3",
        student_id: "stu-k",
        log_date: "2026-11-20",
        student_category: "khatmi",
        afternoon_session_done: true,
        afternoon_para_from: 5,
        afternoon_para_to: 5,
        afternoon_pages: 10, // Completes Para 5 -> 20/20 = 100%
      },
    ];

    const midSummary = computeKhatmiProgress(profile, partialLogs);
    expect(midSummary.paras[4].completedPages).toBe(20);
    expect(midSummary.paras[4].percent).toBe(100);
    expect(midSummary.paras[4].isCompleted).toBe(true);
    expect(midSummary.paras[5].completedPages).toBe(5);
    expect(midSummary.paras[5].percent).toBe(25);
    expect(midSummary.currentCyclePagesDone).toBe(25);
    expect(midSummary.completedParasInCycle).toEqual([5]);
    expect(midSummary.partialParasInCycle).toEqual([
      { para: 6, pages: 5, totalPages: 20, percent: 25 },
    ]);

    // Full 30-Para cycle completes 1 Khatam and resets cycle
    const fullCycleLogs = [
      {
        id: "kf1",
        student_id: "stu-k",
        log_date: "2026-11-20",
        student_category: "khatmi",
        morning_session_done: true,
        morning_para_from: 1,
        morning_para_to: 30,
        morning_pages: 0, // full range
      },
    ];
    const doneSummary = computeKhatmiProgress(profile, fullCycleLogs);
    expect(doneSummary.totalKhatamsCompleted).toBe(1);
    expect(doneSummary.currentCyclePagesDone).toBe(0);
  });

  it("filters period reports accurately across week, month, last month, year, last year, and all", () => {
    expect(getPeriodDateRange("this_week", "2026-11-21")).toEqual({
      startDate: "2026-11-15",
      endDate: "2026-11-21",
    });
    expect(getPeriodDateRange("this_month", "2026-11-21")).toEqual({
      startDate: "2026-11-01",
      endDate: "2026-11-30",
    });
    expect(getPeriodDateRange("last_month", "2026-01-15")).toEqual({
      startDate: "2025-12-01",
      endDate: "2025-12-31",
    });
    expect(getPeriodDateRange("this_year", "2026-11-21")).toEqual({
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
    expect(getPeriodDateRange("last_year", "2026-11-21")).toEqual({
      startDate: "2025-01-01",
      endDate: "2025-12-31",
    });
    expect(getPeriodDateRange("all", "2026-11-21")).toEqual({
      startDate: null,
      endDate: null,
    });

    const logs = [
      {
        id: "a",
        student_id: "s1",
        log_date: "2026-11-20",
        sabak_para: 3,
        sabak_page: 20,
        amukhta_para: 1,
      },
      {
        id: "b",
        student_id: "s1",
        log_date: "2026-10-12",
        sabak_para: 2,
        sabak_page: 10,
        amukhta_para: 30,
      },
      {
        id: "c",
        student_id: "s1",
        log_date: "2025-08-05",
        sabak_para: 1,
        sabak_page: 15,
        amukhta_para: 29,
      },
    ];

    const thisMonth = computePeriodHifzReport(null, logs, [], "this_month", "2026-11-21");
    expect(thisMonth.logsCount).toBe(1);
    expect(thisMonth.sabakParasCompletedInPeriod).toEqual([3]);
    expect(thisMonth.amukhtaParasRecited).toEqual([1]);

    const lastMonth = computePeriodHifzReport(null, logs, [], "last_month", "2026-11-21");
    expect(lastMonth.logsCount).toBe(1);
    expect(lastMonth.amukhtaParasRecited).toEqual([30]);

    const lastYear = computePeriodHifzReport(null, logs, [], "last_year", "2026-11-21");
    expect(lastYear.logsCount).toBe(1);
    expect(lastYear.amukhtaParasRecited).toEqual([29]);

    const all = computePeriodHifzReport(null, logs, [], "all", "2026-11-21");
    expect(all.logsCount).toBe(3);
    expect(all.amukhtaParasRecited).toEqual([1, 29, 30]);
  });
});
