import { childLogs } from "../portal/queries";
import {
  datePlus,
  emptyProfile,
  khatamCycles,
  latestThursday,
  participantIds,
  personalEvent,
  type HifzBundle,
  type HifzSummary,
} from "../hifz-utils";
import { toDhakaDateString } from "../date-utils";
import { storedRows } from "./storage";
/** Caller supplies a verified roster or a single linked child, never request ids. */
export async function readHifz(
  db: any,
  tenant: string,
  students: any[],
  legacy: Record<string, any> = {},
  family = false,
): Promise<HifzBundle> {
  const ids = students.map((s) => s.id),
    allowed = new Set(ids);
  if (!ids.length)
    return {
      hifz_logs: [],
      hifz_profiles: [],
      hifz_weekly_sabina: [],
      hifz_special_sabina: [],
    };
  const [logs, profiles, weekly, special] = await Promise.all([
    childLogs(db, tenant, "hifz_logs", ids),
    storedRows(db, tenant, "profile", ids),
    storedRows(db, tenant, "weekly", ids),
    storedRows(db, tenant, "special"),
  ]);
  const profilesById = new Map(profiles.map((p) => [p.student_id, p]));
  const byId = new Map<string, any[]>();
  for (const l of logs) {
    const rows = byId.get(l.student_id) || [];
    rows.push(l);
    byId.set(l.student_id, rows);
  }
  const participants = new Set([
    ...weekly.map((w) => w.student_id),
    ...special.flatMap((e) => participantIds(e.participants)),
  ]);
  return {
    hifz_logs: logs,
    hifz_profiles: ids.map((id, index) => {
      const p = profilesById.get(id);
      return {
        ...emptyProfile(id, tenant),
        ...p,
        tracked: !!(
          p ||
          byId.has(id) ||
          participants.has(id) ||
          isHifzStudent(students[index], legacy[id])
        ),
        completed_hifz_paras: legacy[id]?.completed_hifz_paras || [],
        ...khatamCycles(byId.get(id) || []),
      };
    }),
    hifz_weekly_sabina: weekly.sort((a, b) =>
      b.sabina_date.localeCompare(a.sabina_date),
    ),
    hifz_special_sabina: special
      .filter((e) => {
        const members = participantIds(e.participants);
        return (
          members.length &&
          (family
            ? members.includes(ids[0])
            : members.every((id) => allowed.has(id)))
        );
      })
      .map((e) => (family ? personalEvent(e, ids[0]) : e))
      .sort((a, b) => b.start_date.localeCompare(a.start_date)),
  };
}
export function summarizeHifz(
  bundle: HifzBundle,
  today = toDhakaDateString(),
  month = today.slice(0, 7),
): HifzSummary {
  const p = bundle.hifz_profiles.filter((p) => p.tracked !== false),
    entries = new Set(
      bundle.hifz_logs
        .filter((l) => l.log_date === today)
        .map((l) => l.student_id),
    ).size;
  const thursday = latestThursday(today);
  const weekly = bundle.hifz_weekly_sabina.filter(
    (w) => w.sabina_date === thursday && w.status === "completed",
  );
  const weak = new Map<number, number>();
  for (const w of weekly)
    for (const b of w.para_breakdown)
      if (b.mistakes >= 3) weak.set(b.para, (weak.get(b.para) || 0) + 1);
  const khatmi = p.filter((v) => v.hifz_category === "khatmi").length;
  return {
    sabqi: p.length - khatmi,
    khatmi,
    entries,
    rate: p.length ? Math.round((entries * 100) / p.length) : 0,
    khatams: p.reduce(
      (n, r) =>
        n + r.khatam_completion_dates.filter((d) => d.startsWith(month)).length,
      0,
    ),
    thursday,
    weekly: weekly.length,
    weekly_rate: p.length ? Math.round((100 * weekly.length) / p.length) : 0,
    weak: [...weak]
      .map(([para, count]) => ({ para, count }))
      .sort((a, b) => b.count - a.count || a.para - b.para),
    events: bundle.hifz_special_sabina
      .filter((e) => e.status === "ongoing")
      .map(({ id, title }) => ({ id, title })),
  };
}

/** Monthly reports measure completed pupil-Thursdays over elapsed pupil-Thursdays;
 * the dashboard uses just the latest Thursday. Neither treats a future date as missed. */
export function monthlySabina(
  b: HifzBundle,
  month: string,
  today = toDhakaDateString(),
) {
  const first = `${month}-01`,
    last = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5), 0))
      .toISOString()
      .slice(0, 10);
  let days = 0;
  for (let d = first; d <= last && d <= today; d = datePlus(d, 1))
    if (latestThursday(d) === d) days++;
  const rows = b.hifz_weekly_sabina.filter(
    (w) =>
      w.sabina_date.startsWith(month) &&
      w.sabina_date <= today &&
      w.status === "completed",
  );
  const weak = new Map<number, number>();
  for (const w of rows)
    for (const r of w.para_breakdown)
      if (r.mistakes >= 3) weak.set(r.para, (weak.get(r.para) || 0) + 1);
  const expected =
    b.hifz_profiles.filter((p) => p.tracked !== false).length * days;
  return {
    days,
    completed: rows.length,
    expected,
    rate: expected ? Math.round((rows.length * 100) / expected) : 0,
    weak: [...weak].sort((a, b) => b[1] - a[1]),
  };
}

export function isHifzStudent(s: any, legacy: any = {}) {
  return (
    ["HIFZ", "DAWR"].includes(legacy?.hifz_stage) ||
    !!legacy?.completed_hifz_paras?.length ||
    /হিফ[জয]|হেফ[জয]|হাফে[জয]|তাহফি[জয]|hifz|tahfiz/i.test(
      [s?.classes?.name, s?.class_name].join(" "),
    )
  );
}
