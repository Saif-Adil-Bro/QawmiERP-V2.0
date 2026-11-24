import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Madrasa-level JSON stores.
 *
 * ঐতিহাসিকভাবে পূর্ণ মেটাডেটা (security profiles, session/fee metadata) `madrasas.registration_no`
 * কলামে JSON আকারে রাখা হতো — যার ফলে মাদ্রাসার আসল নিবন্ধন নম্বর প্রতিবার overwrite হয়ে হারিয়ে যেত।
 *
 * এখন ডেডিকেটেড কলাম ব্যবহার করা হয়:
 *   - "security" -> madrasas.security_metadata   (roles, user security profiles, approvals, audit logs)
 *   - "meta"     -> madrasas.metadata            (sessions, receipts counter, student profiles ইত্যাদি)
 *
 * কলাম না থাকলে (পুরোনো ডেটাবেজ) স্বয়ংক্রিয়ভাবে আগের registration_no আচরণে fallback করে,
 * কিন্তু সেক্ষেত্রেও আসল নিবন্ধন নম্বর নষ্ট না করে `reg_no` কলামে সংরক্ষণের চেষ্টা করে।
 */
export type JsonStoreKind = "security" | "meta";

const COLUMN: Record<JsonStoreKind, string> = {
  security: "security_metadata",
  meta: "metadata",
};

function parseJsonBlob(raw: unknown): Record<string, any> | null {
  if (!raw) return null;
  if (typeof raw === "object") return Array.isArray(raw) ? null : raw as Record<string, any>;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function cloneJsonObject<T extends Record<string, any>>(obj: T): T {
  try {
    return structuredClone(obj);
  } catch {
    return JSON.parse(JSON.stringify(obj));
  }
}

const getRequestJsonStoreCache = cache(
  () => new Map<string, Promise<Record<string, any>>>()
);

/**
 * Uncached direct reader for a madrasa JSON store.
 * Always hits the database directly (used on cache miss or inside read-modify-write).
 */
export async function readJsonStoreUncached(
  madrasaId: string,
  kind: JsonStoreKind,
  strict = false
): Promise<Record<string, any>> {
  if (!madrasaId) return {};
  const adminClient = await createAdminClient();
  const column = COLUMN[kind];

  // 1) Try the dedicated JSON/JSONB column first.
  const primary = await adminClient
    .from("madrasas")
    .select(`registration_no, ${column}`)
    .eq("id", madrasaId)
    .maybeSingle();

  if (!primary.error && primary.data) {
    const value = (primary.data as any)[column];
    const parsed = parseJsonBlob(value);
    if (parsed) return parsed;
    if (strict && value) throw new Error("Invalid security profile store");
    // Column exists but empty -> also honour legacy registration_no blob (one-time upgrade path)
    const legacy = parseJsonBlob((primary.data as any).registration_no);
    if (
      strict &&
      String((primary.data as any).registration_no || "").trimStart().startsWith("{") &&
      !legacy
    )
      throw new Error("Invalid legacy profile store");
    return legacy || {};
  }

  if (strict && primary.error && !["42703", "PGRST204"].includes(primary.error.code))
    throw new Error(primary.error.message);
  // 2) Column missing in this database -> legacy behaviour.
  const legacyOnly = await adminClient
    .from("madrasas")
    .select("registration_no")
    .eq("id", madrasaId)
    .maybeSingle();

  if (strict && (legacyOnly.error || !legacyOnly.data))
    throw new Error("Cannot load security profile");
  const raw = legacyOnly.data?.registration_no,
    parsed = parseJsonBlob(raw);
  if (strict && String(raw || "").trimStart().startsWith("{") && !parsed)
    throw new Error("Invalid legacy profile store");
  return parsed || {};
}

/**
 * Reads a madrasa JSON store with per-request deduplication and write-through cache invalidation.
 * Returns a fresh clone so in-place mutations by callers never poison the request cache.
 */
export async function readJsonStore(
  madrasaId: string,
  kind: JsonStoreKind,
  strict = false
): Promise<Record<string, any>> {
  if (!madrasaId) return {};
  const storeMap = getRequestJsonStoreCache();
  const key = `${madrasaId}:${kind}:${strict ? "1" : "0"}`;
  let pending = storeMap.get(key);
  if (!pending) {
    pending = readJsonStoreUncached(madrasaId, kind, strict).catch((err) => {
      storeMap.delete(key);
      throw err;
    });
    storeMap.set(key, pending);
  }
  const data = await pending;
  return cloneJsonObject(data);
}

/**
 * Writes a madrasa JSON store and updates the request-local cache so subsequent
 * reads in the same request never observe stale data.
 */
export async function writeJsonStore(
  madrasaId: string,
  kind: JsonStoreKind,
  value: Record<string, any>
): Promise<boolean> {
  if (!madrasaId) return false;
  const adminClient = await createAdminClient();
  const column = COLUMN[kind];
  const storeMap = getRequestJsonStoreCache();

  const updateRequestCache = (nextVal: Record<string, any>) => {
    const snap = cloneJsonObject(nextVal);
    storeMap.set(`${madrasaId}:${kind}:0`, Promise.resolve(snap));
    storeMap.set(`${madrasaId}:${kind}:1`, Promise.resolve(snap));
  };

  // 1) Preferred: dedicated column.
  const primary = await adminClient
    .from("madrasas")
    .update({ [column]: value })
    .eq("id", madrasaId)
    .select("id")
    .maybeSingle();

  if (!primary.error) {
    updateRequestCache(value);
    return true;
  }

  // 2) Fallback: legacy registration_no JSON blob (never destroy a real registration number).
  const current = await adminClient
    .from("madrasas")
    .select("registration_no, reg_no")
    .eq("id", madrasaId)
    .maybeSingle();

  const rawRegistration = current.data?.registration_no;
  const isJsonBlob =
    typeof rawRegistration === "string" && rawRegistration.trim().startsWith("{");

  // আসল নিবন্ধন নম্বর থাকলে সেটি reg_no কলামে সরিয়ে রক্ষা করুন
  if (rawRegistration && !isJsonBlob && !current.data?.reg_no) {
    try {
      await adminClient
        .from("madrasas")
        .update({ reg_no: rawRegistration })
        .eq("id", madrasaId);
    } catch {
      /* best effort */
    }
  }

  const { error } = await adminClient
    .from("madrasas")
    .update({ registration_no: JSON.stringify(value) })
    .eq("id", madrasaId);

  if (error) {
    console.error(`Error writing madrasa ${kind} store:`, error);
    storeMap.delete(`${madrasaId}:${kind}:0`);
    storeMap.delete(`${madrasaId}:${kind}:1`);
    return false;
  }
  updateRequestCache(value);
  return true;
}

/** Optimistic-concurrency helper for shared JSON stores (avoids silent lost updates). */
export async function mergeJsonStore(
  madrasaId: string,
  kind: JsonStoreKind,
  updater: (current: Record<string, any>) => Record<string, any>
): Promise<Record<string, any> | null> {
  const current = await readJsonStoreUncached(madrasaId, kind);
  const next = updater(current || {});
  const ok = await writeJsonStore(madrasaId, kind, next);
  return ok ? next : null;
}

