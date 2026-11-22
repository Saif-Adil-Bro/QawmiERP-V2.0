// Pre-migration settings may be readable through old tenant-wide RLS. Seal each
// record separately and authenticate its namespace, tenant and key before use.
import {
  createHmac,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import {
  getStructuredMadrasaSetting,
  saveStructuredMadrasaSetting,
} from "../structured-config";
import { EntryError } from "./entries";
export const stores = {
  profile: ["hifz_student_profiles", "student_id"],
  weekly: ["hifz_weekly_sabina", "id"],
  special: ["hifz_special_sabina", "id"],
} as const;
export type Kind = keyof typeof stores;
const ns = (k: Kind) => `hifz_${k}_v1`;
export const schemaMissing = (e: any) =>
  ["42P01", "42703", "PGRST204", "PGRST205"].includes(e?.code);
function key(tenant: string, k: Kind) {
  const secret =
    process.env.HIFZ_STORAGE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;
  if (!secret)
    throw new EntryError("অফলাইন সেটিংসের সার্ভার কী কনফিগার করুন।", 503);
  return createHmac("sha256", secret)
    .update(`${ns(k)}:${tenant}`)
    .digest();
}
function settingKey(tenant: string, k: Kind, pk: string) {
  return createHmac("sha256", key(tenant, k))
    .update(`record:${pk}`)
    .digest("hex");
}
function seal(tenant: string, k: Kind, id: string, row: any) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", key(tenant, k), iv);
  c.setAAD(Buffer.from(id));
  const data = Buffer.concat([
    c.update(JSON.stringify(row), "utf8"),
    c.final(),
  ]).toString("base64");
  return { iv: iv.toString("hex"), tag: c.getAuthTag().toString("hex"), data };
}
function unseal(tenant: string, k: Kind, id: string, v: any) {
  const c = createDecipheriv(
    "aes-256-gcm",
    key(tenant, k),
    Buffer.from(v.iv, "hex"),
  );
  c.setAAD(Buffer.from(id));
  c.setAuthTag(Buffer.from(v.tag, "hex"));
  const row = JSON.parse(
    Buffer.concat([
      c.update(Buffer.from(v.data, "base64")),
      c.final(),
    ]).toString(),
  );
  if (
    row.madrasa_id !== tenant ||
    settingKey(tenant, k, row[stores[k][1]]) !== id
  )
    throw new Error("Invalid setting");
  return row;
}
async function pages(q: () => any, sort: string) {
  const out: any[] = [];
  for (let n = 0; ; n += 500) {
    const { data, error } = await q()
      .order(sort)
      .range(n, n + 499);
    if (schemaMissing(error) && !n) return [];
    if (error) throw error;
    out.push(...data);
    if (data.length < 500) return out;
  }
}
export async function storedRows(
  db: any,
  t: string,
  k: Kind,
  ids?: string[],
  columns = "*",
) {
  const [table, pk] = stores[k];
  const fetchRows = (batch?: string[]) =>
    pages(() => {
      const q = db.from(table).select(columns).eq("madrasa_id", t);
      return batch ? q.in("student_id", batch) : q;
    }, pk);
  const batches: Promise<any[]>[] = [];
  if (ids) {
    for (let n = 0; n < ids.length; n += 80)
      batches.push(fetchRows(ids.slice(n, n + 80)));
  } else batches.push(fetchRows());
  const [archive, ...canonical] = await Promise.all([
    pages(
      () =>
        db
          .from("madrasa_settings")
          .select("setting_key,setting_value")
          .eq("madrasa_id", t)
          .eq("namespace", ns(k)),
      "setting_key",
    ),
    ...batches,
  ]);
  const map = new Map<string, any>(),
    allowed = ids && new Set(ids);
  for (const a of archive) {
    const r = unseal(t, k, a.setting_key, a.setting_value);
    if (!allowed || allowed.has(r.student_id)) map.set(r[pk], r);
  }
  for (const r of canonical.flat()) {
    const old = map.get(r[pk]);
    map.set(
      r[pk],
      k === "profile" && old && !r.profile_configured
        ? {
            ...r,
            hifz_category: old.hifz_category,
            previously_memorized_paras: old.previously_memorized_paras,
            default_sabina_partner_id: old.default_sabina_partner_id,
          }
        : r,
    );
  }
  return [...map.values()];
}
export type WriteScope = {
  db: any;
  tenant: string;
  actor: string;
  teacherId?: string | null;
  roster: any[];
  legacy?: Record<string, any>;
};
/** Only submit whitelisted fields. In particular never upsert another tenant's
 * arbitrary event id. SQL updates are tenant scoped; append is compare-and-swap. */
export async function putRow(
  c: WriteScope,
  k: Kind,
  row: any,
  mode: "insert" | "upsert" | "append",
  revision?: string,
) {
  const [table, pk] = stores[k],
    id = row[pk];
  if (row.madrasa_id !== c.tenant) throw new Error("Tenant mismatch");
  let q = c.db.from(table);
  const write =
    mode === "insert"
      ? q.insert(row)
      : mode === "append"
        ? q
            .update({
              session_logs: row.session_logs,
              status: row.status,
              revision: row.revision,
            })
            .eq("madrasa_id", c.tenant)
            .eq("id", id)
            .eq("revision", revision)
        : q.upsert(row, {
            onConflict: k === "weekly" ? "student_id,sabina_date" : pk,
          });
  const { data, error } = await write.select(pk).maybeSingle();
  if (!error && data) return;
  if (error && !schemaMissing(error)) throw error;
  // An event created before migration stays in its original store, including
  // during concurrent post-migration session appends. Never fork the event.
  if (!error && mode !== "append") throw new EntryError("সংরক্ষণ হয়নি।", 409);
  const keyId = settingKey(c.tenant, k, id);
  const archived = await getStructuredMadrasaSetting<any>(
    c.tenant,
    ns(k),
    keyId,
    true,
  );
  const encrypted = seal(c.tenant, k, keyId, row);
  if (mode === "append") {
    if (
      !archived.value ||
      unseal(c.tenant, k, keyId, archived.value).revision !== revision
    )
      throw new EntryError("অন্য এন্ট্রি এসেছে। আবার চেষ্টা করুন।", 409);
    const res = await c.db
      .from("madrasa_settings")
      .update({
        setting_value: encrypted,
        updated_at: new Date().toISOString(),
        updated_by: c.actor,
      })
      .eq("madrasa_id", c.tenant)
      .eq("namespace", ns(k))
      .eq("setting_key", keyId)
      .eq("setting_value->>iv", archived.value.iv)
      .select("setting_key")
      .maybeSingle();
    if (res.error) throw res.error;
    if (!res.data) throw new EntryError("সবিনা পরিবর্তিত হয়েছে।", 409);
  } else if (
    !(
      await saveStructuredMadrasaSetting(
        c.tenant,
        ns(k),
        keyId,
        encrypted,
        c.actor,
        mode === "insert",
      )
    ).ok
  )
    throw new EntryError("সংরক্ষণ হয়নি। মাদরাসার সেটিংস যাচাই করুন।", 503);
}
