import {
  getStructuredMadrasaSetting,
  saveStructuredMadrasaSetting,
} from "@/lib/structured-config";
import { childTag, openCase, sealCase, type SealedCase } from "./sealed";
import {
  recentRecovery,
  type HealthCase,
  type HealthRecord,
  type TimelineEntry,
  type PortalCase,
  priority,
} from "./model";
const NS = "student_health_v1",
  TABLE = "student_health_records";
export class HealthError extends Error {}
const missing = (e: any) => ["42P01", "PGRST205"].includes(e?.code);
const conflict = () =>
  new HealthError(
    "নথিটি ইতিমধ্যে পরিবর্তিত হয়েছে। নতুন তথ্য দেখে আবার চেষ্টা করুন।",
  );
// Keep the original PostgREST code: access failures must never switch write stores.
async function pages(query: () => any, optional = false): Promise<any[]> {
  const list = [];
  for (let n = 0; ; n += 500) {
    const { data, error } = await query()
      .order("id")
      .range(n, n + 499);
    if (optional && !n && missing(error)) return [];
    if (error) throw error;
    list.push(...data);
    if (data.length < 500) return list;
  }
}
type Scope = {
  id?: string;
  child?: string;
  activeOnly?: boolean;
  timeline?: boolean;
  portal?: boolean;
};
type Stored = { row: HealthCase; iv?: string };
async function legacy(db: any, tenant: string, f: Scope): Promise<Stored[]> {
  const found = f.id
    ? await getStructuredMadrasaSetting<SealedCase>(tenant, NS, f.id, true)
    : null;
  const archive = f.id
    ? found?.found
      ? [{ setting_key: f.id, setting_value: found.value }]
      : []
    : await pages(() => {
        const q = db
          .from("madrasa_settings")
          .select("setting_key,setting_value")
          .eq("madrasa_id", tenant)
          .eq("namespace", NS);
        return f.child
          ? q.eq("setting_value->>child", childTag(tenant, f.child))
          : q;
      }, true);
  return archive
    .map(({ setting_key, setting_value: v }) => ({
      row: openCase(tenant, setting_key, v),
      iv: v.iv,
    }))
    .filter(
      ({ row: r }) =>
        (!f.child || r.student_id === f.child) &&
        (!f.activeOnly || r.status !== "recovered"),
    );
}
async function canonical(db: any, tenant: string, f: Scope): Promise<Stored[]> {
  const records: HealthRecord[] = await pages(() => {
    let q = db.from(TABLE).select("*").eq("madrasa_id", tenant);
    if (f.id) q = q.eq("id", f.id);
    if (f.child) q = q.eq("student_id", f.child);
    if (f.activeOnly) q = q.neq("status", "recovered");
    return q;
  }, true);
  const visible = records.filter(
    (r) => !f.portal || r.status !== "recovered" || recentRecovery(r),
  );
  const visits = new Map<string, TimelineEntry[]>();
  if (f.timeline !== false)
    for (let n = 0; n < visible.length; n += 80) {
      const ids = visible.slice(n, n + 80).map((r) => r.id);
      const list: TimelineEntry[] = await pages(() =>
        db
          .from("student_health_timeline")
          .select("*")
          .eq("madrasa_id", tenant)
          .in("record_id", ids)
          .order("created_at", { ascending: false }),
      );
      for (const v of list) {
        const group = visits.get(v.record_id) || [];
        group.push(v);
        visits.set(v.record_id, group);
      }
    }
  return visible.map((r) => ({
    row: { ...r, timeline: visits.get(r.id) || [] },
  }));
}
async function read(db: any, tenant: string, f: Scope): Promise<Stored[]> {
  // A cutover doesn't hide or fork old cases: they remain editable in their original
  // store. New cases always use SQL once installed, regardless of older cases.
  const [sql, archive] = await Promise.all([
    canonical(db, tenant, f),
    legacy(db, tenant, f),
  ]);
  return [...sql, ...archive].sort(
    (a, b) => Date.parse(b.row.updated_at) - Date.parse(a.row.updated_at),
  );
}
export async function readCases(db: any, tenant: string, f: Scope = {}) {
  return (await read(db, tenant, f)).map((v) => v.row);
}
export async function findCase(
  db: any,
  tenant: string,
  id: string,
  child?: string,
) {
  const [found] = await read(db, tenant, { id, child, timeline: false });
  if (!found) throw new HealthError("স্বাস্থ্য নথিটি পাওয়া যায়নি।");
  return found;
}
async function replaceArchive(
  db: any,
  old: Stored,
  row: HealthCase,
  actor: string,
) {
  const { data, error } = await db
    .from("madrasa_settings")
    .update({
      setting_value: sealCase(row),
      updated_by: actor,
      updated_at: new Date().toISOString(),
    })
    .eq("madrasa_id", row.madrasa_id)
    .eq("namespace", NS)
    .eq("setting_key", row.id)
    .eq("setting_value->>iv", old.iv)
    .select("setting_key")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw conflict();
}
export async function writeVisit(
  db: any,
  r: HealthRecord,
  v: TimelineEntry,
  previous?: Stored,
) {
  let fallback = !!previous?.iv;
  if (!previous) {
    const { error } = await db
      .from(TABLE)
      .select("id")
      .eq("madrasa_id", r.madrasa_id)
      .limit(1);
    if (error && !missing(error)) throw error;
    fallback = missing(error);
  }
  if (fallback) {
    const row = { ...r, timeline: [v, ...(previous?.row.timeline || [])] };
    if (previous) await replaceArchive(db, previous, row, v.logged_by);
    else if (
      !(
        await saveStructuredMadrasaSetting(
          r.madrasa_id,
          NS,
          r.id,
          sealCase(row),
          v.logged_by,
        )
      ).ok
    )
      throw new HealthError(
        "স্বাস্থ্য নথি সংরক্ষণ করা যায়নি। মাদরাসা সেটিংস টেবিলটি যাচাই করুন।",
      );
  } else {
    const { error } = await db.rpc("write_student_health_visit", {
      p_record: r,
      p_visit: v,
      p_expected: previous?.row.updated_at || null,
    });
    if (error?.code === "40001") throw conflict();
    if (error) throw error;
  }
}
export async function stamp(
  db: any,
  previous: Stored,
  field: "guardian_acknowledged_at" | "guardian_notified_at",
  actor: string,
) {
  const row = previous.row,
    time = new Date().toISOString();
  if (previous.iv) {
    // A simultaneous receipt/ack can safely be merged, but not into a newer clinical update.
    let old = previous;
    for (let attempt = 0; ; attempt++) {
      if (field === "guardian_acknowledged_at" && old.row[field]) return;
      try {
        await replaceArchive(db, old, { ...old.row, [field]: time }, actor);
        return;
      } catch (e) {
        if (!(e instanceof HealthError) || attempt > 1) throw e;
      }
      old = await findCase(db, row.madrasa_id, row.id, row.student_id);
      if (old.row.updated_at !== row.updated_at || !old.iv) throw conflict();
    }
  }
  const { data, error } = await db
    .from(TABLE)
    .update({ [field]: time })
    .eq("id", row.id)
    .eq("madrasa_id", row.madrasa_id)
    .eq("student_id", row.student_id)
    .eq("updated_at", row.updated_at)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw conflict();
}
/** Only call with an already-authorized selected child. Project explicitly, never spread staff notes/identities into snapshots. */
export async function childHealth(
  db: any,
  tenant: string,
  child: string,
): Promise<PortalCase[]> {
  const records = await readCases(db, tenant, { child, portal: true });
  return records
    .filter(
      (r) =>
        r.student_id === child &&
        (r.status !== "recovered" || recentRecovery(r)),
    )
    .sort((a, b) => priority(b) - priority(a))
    .map((r) => ({
      id: r.id,
      student_id: child,
      illness_type: r.illness_type,
      status: r.status,
      severity: r.severity,
      doctor_or_hospital: r.doctor_or_hospital,
      treatment_notes: r.treatment_notes,
      guardian_acknowledged_at: r.guardian_acknowledged_at,
      updated_at: r.updated_at,
      recovered_at: r.recovered_at,
      timeline: r.timeline.map(
        ({ id, status, note, temperature, treatment_notes, created_at }) => ({
          id,
          status,
          note,
          temperature,
          treatment_notes,
          created_at,
        }),
      ),
    }));
}
