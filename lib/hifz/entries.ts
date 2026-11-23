import { z } from "zod";
import {
  breakdown,
  buildHifzLogNotes,
  dailyDefaults,
  dailyFields,
  datePlus,
  parseHifzLogNotes,
  sessionTimes,
  type HifzLogMeta,
} from "../hifz-utils";
import { validDate } from "../portal/rules";
const integer = (min: number, max: number) =>
  z.coerce.number().int().min(min).max(max);
const para = integer(1, 30),
  count = integer(0, 9999),
  id = z.string().uuid(),
  text = z.string().trim().max(2000),
  date = z.string().refine(validDate);
export const profileInput = z.object({
  student_id: id,
  previously_memorized_paras: z
    .array(para)
    .max(30)
    .transform((a) => [...new Set(a)].sort((x, y) => x - y)),
  default_sabina_partner_id: id.nullable(),
  hifz_category: z.enum(["sabqi", "khatmi"]),
});
const range = z
  .object({
    para_from: para,
    para_to: para,
    counts: z.record(z.string(), count),
  })
  .refine((v) => v.para_from <= v.para_to, "পারা সীমা সঠিক নয়");
export const weeklyInput = z
  .object({
    student_id: id,
    sabina_date: date,
    week_number: integer(1, 5).optional(),
    month_key: z
      .string()
      .regex(/^\d{4}-\d{2}$/, "মাস সঠিক নয়")
      .optional(),
    hijri_month_label: z.string().trim().max(80).optional().default(""),
    listener_student_id: id.nullable(),
    status: z.enum(["completed", "assigned"]).default("completed"),
    remarks: text.default(""),
  })
  .and(range)
  .refine(
    (v) =>
      v.week_number !== undefined ||
      new Date(v.sabina_date + "T00:00:00Z").getUTCDay() === 4,
    { message: "বৃহস্পতিবার নির্বাচন করুন", path: ["sabina_date"] },
  );
export const specialInput = z
  .object({
    id,
    title: z.string().trim().min(1).max(160),
    start_date: date,
    duration_days: z
      .union([z.literal(1), z.literal(3), z.literal(7)])
      .default(3),
    listening_mode: z.enum(["one_to_one", "one_to_many", "group_to_group"]),
    participants: z.object({
      reciter_group_ids: z.array(id).min(1).max(120),
      listener_group_ids: z.array(id).max(120),
      teacher_listener_ids: z.array(id).max(12).default([]),
    }),
  })
  .transform((v) => ({
    ...v,
    end_date: datePlus(v.start_date, v.duration_days - 1),
  }));
export const sittingInput = z
  .object({
    event_id: id,
    id,
    session_label: z.enum(["ফজর", "যোহর", "আসর", "মাগরিব"]),
    reciter_id: id,
    listener_ids: z.array(id).min(1).max(132),
    timestamp: z.string().datetime({ offset: true }),
  })
  .and(range);
