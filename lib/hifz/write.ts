import { createHash, randomUUID } from "node:crypto";
import {
  dailyDefaults,
  dailyFields,
  emptyProfile,
  memorizedParas,
  participantIds,
  parseHifzLogNotes,
  type SpecialSabina,
  type Sitting,
} from "../hifz-utils";
import { childLogs, rows } from "../portal/queries";
import { validDate } from "../portal/rules";
import { toDhakaDateString } from "../date-utils";
import { logAuditEvent } from "../audit-log";
import {
  dailyRecord,
  EntryError,
  finishInput,
  parseInput,
  profileInput,
  results,
  sittingInput,
  specialInput,
  weeklyInput,
} from "./entries";
import { putRow, schemaMissing, storedRows, type WriteScope } from "./storage";
export const fullName = (s: any) =>
  [s.first_name, s.last_name].filter(Boolean).join(" ");
const denied = () => new EntryError("এই শিক্ষার্থী বা সবিনার অনুমতি নেই।", 403);
function member(c: WriteScope, id: string) {
  const s = c.roster.find((r) => r.id === id);
  if (!s) throw denied();
  return s;
}
function partner(c: WriteScope, id: string | null, child: string) {
  if (!id) return "";
  if (id === child) throw new EntryError("শ্রোতা ও পাঠকারী আলাদা হতে হবে।");
  return fullName(member(c, id));
}
export function auditHifz(c: WriteScope, action: string, id: string) {
  return logAuditEvent({
    madrasaId: c.tenant,
    actorId: c.actor,
    module: "hifz",
    action: `hifz.${action}`,
    entityType: "hifz",
    entityId: id,
    summary: `হিফজ নথি · ${action}`,
  });
}
function weeklyId(t: string, s: string, date: string) {
  const h = createHash("sha256").update(`${t}:${s}:${date}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export async function findDaily(c: WriteScope, id: string) {
  const r = await c.db
    .from("hifz_logs")
    .select("*")
    .eq("madrasa_id", c.tenant)
    .eq("id", id)
    .maybeSingle();
  if (r.error) throw r.error;
  if (!r.data) throw new EntryError("লগ পাওয়া যায়নি।", 404);
  member(c, r.data.student_id);
  return r.data;
}
export async function removeDaily(c: WriteScope, id: string) {
  const old = await findDaily(c, id);
  const res = await c.db
    .from("hifz_logs")
    .delete()
    .eq("id", id)
    .eq("student_id", old.student_id)
    .eq("madrasa_id", c.tenant)
    .select("id")
    .single();
  if (res.error) throw res.error;
  await auditHifz(c, "daily.delete", id);
}
async function saveDaily(
  c: WriteScope,
  body: any,
  options: { editId?: string; insertOnly?: boolean },
) {
  const records = body.records;
  if (
    !validDate(body.current_date) ||
    !Array.isArray(records) ||
    !records.length ||
    records.length > 500
  )
    throw new EntryError("তারিখ ও শিক্ষার্থী দিন।");
  const students = new Set<string>();
  for (const r of records) {
    if (!r || students.has(r.student_id))
      throw new EntryError("একই শিক্ষার্থীর একাধিক এন্ট্রি।");
    member(c, r.student_id);
    students.add(r.student_id);
  }
  const profiles = await storedRows(c.db, c.tenant, "profile", [...students]);
  const written = [];
  for (const record of records) {
    const date = body.current_date;
    let old: any;
    if (options.editId) {
      old = await findDaily(c, options.editId);
      if (old.student_id !== record.student_id) throw denied();
    } else {
      const q = c.db
        .from("hifz_logs")
        .select("*")
        .eq("madrasa_id", c.tenant)
        .eq("student_id", record.student_id)
        .eq("log_date", date);
      const r = await q.maybeSingle();
      if (r.error) throw r.error;
      old = r.data;
    }
    if (
      (record.existing_id && record.existing_id !== old?.id) ||
      (old && options.insertOnly)
    )
      throw new EntryError(
        "এই তারিখের লগ পরিবর্তিত হয়েছে বা আগে থেকেই আছে।",
        409,
      );
    const revision = parseHifzLogNotes(old?.notes).meta.entry_revision;
    // Replaying an acknowledged draft is a no-op, not a second increment. A
    // much later replay cannot replace another teacher's subsequent correction.
    if (old && record.change_id && revision === record.change_id) {
      written.push(old);
      continue;
    }
    const stale = () =>
      new EntryError(
        "লগটি পরিবর্তিত হয়েছে। সর্বশেষ এন্ট্রি দেখে আবার সংরক্ষণ করুন।",
        409,
      );
    if (
      "expected_revision" in record &&
      (record.expected_revision !== (revision ?? null) ||
        (old && !revision && !record.existing_id))
    )
      throw stale();
    const level =
      profiles.find((p) => p.student_id === record.student_id)?.hifz_category ||
      "sabqi";
    const category =
      record.student_category === "khatmi" && level === "khatmi"
        ? "khatmi"
        : old
          ? dailyFields(old).student_category
          : level;
    if (record.student_category && record.student_category !== category)
      throw new EntryError("স্তর পরিবর্তিত হয়েছে। প্রোফাইল যাচাই করুন।", 409);
    const fields = dailyRecord(
      {
        ...record,
        change_id: record.change_id ?? randomUUID(),
        student_category: category,
      },
      old || {},
    );
    const row: any = {
      ...fields,
      madrasa_id: c.tenant,
      student_id: record.student_id,
      log_date: date,
      teacher_id: c.teacherId || old?.teacher_id || null,
    };
    const write = (r: any) => {
      const q = c.db.from("hifz_logs");
      if (!old) return q.insert(r).select("*").maybeSingle();
      const update = q
        .update(r)
        .eq("id", old.id)
        .eq("madrasa_id", c.tenant)
        .eq("student_id", record.student_id);
      // Never put the plaintext comment in a query string. The version marker
      // gives us a CAS even on a pre-migration notes-only installation.
      const scoped = revision
        ? update.like("notes", `%"entry_revision":"${revision}"%`)
        : old.notes == null
          ? update.is("notes", null)
          : update.not("notes", "like", '%"entry_revision":%');
      return scoped.select("*").maybeSingle();
    };
    let result = await write(row);
    if (schemaMissing(result.error)) {
      const legacy = { ...row };
      for (const k of Object.keys(dailyDefaults)) delete legacy[k];
      result = await write(legacy);
    }
    if (result.error?.code === "23505" || (!result.error && !result.data))
      throw stale();
    if (result.error) throw result.error;
    written.push(result.data);
    await auditHifz(c, old ? "daily.edit" : "daily.create", result.data.id);
  }
  return written;
}
export async function writeHifz(
  c: WriteScope,
  body: any,
  options: { editId?: string; insertOnly?: boolean } = {},
) {
  const kind = body?.kind || "daily";
  if (kind === "daily") return saveDaily(c, body, options);
  if (kind === "profile") {
    const v = parseInput(profileInput, body);
    member(c, v.student_id);
    partner(c, v.default_sabina_partner_id, v.student_id);
    if (v.hifz_category === "khatmi") {
      const logs = await childLogs(c.db, c.tenant, "hifz_logs", [v.student_id]);
      const p = {
        ...emptyProfile(v.student_id, c.tenant),
        ...v,
        completed_hifz_paras: c.legacy?.[v.student_id]?.completed_hifz_paras,
      };
      if (memorizedParas(p, logs).length < 30)
        throw new EntryError("খতমী স্তরের আগে ৩০ পারা সম্পূর্ণ হতে হবে।");
    }
    await putRow(
      c,
      "profile",
      {
        ...v,
        madrasa_id: c.tenant,
        profile_configured: true,
        updated_at: new Date().toISOString(),
      },
      "upsert",
    );
    await auditHifz(c, kind, v.student_id);
    return v;
  }
  if (kind === "weekly") {
    const v = parseInput(weeklyInput, body);
    member(c, v.student_id);
    const name = partner(c, v.listener_student_id, v.student_id);
    const { detail, total } = results(v);
    const row = {
      id: weeklyId(c.tenant, v.student_id, v.sabina_date),
      madrasa_id: c.tenant,
      student_id: v.student_id,
      listener_student_id: v.listener_student_id,
      listener_name: name,
      verified_by_teacher_id: c.teacherId || null,
      sabina_date: v.sabina_date,
      assigned_para_from: v.para_from,
      assigned_para_to: v.para_to,
      para_breakdown: v.status === "completed" ? detail : [],
      total_mistakes: v.status === "completed" ? total : 0,
      total_paras_recited: v.status === "completed" ? detail.length : 0,
      status: v.status,
      remarks: v.remarks,
    };
    await putRow(c, kind, row, "upsert");
    await auditHifz(c, kind, row.id);
    return row;
  }
  if (!["special", "sitting", "finish"].includes(kind))
    throw new EntryError("অজানা এন্ট্রি।");
  if (kind === "special") {
    const v = parseInput(specialInput, body),
      p = v.participants,
      ids = participantIds(p),
      names: Record<string, string> = {};
    for (const id of ids) names[id] = fullName(member(c, id));
    const n = p.listener_group_ids.length + p.teacher_listener_ids.length;
    if (
      !n ||
      new Set([...ids, ...p.teacher_listener_ids]).size !==
        ids.length + p.teacher_listener_ids.length ||
      (v.listening_mode === "one_to_one" &&
        (ids.length !== 2 || p.teacher_listener_ids.length || n !== 1)) ||
      (v.listening_mode === "one_to_many" &&
        (n < 2 || p.reciter_group_ids.length !== 1)) ||
      (v.listening_mode === "group_to_group" &&
        (!p.listener_group_ids.length || p.teacher_listener_ids.length))
    )
      throw new EntryError("শ্রবণ পদ্ধতি অনুযায়ী পৃথক পাঠকারী ও শ্রোতা বাছুন।");
    if (p.teacher_listener_ids.length) {
      const teachers = await rows(() =>
        c.db
          .from("teachers")
          .select("id,first_name,last_name")
          .eq("madrasa_id", c.tenant)
          .in("id", p.teacher_listener_ids),
      );
      if (teachers.length !== p.teacher_listener_ids.length) throw denied();
      for (const t of teachers) names[t.id] = fullName(t);
    }
    const existing = (await storedRows(c.db, c.tenant, "special")).find(
      (e) => e.id === v.id,
    );
    if (existing) {
      if (
        existing.created_by !== c.actor ||
        existing.title !== v.title ||
        participantIds(existing.participants).some((id) => !ids.includes(id))
      )
        throw new EntryError("আয়োজনটির পরিচয় মেলেনি।", 409);
      return existing;
    }
    const row = {
      ...v,
      madrasa_id: c.tenant,
      participants: { ...p, names },
      revision: v.id,
      session_logs: [],
      status: "ongoing",
      created_by: c.actor,
    };
    await putRow(c, "special", row, "insert");
    await auditHifz(c, kind, v.id);
    return row;
  }
  const { event_id } = parseInput(finishInput, body);
  const e: SpecialSabina | undefined = (
    await storedRows(c.db, c.tenant, "special")
  ).find((e) => e.id === event_id);
  if (
    !e ||
    !participantIds(e.participants).every((id) =>
      c.roster.some((s) => s.id === id),
    )
  )
    throw denied();
  let logs = e.session_logs;
  if (kind === "sitting") {
    const v = parseInput(sittingInput, body),
      p = e.participants;
    const reciters =
      e.listening_mode === "one_to_one"
        ? participantIds(p)
        : p.reciter_group_ids;
    const listeners =
      e.listening_mode === "one_to_one"
        ? participantIds(p)
        : [...p.listener_group_ids, ...p.teacher_listener_ids];
    if (
      !reciters.includes(v.reciter_id) ||
      v.listener_ids.some(
        (id) => id === v.reciter_id || !listeners.includes(id),
      )
    )
      throw denied();
    if (logs.some((s) => s.id === v.id)) return e;
    if (e.status === "completed")
      throw new EntryError("সমাপ্ত সবিনায় নতুন আসর যোগ করা যাবে না।", 409);
    const day = toDhakaDateString(new Date(v.timestamp));
    if (day < e.start_date || day > e.end_date)
      throw new EntryError("আসরের তারিখ আয়োজনের সময়সীমার বাইরে।");
    const { detail, total } = results(v);
    const sitting: Sitting = {
      id: v.id,
      session_label: v.session_label,
      reciter_id: v.reciter_id,
      listener_ids: [...new Set(v.listener_ids)],
      para_from: v.para_from,
      para_to: v.para_to,
      para_wise_mistakes: detail,
      total_mistakes: total,
      timestamp: v.timestamp,
    };
    logs = [...logs, sitting];
  } else if (e.status === "completed") return e;
  const row = {
    ...e,
    session_logs: logs,
    status: kind === "finish" ? "completed" : "ongoing",
    revision: randomUUID(),
  };
  await putRow(c, "special", row, "append", e.revision);
  await auditHifz(c, kind, e.id);
  return row;
}
