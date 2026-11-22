import { describe, it, expect } from "vitest";
import {
  applyKhatmiCycleProgress,
  buildParaBreakdown,
  classifyParaMistakeStatus,
  computeStudent30ParaMap,
  summarizeParaBreakdown,
} from "@/lib/hifz-upgrade-utils";
import { buildHifzLogNotes, parseHifzLogNotes } from "@/lib/hifz-utils";
import { DEFAULT_BUILTIN_WIDGETS } from "@/lib/widgets/registry";

describe("Hifz Tracking Module Upgrade & Dashboard Widget", () => {
  it("classifies Para mistakes into perfect (0), good (1-2), and weak (3+)", () => {
    expect(classifyParaMistakeStatus(0)).toBe("perfect");
    expect(classifyParaMistakeStatus(1)).toBe("good");
    expect(classifyParaMistakeStatus(2)).toBe("good");
    expect(classifyParaMistakeStatus(3)).toBe("weak");
    expect(classifyParaMistakeStatus(7)).toBe("weak");
  });

  it("builds Para-by-Para breakdown and auto-summary for Thursday Weekly Sabina", () => {
    const breakdown = buildParaBreakdown(1, 4, { 1: 0, 2: 2, 3: 4, 4: 0 });
    expect(breakdown).toHaveLength(4);
    expect(breakdown[0].status).toBe("perfect");
    expect(breakdown[1].status).toBe("good");
    expect(breakdown[2].status).toBe("weak");
    expect(breakdown[3].status).toBe("perfect");

    const summary = summarizeParaBreakdown(breakdown);
    expect(summary.perfectParas).toEqual([1, 4]);
    expect(summary.goodParas).toEqual([2]);
    expect(summary.weakParas).toEqual([3]);
    expect(summary.totalMistakes).toBe(6);
  });

  it("auto-increments total_khatams_completed and resets cycle when all 30 paras finish", () => {
    const first29 = Array.from({ length: 29 }, (_, i) => i + 1);
    const step1 = applyKhatmiCycleProgress(
      { total_khatams_completed: 2, current_khatam_paras_done: first29 },
      [29]
    );
    expect(step1.khatamJustCompleted).toBe(false);
    expect(step1.total_khatams_completed).toBe(2);
    expect(step1.current_khatam_paras_done).toHaveLength(29);

    const step2 = applyKhatmiCycleProgress(step1, [30]);
    expect(step2.khatamJustCompleted).toBe(true);
    expect(step2.total_khatams_completed).toBe(3);
    expect(step2.current_khatam_paras_done).toEqual([]);
  });

  it("computes 30-Para visual map marking pre-memorized, current, and weak paras", () => {
    const map = computeStudent30ParaMap(
      {
        student_id: "s1",
        madrasa_id: "m1",
        hifz_category: "sabqi",
        previously_memorized_paras: [30],
        total_khatams_completed: 0,
        current_khatam_paras_done: [],
      },
      [{ sabak_para: 3 }],
      [
        {
          id: "w1",
          madrasa_id: "m1",
          sabina_date: "2026-11-19",
          student_id: "s1",
          assigned_para_from: 1,
          assigned_para_to: 2,
          para_breakdown: [
            { para: 1, mistakes: 0, status: "perfect" },
            { para: 2, mistakes: 4, status: "weak" },
          ],
          total_paras_recited: 2,
          total_mistakes: 4,
          status: "needs_review",
        },
      ]
    );

    expect(map).toHaveLength(30);
    expect(map[0].status).toBe("completed");
    expect(map[1].status).toBe("weak");
    expect(map[2].status).toBe("current");
    expect(map[29].status).toBe("pre_memorized");
  });

  it("maintains backward compatibility with legacy parseHifzLogNotes()", () => {
    const raw = buildHifzLogNotes({
      rawNotes: "মাশাআল্লাহ",
      meta: {
        stage: "DAWR",
        student_category: "khatmi",
        morning_session_done: true,
        morning_para_from: 1,
        morning_para_to: 2,
        morning_mistakes: 1,
      },
    });
    const parsed = parseHifzLogNotes(raw);
    expect(parsed.cleanNotes).toBe("মাশাআল্লাহ");
    expect(parsed.meta.student_category).toBe("khatmi");
    expect(parsed.meta.morning_session_done).toBe(true);
    expect(parsed.meta.morning_mistakes).toBe(1);
  });

  it("registers builtin-hifz-tracker in DEFAULT_BUILTIN_WIDGETS", () => {
    const widget = DEFAULT_BUILTIN_WIDGETS.find((w) => w.id === "builtin-hifz-tracker");
    expect(widget).toBeDefined();
    expect(widget?.type).toBe("builtin");
    expect(widget?.size).toBe("half");
  });
});
