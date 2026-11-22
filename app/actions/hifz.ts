"use server";
import { revalidatePath } from "next/cache";
import { writeGuard } from "@/lib/action-authorization";
import { webScope } from "@/lib/hifz/access";
import { monthlySabina, readHifz, summarizeHifz } from "@/lib/hifz/read";
import { EntryError } from "@/lib/hifz/entries";
import { findDaily, removeDaily, writeHifz } from "@/lib/hifz/write";
import { toDhakaDateString } from "@/lib/date-utils";
import {
  buildStudentHifzReportFromLogs,
  calculateHifzPages,
  getHifzLogPagesCount,
  parseHifzLogNotes,
} from "@/lib/hifz-utils";
export type { HifzLogMeta } from "@/lib/hifz-utils";
export async function parseHifzLogNotesAction(rawNotes?: string | null) {
  return parseHifzLogNotes(rawNotes);
}
export async function calculateHifzPagesAction(
  start?: number | string | null,
  end?: number | string | null,
) {
  return calculateHifzPages(start, end);
}
export async function getHifzLogPagesCountAction(
  start?: number | string | null,
  end?: number | string | null,
) {
  return getHifzLogPagesCount(start, end);
}
async function directory(classId?: string, child?: string) {
  const c = await webScope(classId, child);
  return {
    c,
    bundle: await readHifz(c.db, c.tenant, c.roster, c.legacy, !!child),
  };
}
export async function getHifzDirectory(classId?: string) {
  const { c, bundle } = await directory(classId);
  const profiles = new Map(bundle.hifz_profiles.map((p) => [p.student_id, p]));
  return {
    students: c.roster
      .map((s) => ({
        ...s,
        hifz_category: profiles.get(s.id)?.tracked
          ? profiles.get(s.id)?.hifz_category
          : null,
      }))
      .sort(
        (a, b) =>
          (Number(a.roll_number) || Infinity) -
          (Number(b.roll_number) || Infinity),
      ),
    summary: summarizeHifz(bundle),
  };
}
export async function getHifzStudents(classId?: string) {
  return (await getHifzDirectory(classId)).students;
}
export async function getHifzChild(id: string) {
  const { c, bundle } = await directory(undefined, id);
  return c.roster[0] ? { student: c.roster[0], bundle } : null;
}
function report(s: any, p: any, logs: any[], month?: string, year?: string) {
  return buildStudentHifzReportFromLogs({
    student: s,
    studentProfile: p,
    allStudentLogs: logs,
    targetMonth: month,
    targetYear: year,
  });
}
export async function getHifzLogs(id: string, limit = 20) {
  const child = await getHifzChild(id);
  return (child?.bundle.hifz_logs || []).slice(0, limit).map((log) => {
    const { meta, cleanNotes, tilawatText } = parseHifzLogNotes(log.notes);
    return {
      ...log,
      ...meta,
      clean_notes: cleanNotes,
      daily_tilawat: tilawatText,
      meta,
      hifz_stage: meta.stage || "HIFZ",
      sabak_page_from: meta.sabak_page_from ?? log.sabak_page,
      sabak_page_to: meta.sabak_page_to ?? log.sabak_page,
    };
  });
}
export async function getStudentHifzReport(
  id: string,
  month?: string,
  year?: string,
) {
  const { c, bundle } = await directory(undefined, id);
  return c.roster[0]
    ? report(
        c.roster[0],
        { ...c.legacy?.[id], ...bundle.hifz_profiles[0] },
        bundle.hifz_logs,
        month,
        year,
      )
    : null;
}
export async function getMonthlyHifzSummary(
  classId?: string,
  month?: string,
  year?: string,
) {
  const today = toDhakaDateString(),
    m = month?.padStart(2, "0") || today.slice(5, 7),
    y = year || today.slice(0, 4);
  if (!/^\d{4}$/.test(y) || !/^0[1-9]$|^1[0-2]$/.test(m))
    throw new Error("সঠিক মাস নির্বাচন করুন।");
  const { c, bundle } = await directory(classId);
  const grouped = new Map<string, any[]>();
  for (const l of bundle.hifz_logs) {
    const a = grouped.get(l.student_id) || [];
    a.push(l);
    grouped.set(l.student_id, a);
  }
  const period = `${y}-${m}`;
  const last = new Date(Date.UTC(+y, +m, 0)).toISOString().slice(0, 10);
  return {
    month: m,
    year: y,
    sabina: monthlySabina(bundle, period),
    summary: summarizeHifz(bundle, last < today ? last : today, period),
    events: bundle.hifz_special_sabina.filter((e) => e.status === "ongoing"),
    reports: c.roster.map((s, index) => {
      const p = bundle.hifz_profiles[index];
      return {
        ...report(
          s,
          { ...c.legacy?.[s.id], ...p },
          grouped.get(s.id) || [],
          m,
          y,
        ),
        category: p.hifz_category,
        khatams: p.khatam_completion_dates.filter((d) => d.startsWith(period))
          .length,
        weekly: bundle.hifz_weekly_sabina.filter(
          (w) => w.student_id === s.id && w.sabina_date.startsWith(period),
        ),
      };
    }),
  };
}
function refresh() {
  for (const path of ["/dashboard", "/teacher-portal", "/portal"])
    revalidatePath(path, "layout");
}
const failure = (e: unknown) => ({
  error:
    e instanceof EntryError
      ? e.message
      : "সংরক্ষণ হয়নি। তথ্য যাচাই করে আবার চেষ্টা করুন।",
});
// writeHifz / removeDaily bind tenant + actor and await logAuditEvent for each successful change.
type FormResult = { success?: boolean; error?: string };
export async function createHifzLog(
  _: unknown,
  formData: FormData,
): Promise<FormResult> {
  const guard = await writeGuard("hifz");
  if (!guard.allowed) return guard.fallback;
  try {
    const input = Object.fromEntries(formData),
      c = await webScope(undefined, String(input.student_id));
    await writeHifz(
      c,
      { current_date: input.log_date, records: [input] },
      { insertOnly: true },
    );
    refresh();
    return { success: true };
  } catch (e) {
    return failure(e);
  }
}
export async function updateHifzLog(
  id: string,
  _: unknown,
  formData: FormData,
): Promise<FormResult> {
  const guard = await writeGuard("hifz");
  if (!guard.allowed) return guard.fallback;
  try {
    const c = await webScope(),
      old = await findDaily(c, id),
      input = Object.fromEntries(formData);
    await writeHifz(
      c,
      {
        current_date: input.log_date,
        records: [
          {
            ...input,
            is_sabak_paused: formData.has("is_sabak_paused"),
            student_id: old.student_id,
          },
        ],
      },
      { editId: id },
    );
    refresh();
    return { success: true };
  } catch (e) {
    return failure(e);
  }
}
export async function deleteHifzLog(
  id: string,
  studentId: string,
): Promise<FormResult> {
  const guard = await writeGuard("hifz");
  if (!guard.allowed) return guard.fallback;
  try {
    await removeDaily(await webScope(undefined, studentId), id);
    refresh();
    return { success: true };
  } catch (e) {
    return failure(e);
  }
}

/** In-place daily/profile edits on a staff student's page; shared writer validates
 * all ids against the verified student and records logAuditEvent after success. */
export async function saveStudentHifzEntry(
  studentId: string,
  body: Record<string, unknown>,
): Promise<FormResult> {
  const guard = await writeGuard("hifz");
  if (!guard.allowed) return guard.fallback;
  try {
    if (body.kind !== "daily" && body.kind !== "profile")
      throw new EntryError("অজানা এন্ট্রি।");
    const c = await webScope();
    if (!c.roster.some((s) => s.id === studentId))
      throw new EntryError("অনুমতি নেই।", 403);
    if (
      body.kind === "profile"
        ? body.student_id !== studentId
        : !Array.isArray(body.records) ||
          body.records.length !== 1 ||
          body.records[0]?.student_id !== studentId
    )
      throw new EntryError("শিক্ষার্থী মেলেনি।");
    await writeHifz(c, body);
    refresh();
    return { success: true };
  } catch (e) {
    return failure(e);
  }
}
