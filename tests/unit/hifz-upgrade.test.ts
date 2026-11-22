import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import {
  dailyDefaults,
  emptyProfile,
  paraNumbers,
  parseHifzLogNotes,
  buildHifzLogNotes,
  breakdown,
  khatamCycles,
  memorizedParas,
  mistakeStatus,
  personalEvent,
  type SpecialSabina,
} from "@/lib/hifz-utils";
import { dailyRecord, parseInput, weeklyInput } from "@/lib/hifz/entries";
import { projectDraft, snapshotBundle } from "@/lib/hifz/drafts";
import { QawmiERPOfflineDB } from "@/lib/offlineDb";
import {
  DEFAULT_BUILTIN_WIDGETS,
  normalizeWidgetConfigs,
} from "@/lib/widgets/registry";
const log = (date: string, lo: number, hi: number) => ({
  ...dailyDefaults,
  student_category: "khatmi",
  morning_session_done: true,
  morning_para_from: lo,
  morning_para_to: hi,
  log_date: date,
});
const student = crypto.randomUUID(),
  listener = crypto.randomUUID();
describe("হিফজ ও সবিনা", () => {
  it("classifies the exact mistake thresholds; ranges are inclusive, not total mistakes per session", () => {
    expect([0, 1, 2, 3, 10].map(mistakeStatus)).toEqual([
      "perfect",
      "good",
      "good",
      "weak",
      "weak",
    ]);
    expect(breakdown(4, 6, { 4: 3, 6: 1 })).toEqual([
      { para: 4, mistakes: 3, status: "weak" },
      { para: 5, mistakes: 0, status: "perfect" },
      { para: 6, mistakes: 1, status: "good" },
    ]);
  });
  it("counts distinct paras chronologically across sessions and starts the next cycle, including two finishes in one day", () => {
    const a = log("2026-10-31", 1, 29),
      b = {
        ...log("2026-11-01", 29, 30),
        afternoon_session_done: true,
        afternoon_para_from: 1,
        afternoon_para_to: 4,
      };
    expect(khatamCycles([b, a, b])).toEqual({
      total_khatams_completed: 1,
      khatam_completion_dates: ["2026-11-01"],
      current_khatam_paras_done: [1, 2, 3, 4],
    });
    expect(
      khatamCycles([a, { ...b, morning_para_to: 29 }]).total_khatams_completed,
    ).toBe(0);
    expect(khatamCycles([a]).current_khatam_paras_done).toHaveLength(29);
    expect(
      khatamCycles([{ ...b, morning_para_from: 1, afternoon_para_to: 30 }])
        .total_khatams_completed,
    ).toBe(2);
  });
  it("round trips plain text, raw JSON, tilawat, tagged and nested metadata without exposing or duplicating tags", () => {
    expect(parseHifzLogNotes("শুধু মন্তব্য").cleanNotes).toBe("শুধু মন্তব্য");
    expect(
      parseHifzLogNotes('{"stage":"DAWR","mistake_count":3}').meta.stage,
    ).toBe("DAWR");
    const meta = {
      stage: "HIFZ" as const,
      saboki_pages: "[১–৪]",
      old_list: [1, 2],
      nested: { str: 'escaped "]"' },
      mistake_count: 4,
    };
    const saved = buildHifzLogNotes({
      rawNotes: "আজ ভালো",
      dailyTilawat: "পারা ১",
      meta,
    });
    expect(parseHifzLogNotes(saved)).toEqual({
      cleanNotes: "আজ ভালো",
      tilawatText: "পারা ১",
      meta,
    });
    const edited = dailyRecord({ notes: "আবার শোনাবে" }, { notes: saved });
    expect(edited.sabak_mistakes).toBe(4);
    expect(edited.notes.match(/HIFZ_META:/g)).toHaveLength(1);
    expect(parseHifzLogNotes(edited.notes)).toMatchObject({
      cleanNotes: "আবার শোনাবে",
      tilawatText: "পারা ১",
      meta: { ...meta, hifz_version: 1, ...dailyDefaults, sabak_mistakes: 4 },
    });
  });
  it("ignores disabled ranges and derives totals from whitelisted fields rather than claimed totals", () => {
    const row = dailyRecord({
      ...log("2026-11-05", 1, 30),
      morning_mistakes: 2,
      afternoon_session_done: false,
      afternoon_mistakes: 5,
      mistake_count: 200,
    });
    expect(row.afternoon_mistakes).toBe(0);
    expect(parseHifzLogNotes(row.notes).meta.mistake_count).toBe(2);
    expect(
      khatamCycles([{ log_date: "2026-11-05", notes: row.notes }])
        .total_khatams_completed,
    ).toBe(1);
    expect(() => dailyRecord({ ...log("2026-11-05", 6, 3) })).toThrow();
  });
  it("uses all 30 memorized paras (including the legacy page-based report) for promotion", () => {
    const p = {
      ...emptyProfile(student, "m"),
      previously_memorized_paras: paraNumbers.slice(0, 29),
    };
    expect(
      memorizedParas(p, [{ sabak_para: 30, sabak_page: 24 }]),
    ).toHaveLength(29);
    expect(
      memorizedParas(p, [{ sabak_para: 30, sabak_page: 25 }]),
    ).toHaveLength(30);
  });
  it("retains half-size built-in settings across tenant layout changes", () => {
    const w = DEFAULT_BUILTIN_WIDGETS.find(
      (w) => w.id === "builtin-hifz-tracker",
    );
    expect(w).toMatchObject({
      enabled: true,
      size: "half",
      title: "হিফজুল কুরআন ও সবিনা সারসংক্ষেপ",
    });
    const v = { ...w!, enabled: false, size: "full" as const, order: 0 };
    expect(
      normalizeWidgetConfigs([v]).find((r) => r.id === v.id),
    ).toMatchObject({ enabled: false, size: "full" });
  });
  it("validates Thursdays and applies queued profile, weekly, event and daily writes to this roster only", () => {
    const p = emptyProfile(student, "m");
    const bundle = {
      ...snapshotBundle({}),
      hifz_profiles: [p, emptyProfile(listener, "m")],
    };
    const names = { [student]: "পাঠকারী", [listener]: "শ্রোতা" };
    const weekly = {
      kind: "weekly",
      student_id: student,
      listener_student_id: listener,
      para_from: 1,
      para_to: 2,
      counts: { 2: 3 },
      sabina_date: "2026-11-05",
    };
    expect(() =>
      parseInput(weeklyInput, { ...weekly, sabina_date: "2026-11-06" }),
    ).toThrow();
    const a = projectDraft(bundle, weekly, names);
    expect(projectDraft(a, weekly, names).hifz_weekly_sabina).toHaveLength(1);
    expect(a.hifz_weekly_sabina[0]).toMatchObject({
      total_mistakes: 3,
      total_paras_recited: 2,
    });
    const d = {
      kind: "daily",
      current_date: "2026-11-05",
      records: [{ ...log("2026-11-05", 1, 30), student_id: student }],
    };
    const b = projectDraft(projectDraft(a, d, names), d, names);
    expect(b.hifz_logs).toHaveLength(1);
    expect(b.hifz_profiles[0].total_khatams_completed).toBe(1);
    const event = crypto.randomUUID();
    const e = projectDraft(
      b,
      {
        kind: "special",
        id: event,
        title: "শুকরানা",
        start_date: "2026-11-05",
        duration_days: 3,
        listening_mode: "one_to_one",
        participants: {
          reciter_group_ids: [student],
          listener_group_ids: [listener],
        },
      },
      names,
    );
    const v = {
      kind: "sitting",
      event_id: event,
      id: crypto.randomUUID(),
      reciter_id: student,
      listener_ids: [listener],
      session_label: "ফজর",
      timestamp: "2026-11-05T05:00:00+06:00",
      para_from: 1,
      para_to: 2,
      counts: { 2: 3 },
    };
    expect(
      projectDraft(projectDraft(e, v, names), v, names).hifz_special_sabina[0]
        .session_logs,
    ).toHaveLength(1);
  });
  it("projects only the selected child’s own recitations, not another participant’s results or directory", () => {
    const session = {
      session_label: "ফজর",
      para_from: 1,
      para_to: 2,
      para_wise_mistakes: [],
      total_mistakes: 0,
      timestamp: "2026-11-05T05:00:00+06:00",
    };
    const e: SpecialSabina = {
      id: "event",
      title: "শুকরানা",
      madrasa_id: "A",
      duration_days: 3,
      start_date: "2026-11-05",
      end_date: "2026-11-07",
      status: "ongoing",
      revision: "r1",
      participants: {
        reciter_group_ids: [student],
        listener_group_ids: [listener],
        teacher_listener_ids: [],
        names: { [student]: "Child", [listener]: "Partner" },
      },
      session_logs: [
        {
          ...session,
          id: "mine",
          reciter_id: student,
          listener_ids: [listener],
        },
        {
          ...session,
          id: "private",
          reciter_id: listener,
          listener_ids: [student],
        },
      ],
      listening_mode: "one_to_one",
    };
    const view = personalEvent(e, student);
    expect(view.session_logs).toMatchObject([
      { id: "mine", listener_names: ["Partner"], listener_ids: [] },
    ]);
    expect(JSON.stringify(view)).not.toContain(listener);
    expect(JSON.stringify(view)).not.toContain("private");
  });
  it.each([2, 3, 4])(
    "adds all three stores on populated Dexie v%i without clearing queues or snapshots",
    async (version) => {
      const name = `upgrade-${version}-${crypto.randomUUID()}`;
      const old = new Dexie(name);
      old.version(version).stores({
        students: "id",
        offlineOutbox: "id",
        ...(version >= 3 ? { examSummaries: "id" } : {}),
        ...(version === 4 ? { portalSnapshots: "id" } : {}),
      });
      await old.open();
      await old.table("students").put({ id: "s", old: true });
      await old.table("offlineOutbox").put({ id: "pending" });
      if (version === 4)
        await old.table("portalSnapshots").put({ id: "teacher:", owner: "t" });
      old.close();
      const db = new QawmiERPOfflineDB(name);
      try {
        await db.open();
        expect(db.verno).toBe(5);
        expect(await db.students.get("s")).toMatchObject({ old: true });
        expect(await db.offlineOutbox.count()).toBe(1);
        if (version === 4) expect(await db.portalSnapshots.count()).toBe(1);
        expect(db.hifzProfiles.schema.primKey.name).toBe("student_id");
        expect(db.hifzWeeklySabina.schema.idxByName.sabina_date).toBeTruthy();
        expect(db.hifzSpecialSabina.schema.idxByName.start_date).toBeTruthy();
      } finally {
        await db.delete();
      }
    },
  );
});
