import { createAdminClient } from "@/lib/supabase/admin";
import { getMadrasaMetadataUncached } from "@/lib/sessions";
import {
  historicalPunch,
  punchKey,
  uniquePunchLogs,
  type BiometricPunchLog as Log,
  type ParsedPunchRecord as Punch,
} from "@/lib/biometric";

type Outcome = {
  totalProcessed: number;
  attendanceDaysCreated: number;
  duplicates: number;
  skipped: number;
  failed: number;
  unmappedCount: number;
  unknownIds: string[];
};
async function post(
  tenant: string,
  device: string,
  source: Log["sync_mode"],
  records: Punch[],
  audience: string,
  credential: object | null,
  replay: object | null,
) {
  const db = await createAdminClient();
  const { data, error } = await db.rpc("biometric_apply_events", {
    t: tenant,
    dev: device,
    src: source,
    audience,
    credential,
    replay,
    events: records.map((r) => ({
      pin: r.device_user_id,
      instant: r.timestamp,
      kind: r.punch_type || "auto",
    })),
  });
  if (error || !data) throw Error(error?.message || "পাঞ্চ সেভ হয়নি।");
  return data as Outcome;
}

export async function ingestPunches(
  tenant: string,
  device: string,
  records: Punch[],
  mode: Log["sync_mode"],
  audience = "all",
  credential?: { token?: string; sn?: string },
) {
  const meta = await getMadrasaMetadataUncached(tenant, true);
  // Frozen pre-upgrade history is never purged/relabelled. Only match legacy
  // USB timestamps backed by a valid raw line. New keys are unique in PG.
  const legacy = new Set(
    uniquePunchLogs(meta.biometric_logs || [])
      .filter((l) => l.device_id === device && historicalPunch(l))
      .map((l) => punchKey(device, l.device_user_id, l.punch_time)),
  );
  const fresh = records.filter(
    (r) => !legacy.has(punchKey(device, r.device_user_id, r.timestamp)),
  );
  const out = await post(
    tenant,
    device,
    mode,
    fresh,
    audience,
    credential || null,
    null,
  );
  return { ...out, duplicates: out.duplicates + records.length - fresh.length };
}

export async function replayPunch(
  tenant: string,
  device: string,
  id: string,
  mapping: string,
  target: string,
) {
  const db = await createAdminClient();
  const row = await db
    .from("biometric_punch_events")
    .select("*")
    .match({ id, device_id: device, madrasa_id: tenant })
    .maybeSingle();
  if (row.error) throw Error(row.error.message);
  const log: Log | undefined =
    row.data ||
    uniquePunchLogs(
      (await getMadrasaMetadataUncached(tenant, true)).biometric_logs || [],
    ).find((l) => l.id === id && l.device_id === device);
  if (!log) throw Error("পাঞ্চ পাওয়া যায়নি।");
  if (log.status === "processed") return { totalProcessed: 0, failed: 0 };
  const punch = historicalPunch(log);
  if (!punch) throw Error("পাঞ্চের মূল সময় যাচাই করা যায়নি।");
  return post(
    tenant,
    device,
    log.sync_mode,
    [{ ...punch, punch_type: log.punch_type }],
    "all",
    null,
    { id, mapping, target },
  );
}