export const finishInput = z.object({ event_id: id });
export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success)
    throw new EntryError(
      "তথ্য সঠিক নয়: " + (r.error.issues[0]?.path.join(".") || "এন্ট্রি"),
    );
  return r.data;
}
export class EntryError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
export function dailyRecord(input: any, old: any = {}) {
  const prev = parseHifzLogNotes(old?.notes),
    parsed = parseHifzLogNotes(input.notes),
    meta: HifzLogMeta = { ...prev.meta, ...parsed.meta };
  if (input.change_id !== undefined)
    meta.entry_revision = parseInput(id, input.change_id);
  const base = { ...dailyFields(old), ...parsed.meta, ...input };
  if (
    !old?.id &&
    parsed.meta.mistake_count != null &&
    !parsed.meta.hifz_version &&
    input.sabak_mistakes == null
  )
    base.sabak_mistakes = parsed.meta.mistake_count;
  const n = (v: unknown) =>
    v == null || v === "" ? null : parseInput(para, v);
  const fields = {
    ...dailyDefaults,
    student_category: parseInput(
      z.enum(["khatmi", "sabqi"]),
      base.student_category,
    ),
  };
  for (const k of [
    "sabak_mistakes",
    "sat_sabak_mistakes",
    "amukhta_mistakes",
  ] as const)
    fields[k] = parseInput(count, base[k]);
  for (const t of sessionTimes) {
    const done =
      fields.student_category === "khatmi" &&
      parseInput(z.boolean(), base[`${t}_session_done`]);
    fields[`${t}_session_done`] = done;
    const a = n(base[`${t}_para_from`]),
      b = n(base[`${t}_para_to`]);
    if (done && (!a || !b || b < a))
      throw new EntryError("শোনানো পারার শুরু ও শেষ দিন।");
    fields[`${t}_para_from`] = done ? a : null;
    fields[`${t}_para_to`] = done ? b : null;
    fields[`${t}_pages`] = done ? parseInput(count, base[`${t}_pages`]) : 0;
    fields[`${t}_mistakes`] = done
      ? parseInput(count, base[`${t}_mistakes`])
      : 0;
  }
  const primary = { ...old, ...input };
  const page = (v: unknown) =>
    v == null || v === "" ? null : parseInput(integer(1, 610), v);
  for (const k of ["saboki_pages", "sabak_lines", "amukhta_amount"] as const)
    if (input[k] !== undefined) meta[k] = parseInput(text, input[k]);
  if (input.sabak_page !== undefined && input.sabak_page_from === undefined) {
    meta.sabak_page_from = page(input.sabak_page);
    meta.sabak_page_to = meta.sabak_page_from;
  }
  for (const k of ["sabak_page_from", "sabak_page_to"] as const)
    if (input[k] !== undefined) meta[k] = page(input[k]);
  if (input.hifz_stage)
    meta.stage = parseInput(
      z.enum(["HIFZ", "DAWR", "QAIDA", "NAZERA"]),
      input.hifz_stage,
    );
  if (input.is_sabak_paused !== undefined)
    meta.is_sabak_paused = ["true", "on", true].includes(input.is_sabak_paused);
  if (
    input.mistake_count != null &&
    input.sabak_mistakes === undefined &&
    fields.student_category === "sabqi"
  )
    fields.sabak_mistakes = Math.max(
      0,
      parseInput(count, input.mistake_count) -
        fields.sat_sabak_mistakes -
        fields.amukhta_mistakes,
    );
  const mistakes =
    fields.student_category === "sabqi"
      ? fields.sabak_mistakes +
        fields.sat_sabak_mistakes +
        fields.amukhta_mistakes
      : fields.morning_mistakes + fields.afternoon_mistakes;
  if (
    !old?.id &&
    ![
      primary.sabak_para,
      primary.sabak_page,
      meta.sabak_page_from,
      primary.saboki_para,
      primary.amukhta_para,
      meta.saboki_pages,
      meta.amukhta_amount,
      meta.is_sabak_paused,
      primary.performance_rating,
      parsed.cleanNotes,
      prev.cleanNotes,
      input.daily_tilawat,
      prev.tilawatText,
      parsed.tilawatText,
      mistakes,
      fields.morning_session_done,
      fields.afternoon_session_done,
    ].some(Boolean)
  )
    throw new EntryError("পাঠ বা মন্তব্য লিখে সংরক্ষণ করুন।");
  const notes = buildHifzLogNotes({
    rawNotes: parseInput(
      text,
      input.notes === undefined ? prev.cleanNotes : parsed.cleanNotes,
    ),
    dailyTilawat: parseInput(
      text,
      input.daily_tilawat ?? (parsed.tilawatText || prev.tilawatText),
    ),
    meta: { ...meta, ...fields, hifz_version: 1, mistake_count: mistakes },
  });
  return {
    ...fields,
    sabak_para: n(primary.sabak_para),
    sabak_page: page(meta.sabak_page_from ?? primary.sabak_page),
    saboki_para: n(primary.saboki_para),
    amukhta_para: n(primary.amukhta_para),
    performance_rating: primary.performance_rating
      ? parseInput(text, primary.performance_rating)
      : null,
    notes,
  };
}
export function results(v: {
  para_from: number;
  para_to: number;
  counts: Record<string, number>;
}) {
  const detail = breakdown(v.para_from, v.para_to, v.counts);
  return { detail, total: detail.reduce((n, p) => n + p.mistakes, 0) };
}
