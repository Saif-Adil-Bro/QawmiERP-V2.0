import { createAdminClient } from "@/lib/supabase/admin";
import { getMadrasaMetadataUncached } from "@/lib/sessions";
import { patchTenantJson } from "@/lib/tenant-json-patch";
import {
  historicalPunch,
  punchKey,
  uniquePunchLogs,
  type BiometricDevice as Device,
  type BiometricPunchLog as Log,
  type BiometricUserMapping as Mapping,
  type ParsedPunchRecord as Punch,
} from "@/lib/biometric";

export type BiometricIngestOutcome = {
  totalProcessed: number;
  attendanceDaysCreated: number;
  duplicates: number;
  skipped: number;
  failed: number;
  unmappedCount: number;
  unknownIds: string[];
};

export function isBiometricStorageMissingError(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  if (!error) return false;
  const code = String(error.code || "").trim();
  if (
    code === "42883" ||
    code === "PGRST202" ||
    code === "42P01" ||
    code === "PGRST205"
  ) {
    return true;
  }
  const msg = String(error.message || "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("could not find the function") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  );
}

function audienceAllows(
  audience: string,
  userType: "student" | "teacher",
): boolean {
  if (!audience || audience === "all") return true;
  if (audience === "student" || audience === "students")
    return userType === "student";
  if (audience === "teacher" || audience === "teachers")
    return userType === "teacher";
  return true;
}

async function applyAttendanceFallback(
  tenant: string,
  mapping: Mapping,
  date: string,
): Promise<"created" | "already_present" | "conflict" | "error"> {
  const db = await createAdminClient();
  if (mapping.user_type === "student") {
    const { data: existing, error: readErr } = await db
      .from("attendance")
      .select("id, status, leave_request_id")
      .eq("madrasa_id", tenant)
      .eq("student_id", mapping.target_id)
      .eq("date", date)
      .maybeSingle();
    if (readErr) return "error";
    if (existing) {
      if (existing.leave_request_id) return "conflict";
      if (existing.status === "Present") return "already_present";
      return "conflict";
    }
    const { error: insErr } = await db.from("attendance").insert({
      madrasa_id: tenant,
      student_id: mapping.target_id,
      date,
      status: "Present",
      leave_request_id: null,
      notes: "বায়োমেট্রিক পাঞ্চ",
    });
    if (insErr) {
      if (insErr.code === "23505") return "already_present";
      return "error";
    }
    return "created";
  }

  const { data: existing, error: readErr } = await db
    .from("teacher_attendance")
    .select("id, status, leave_request_id")
    .eq("madrasa_id", tenant)
    .eq("teacher_id", mapping.target_id)
    .eq("date", date)
    .maybeSingle();
  if (readErr) return "error";
  if (existing) {
    if (existing.leave_request_id) return "conflict";
    if (existing.status === "Present") return "already_present";
    return "conflict";
  }
  const { error: insErr } = await db.from("teacher_attendance").insert({
    madrasa_id: tenant,
    teacher_id: mapping.target_id,
    date,
    status: "Present",
    leave_request_id: null,
  });
  if (insErr) {
    if (insErr.code === "23505") return "already_present";
    return "error";
  }
  return "created";
}

async function postFallback(
  tenant: string,
  deviceId: string,
  source: Log["sync_mode"],
  records: Punch[],
  audience: string,
  credential: { token?: string; sn?: string } | null,
  replay: { id: string; mapping: string; target: string } | null,
): Promise<BiometricIngestOutcome> {
  const meta = await getMadrasaMetadataUncached(tenant, true);
  const devices: Device[] = Array.isArray(meta.biometric_devices)
    ? meta.biometric_devices
    : [];
  const dev = devices.find((d) => d.id === deviceId);
  if (!dev) throw Error("ডিভাইসটি পাওয়া যায়নি।");
  if (credential) {
    if (dev.status !== "active") throw Error("ডিভাইসটি সক্রিয় নয়।");
    if (credential.token && dev.secret_token !== credential.token)
      throw Error("ডিভাইস টোকেন মেলেনি।");
    if (credential.sn && dev.serial_number !== credential.sn)
      throw Error("ডিভাইস সিরিয়াল মেলেনি।");
  }

  const mappings: Mapping[] = Array.isArray(meta.biometric_mappings)
    ? meta.biometric_mappings
    : [];
  const existingLogs = uniquePunchLogs(
    Array.isArray(meta.biometric_logs) ? meta.biometric_logs : [],
  );
  const seenKeys = new Set<string>(
    existingLogs
      .filter((l) => l.device_id === deviceId && (!replay || l.id !== replay.id))
      .map((l) => {
        const hp = historicalPunch(l);
        return punchKey(deviceId, l.device_user_id, hp ? hp.timestamp : l.punch_time);
      }),
  );

  const outcome: BiometricIngestOutcome = {
    totalProcessed: 0,
    attendanceDaysCreated: 0,
    duplicates: 0,
    skipped: 0,
    failed: 0,
    unmappedCount: 0,
    unknownIds: [],
  };
  const unknownSet = new Set<string>();
  const newLogs: Log[] = [];
  const now = new Date().toISOString();

  for (const r of records) {
    const key = punchKey(deviceId, r.device_user_id, r.timestamp);
    if (!replay && seenKeys.has(key)) {
      outcome.duplicates++;
      continue;
    }
    seenKeys.add(key);

    let matched: Mapping | undefined;
    if (replay) {
      matched = mappings.find(
        (m) => m.id === replay.mapping && m.target_id === replay.target,
      );
    } else {
      const candidates = mappings.filter(
        (m) =>
          m.device_user_id === r.device_user_id ||
          (m.rfid_card_no && m.rfid_card_no === r.device_user_id),
      );
      if (candidates.length === 1) matched = candidates[0];
    }

    if (!matched) {
      outcome.unmappedCount++;
      unknownSet.add(r.device_user_id);
      if (!replay) {
        newLogs.push({
          id: crypto.randomUUID(),
          madrasa_id: tenant,
          device_id: deviceId,
          device_name: dev.name,
          device_user_id: r.device_user_id,
          user_type: "unknown",
          punch_time: r.timestamp,
          punch_date: r.date,
          punch_type: r.punch_type || "auto",
          status: "unmapped",
          parser_version: 2,
          sync_mode: source,
          raw_data: r.raw_line,
          created_at: now,
        });
      }
      continue;
    }

    if (!audienceAllows(audience, matched.user_type)) {
      outcome.skipped++;
      continue;
    }

    const attResult = await applyAttendanceFallback(tenant, matched, r.date);
    if (attResult === "created" || attResult === "already_present") {
      outcome.totalProcessed++;
      if (attResult === "created") outcome.attendanceDaysCreated++;
      newLogs.push({
        id: replay?.id || crypto.randomUUID(),
        madrasa_id: tenant,
        device_id: deviceId,
        device_name: dev.name,
        device_user_id: r.device_user_id,
        user_type: matched.user_type,
        target_id: matched.target_id,
        target_name: matched.target_name,
        target_identifier: matched.target_identifier,
        class_name: matched.class_name,
        punch_time: r.timestamp,
        punch_date: r.date,
        punch_type: r.punch_type || "auto",
        status: "processed",
        parser_version: 2,
        sync_mode: source,
        raw_data: r.raw_line,
        created_at: now,
      });
    } else if (attResult === "conflict") {
      if (replay) {
        outcome.failed++;
      } else {
        outcome.skipped++;
      }
      newLogs.push({
        id: replay?.id || crypto.randomUUID(),
        madrasa_id: tenant,
        device_id: deviceId,
        device_name: dev.name,
        device_user_id: r.device_user_id,
        user_type: matched.user_type,
        target_id: matched.target_id,
        target_name: matched.target_name,
        target_identifier: matched.target_identifier,
        class_name: matched.class_name,
        punch_time: r.timestamp,
        punch_date: r.date,
        punch_type: r.punch_type || "auto",
        status: "error",
        issue: "বিদ্যমান হাজিরা (অনুপস্থিত/বিলম্ব/ছুটি) অক্ষুণ্ণ রাখা হয়েছে",
        parser_version: 2,
        sync_mode: source,
        raw_data: r.raw_line,
        created_at: now,
      });
    } else {
      outcome.failed++;
    }
  }

  outcome.unknownIds = Array.from(unknownSet);

  await patchTenantJson(tenant, (currentMeta) => {
    const currentLogs: Log[] = Array.isArray(currentMeta.biometric_logs)
      ? currentMeta.biometric_logs
      : [];
    let updatedLogs = currentLogs;
    if (replay && newLogs.length > 0) {
      const replacement = newLogs[0];
      const exists = currentLogs.some((l) => l.id === replay.id);
      updatedLogs = exists
        ? currentLogs.map((l) => (l.id === replay.id ? { ...l, ...replacement } : l))
        : [replacement, ...currentLogs];
    } else if (newLogs.length > 0) {
      updatedLogs = [...newLogs, ...currentLogs].slice(0, 5000);
    }

    const currentDevices: Device[] = Array.isArray(currentMeta.biometric_devices)
      ? currentMeta.biometric_devices
      : [];
    const updatedDevices = currentDevices.map((d) => {
      if (d.id !== deviceId) return d;
      return {
        ...d,
        last_sync_at: now,
        ...(source === "cloud_push" ? { last_ping_at: now } : {}),
        updated_at: now,
      };
    });

    return {
      patch: {
        biometric_logs: updatedLogs,
        biometric_devices: updatedDevices,
      },
      result: null,
    };
  });

  return outcome;
}

async function post(
  tenant: string,
  device: string,
  source: Log["sync_mode"],
  records: Punch[],
  audience: string,
  credential: { token?: string; sn?: string } | null,
  replay: { id: string; mapping: string; target: string } | null,
): Promise<BiometricIngestOutcome> {
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
  if (error) {
    if (isBiometricStorageMissingError(error)) {
      return postFallback(
        tenant,
        device,
        source,
        records,
        audience,
        credential,
        replay,
      );
    }
    throw Error(error.message || "পাঞ্চ সেভ হয়নি।");
  }
  if (!data) throw Error("পাঞ্চ সেভ হয়নি।");
  return data as BiometricIngestOutcome;
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
  if (row.error && !isBiometricStorageMissingError(row.error)) {
    throw Error(row.error.message);
  }
  const log: Log | undefined =
    (!row.error && row.data) ||
    uniquePunchLogs(
      (await getMadrasaMetadataUncached(tenant, true)).biometric_logs || [],
    ).find((l) => l.id === id && l.device_id === device);
  if (!log) throw Error("পাঞ্চ পাওয়া যায়নি।");
  if (log.status === "processed")
    return {
      totalProcessed: 0,
      attendanceDaysCreated: 0,
      duplicates: 0,
      skipped: 0,
      failed: 0,
      unmappedCount: 0,
      unknownIds: [],
    };
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

export interface ReplayableUnmappedCandidate {
  log: Log;
  mapping: Mapping;
  punch: Punch;
}

export async function collectReplayableUnmappedPunches(
  tenant: string,
  dateFilter?: string,
): Promise<{
  candidates: ReplayableUnmappedCandidate[];
  summary: {
    totalPunches: number;
    uniquePeople: number;
    uniqueDates: string[];
    peopleNames: string[];
  };
}> {
  const db = await createAdminClient();
  const meta = await getMadrasaMetadataUncached(tenant, true);
  const mappings: Mapping[] = Array.isArray(meta.biometric_mappings)
    ? meta.biometric_mappings
    : [];

  let pgLogs: Log[] = [];
  let q = db
    .from("biometric_punch_events")
    .select("*")
    .eq("madrasa_id", tenant)
    .neq("status", "processed")
    .order("punch_time", { ascending: false })
    .limit(500);
  if (dateFilter) q = q.eq("punch_date", dateFilter);

  const pgRes = await q;
  if (!pgRes.error && Array.isArray(pgRes.data)) {
    pgLogs = pgRes.data as Log[];
  } else if (pgRes.error && !isBiometricStorageMissingError(pgRes.error)) {
    throw Error(pgRes.error.message || "আনম্যাপড পাঞ্চ তালিকা পড়া যায়নি।");
  }

  const legacyLogs: Log[] = Array.isArray(meta.biometric_logs)
    ? meta.biometric_logs
    : [];
  const merged = uniquePunchLogs([...pgLogs, ...legacyLogs]);

  const candidates: ReplayableUnmappedCandidate[] = [];
  const peopleIds = new Set<string>();
  const peopleNamesSet = new Set<string>();
  const datesSet = new Set<string>();

  for (const log of merged) {
    if (log.status === "processed") continue;
    if (log.issue?.startsWith("মূল লাইন")) continue;
    const punch = historicalPunch(log);
    if (!punch) continue;
    if (dateFilter && punch.date !== dateFilter) continue;

    const matched = mappings.filter(
      (m) =>
        m.device_user_id === log.device_user_id ||
        (m.rfid_card_no && m.rfid_card_no === log.device_user_id),
    );
    if (matched.length !== 1) continue;

    const mapping = matched[0];
    candidates.push({ log, mapping, punch });
    peopleIds.add(mapping.target_id);
    if (mapping.target_name) peopleNamesSet.add(mapping.target_name);
    datesSet.add(punch.date);
  }

  return {
    candidates,
    summary: {
      totalPunches: candidates.length,
      uniquePeople: peopleIds.size,
      uniqueDates: Array.from(datesSet).sort(),
      peopleNames: Array.from(peopleNamesSet),
    },
  };
}
