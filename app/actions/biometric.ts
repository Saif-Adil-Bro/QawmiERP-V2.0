"use server";

import { revalidatePath } from "next/cache";
import { writeGuard } from "@/lib/action-authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMadrasaMetadata, hydrateStudentWithMetadata } from "@/lib/sessions";
import { rows } from "@/lib/portal/queries";
import { toDhakaDateString } from "@/lib/date-utils";
import { patchTenantJson } from "@/lib/tenant-json-patch";
import { storeDevice } from "@/lib/biometric-registry";
import {
  collectReplayableUnmappedPunches,
  ingestPunches,
  isBiometricStorageMissingError,
  replayPunch,
} from "@/lib/biometric-ingest";
import {
  computeUnifiedBiometricPunchCounters,
  getDeviceConnectionStatus,
  parsePunchReport,
  type BiometricDevice as Device,
  type BiometricPunchLog as Log,
  type BiometricUserMapping as Mapping,
} from "@/lib/biometric";

async function operator() {
  const g = await writeGuard("biometric");
  if (!g.allowed || !g.madrasaId)
    throw Error("বায়োমেট্রিক ব্যবস্থাপনার অনুমতি নেই।");
  return { tenant: g.madrasaId, audit: g.logAudit };
}
const message = (e: unknown) =>
  e instanceof Error ? e.message : "কাজ সম্পন্ন হয়নি। আবার চেষ্টা করুন।";
const refresh = () => revalidatePath("/dashboard/attendance/devices");
function attendanceChanged() {
  refresh();
  for (const p of ["", "/students", "/teachers", "/reports"])
    revalidatePath("/dashboard/attendance" + p);
}

function extractNumericPin(raw: unknown): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (/^\d{1,32}$/.test(value)) return value;
  const suffix = /^[A-Za-z]+[-_](\d{1,32})$/.exec(value)?.[1];
  return suffix || "";
}

// Compute device card totals, today's header counter, and log page rows from
// the exact same unified deduplicated punch store (biometric_punch_events + legacy book).
export async function getBiometricSnapshot(
  date?: string,
  deviceId = "all",
  before?: { time: string; id: string },
) {
  const { tenant } = await operator(),
    meta = await getMadrasaMetadata(tenant, true);
  const db = await createAdminClient(),
    today = toDhakaDateString();
  const size = 100;

  if (before) {
    if (
      !/^[A-Za-z0-9_-]{1,160}$/.test(before.id) ||
      !Number.isFinite(Date.parse(before.time))
    ) {
      throw Error("লগের পৃষ্ঠা মেলেনি।");
    }
  }

  // Fetch all tenant PG punch events in bounded pages so counts and log page
  // always share one single source of truth (graceful fallback if table absent).
  const pgRows: Log[] = [];
  const pageSize = 1000;
  const maxPages = 20;
  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const res = await db
      .from("biometric_punch_events")
      .select("*")
      .eq("madrasa_id", tenant)
      .order("punch_time", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (res.error) {
      if (isBiometricStorageMissingError(res.error)) {
        break;
      }
      throw Error("পাঞ্চের খাতা পড়া যায়নি।");
    }
    const batch = Array.isArray(res.data) ? (res.data as Log[]) : [];
    pgRows.push(...batch);
    if (batch.length < pageSize) break;
  }

  const legacyRows: Log[] = Array.isArray(meta.biometric_logs)
    ? meta.biometric_logs
    : [];

  const { unifiedLogs, deviceCounts, unverifiedCounts, totalPunchesToday } =
    computeUnifiedBiometricPunchCounters(pgRows, legacyRows, today);

  const beforeMs = before ? Date.parse(before.time) : null;
  const filteredLogs =
    date === undefined
      ? []
      : unifiedLogs.filter(
          (l) =>
            (!date || l.punch_date === date) &&
            (deviceId === "all" || l.device_id === deviceId) &&
            (!before ||
              Date.parse(l.punch_time) < (beforeMs as number) ||
              (Date.parse(l.punch_time) === (beforeMs as number) &&
                l.id < before.id)),
        );

  const devices: Device[] = (meta.biometric_devices || []).map((d: Device) => ({
    ...d,
    total_punches_count: deviceCounts.get(d.id) || 0,
    unverified_history_count: unverifiedCounts.get(d.id) || 0,
  }));
  const mappings: Mapping[] = meta.biometric_mappings || [],
    active = devices.filter((d) => d.status === "active");
  return {
    devices,
    mappings,
    logs: filteredLogs.slice(0, size),
    hasMore: filteredLogs.length > size,
    stats: {
      madrasaId: tenant,
      totalDevices: devices.length,
      activeDevices: active.length,
      onlineDevices: active.filter(
        (d) => getDeviceConnectionStatus(d).status === "online",
      ).length,
      waitingDevices: active.filter(
        (d) => getDeviceConnectionStatus(d).status === "waiting",
      ).length,
      totalMappings: mappings.length,
      studentMappings: mappings.filter((m) => m.user_type === "student").length,
      teacherMappings: mappings.filter((m) => m.user_type === "teacher").length,
      totalPunchesToday,
    },
  };
}

export async function saveBiometricDevice(input: Partial<Device>) {
  try {
    const { tenant, audit } = await operator(),
      device = await storeDevice(tenant, input);
    const logged = await audit({
      action: input.id ? "BIOMETRIC_DEVICE_UPDATED" : "BIOMETRIC_DEVICE_ADDED",
      entityType: "biometric_device",
      entityId: device.id,
      entityLabel: device.name,
      summary: `ডিভাইস ${input.id ? "সম্পাদনা" : "নিবন্ধন"}: ${device.name}`,
    });
    refresh();
    return {
      success: true,
      device,
      warning: logged.success ? "" : "ডিভাইস সেভ হয়েছে, অডিট লগ যাচাই করুন।",
    };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function deleteBiometricDevice(
  id: string,
  serial: string,
  observedName: string,
) {
  try {
    const { tenant, audit } = await operator();
    const name = await patchTenantJson(tenant, (meta) => {
      const devices: Device[] = meta.biometric_devices || [],
        d = devices.find(
          (d) =>
            d.id === id &&
            d.serial_number === serial &&
            d.name === observedName,
        );
      if (!d) throw Error("নিশ্চিত করা ডিভাইসটি মেলেনি। কিছুই মোছা হয়নি।");
      return {
        patch: { biometric_devices: devices.filter((d) => d.id !== id) },
        result: d.name,
      };
    });
    const logged = await audit({
      action: "BIOMETRIC_DEVICE_DELETED",
      entityType: "biometric_device",
      entityId: id,
      entityLabel: name,
      summary: `ডিভাইস মোছা হয়েছে: ${name}`,
    });
    refresh();
    return {
      success: true,
      warning: logged.success ? "" : "ডিভাইস মুছেছে, অডিট লগ যাচাই করুন।",
    };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function testBiometricDeviceConnection(id: string) {
  try {
    const { tenant, audit } = await operator(),
      meta = await getMadrasaMetadata(tenant, true);
    const d: Device = meta.biometric_devices?.find((d: Device) => d.id === id);
    if (!d) throw Error("ডিভাইসটি পাওয়া যায়নি।");
    const conn = getDeviceConnectionStatus(d),
      isOnline = d.status === "active" && conn.status === "online";
    const msg = `${d.name}: ${isOnline ? "লাইভ সংযোগ আছে" : "লাইভ সংযোগ নিশ্চিত নয়"}। ${conn.lastSeenText}`;
    const logged = await audit({
      action: "BIOMETRIC_CONNECTION_TESTED",
      entityType: "biometric_device",
      entityId: id,
      summary: msg,
      metadata: { online: isOnline },
    });
    return {
      isOnline,
      message: msg + (logged.success ? "" : " — অডিট লগ যাচাই করুন।"),
    };
  } catch (e) {
    return { isOnline: false, message: message(e) };
  }
}

async function roster(tenant: string) {
  const db = await createAdminClient();
  const [ss, ts, meta] = await Promise.all([
    rows(() =>
      db.from("students").select("*,classes(name)").eq("madrasa_id", tenant),
    ),
    rows(() => db.from("teachers").select("*").eq("madrasa_id", tenant)),
    getMadrasaMetadata(tenant, true),
  ]);
  const staffMetaById = new Map<string, { biometric_user_id?: string; staff_id_code?: string }>();
  if (Array.isArray(meta.staff_members)) {
    for (const sm of meta.staff_members) {
      if (sm?.id) staffMetaById.set(String(sm.id), sm);
    }
  }
  return [
    ...ss.map((row) => {
      const s = hydrateStudentWithMetadata(row, meta),
        code = String(s.student_id || row.roll_number || "").trim();
      const profileBioId = (
        meta.student_profiles?.[row.id] as
          | { biometric_user_id?: string }
          | undefined
      )?.biometric_user_id;
      const pin =
        extractNumericPin(row.biometric_user_id) ||
        extractNumericPin(profileBioId) ||
        extractNumericPin(s.student_id) ||
        extractNumericPin(row.roll_number);
      return {
        id: row.id,
        type: "student" as const,
        name: `${s.first_name} ${s.last_name || ""}`.trim(),
        code,
        pin,
        className: s.class_name || row.classes?.name || "",
      };
    }),
    ...ts.map((t) => {
      const sm = staffMetaById.get(String(t.id));
      const code = String(t.staff_id_code || sm?.staff_id_code || "").trim();
      const pin =
        extractNumericPin(t.biometric_user_id) ||
        extractNumericPin(sm?.biometric_user_id) ||
        extractNumericPin(code);
      return {
        id: t.id,
        type: "teacher" as const,
        name: `${t.first_name} ${t.last_name || ""}`.trim(),
        code,
        pin,
        className: String(t.designation || ""),
      };
    }),
  ];
}

export async function getBiometricRoster() {
  return roster((await operator()).tenant);
}

export async function autoGenerateUserMappings() {
  try {
    const { tenant, audit } = await operator(),
      people = await roster(tenant),
      counts = new Map<string, number>();
    for (const p of people) {
      if (p.pin) counts.set(p.pin, (counts.get(p.pin) || 0) + 1);
    }
    const res = await patchTenantJson(tenant, (meta) => {
      const maps: Mapping[] = meta.biometric_mappings || [],
        used = new Set(maps.flatMap((m) => [m.device_user_id, m.rfid_card_no])),
        targets = new Set(maps.map((m) => m.target_id));
      const add = people
        .filter(
          (p) =>
            /^\d{1,32}$/.test(p.pin) &&
            counts.get(p.pin) === 1 &&
            !used.has(p.pin) &&
            !targets.has(p.id),
        )
        .map((p) => ({
          id: crypto.randomUUID(),
          madrasa_id: tenant,
          device_user_id: p.pin,
          user_type: p.type,
          target_id: p.id,
          target_name: p.name,
          target_identifier: p.code,
          class_name: p.className,
          created_at: new Date().toISOString(),
        }));
      const existing = people.filter((p) => targets.has(p.id)).length;
      const noPin = people.filter(
        (p) => !targets.has(p.id) && !/^\d{1,32}$/.test(p.pin),
      ).length;
      const ambiguous = people.length - add.length - existing - noPin;
      return {
        patch: add.length
          ? { biometric_mappings: [...maps, ...add] }
          : undefined,
        result: {
          success: true,
          addedCount: add.length,
          existingCount: existing,
          message: `নতুন ম্যাপিং ${add.length}টি। আগেই ম্যাপড ${existing}, সংখ্যাসূচক ID নেই ${noPin}, দ্ব্যর্থক/ব্যবহৃত ID ${ambiguous}। অন্য ID নিজে ম্যাপ করুন।`,
        },
      };
    });
    await audit({
      action: "BIOMETRIC_AUTO_MAPPED",
      entityType: "biometric_mapping",
      entityLabel: "স্বয়ংক্রিয় ম্যাপিং",
      summary: res.message,
      metadata: {
        addedCount: res.addedCount,
        existingCount: res.existingCount,
      },
    });
    refresh();
    return res;
  } catch (e) {
    return { success: false, message: message(e) };
  }
}

export async function saveBiometricUserMapping(input: Partial<Mapping>) {
  try {
    const { tenant, audit } = await operator(),
      pin = input.device_user_id?.trim();
    if (!pin || !/^\d{1,32}$/.test(pin)) throw Error("সংখ্যায় মেশিন ID দিন।");
    const p = (await roster(tenant)).find(
      (p) => p.id === input.target_id && p.type === input.user_type,
    );
    if (!p) throw Error("প্রতিষ্ঠানের শিক্ষার্থী বা শিক্ষক নির্বাচন করুন।");
    const saved = await patchTenantJson(tenant, (meta) => {
      const maps: Mapping[] = meta.biometric_mappings || [],
        rest = maps.filter((m) => m.id !== input.id);
      if (input.id && maps.length === rest.length)
        throw Error("ম্যাপিংটি আর নেই। রিফ্রেশ করুন।");
      if (
        rest.some((m) =>
          [m.device_user_id, m.rfid_card_no].some(
            (k) => k && (k === pin || k === input.rfid_card_no?.trim()),
          ),
        )
      )
        throw Error(
          "এই মেশিন/কার্ড ID আগে থেকেই ম্যাপ করা। বিদ্যমান ম্যাপিং সম্পাদনা করুন।",
        );
      const m: Mapping = {
        id: input.id || crypto.randomUUID(),
        madrasa_id: tenant,
        device_user_id: pin,
        user_type: p.type,
        target_id: p.id,
        target_name: p.name,
        target_identifier: p.code,
        class_name: p.className,
        rfid_card_no: input.rfid_card_no?.trim(),
        fingerprint_registered: input.fingerprint_registered,
        face_registered: input.face_registered,
        created_at:
          maps.find((m) => m.id === input.id)?.created_at ||
          new Date().toISOString(),
      };
      return { patch: { biometric_mappings: [m, ...rest] }, result: m };
    });
    await audit({
      action: input.id
        ? "BIOMETRIC_MAPPING_UPDATED"
        : "BIOMETRIC_MAPPING_SAVED",
      entityType: "biometric_mapping",
      entityId: saved.id,
      entityLabel: `${saved.target_name} (ID: ${saved.device_user_id})`,
      summary: `বায়োমেট্রিক ম্যাপিং ${input.id ? "সম্পাদনা" : "সংরক্ষণ"}: ${saved.target_name} → মেশিন ID ${saved.device_user_id}`,
    });
    refresh();
    return { success: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function deleteBiometricUserMapping(id: string) {
  try {
    const { tenant, audit } = await operator();
    const removed = await patchTenantJson(tenant, (meta) => {
      const maps: Mapping[] = meta.biometric_mappings || [];
      const found = maps.find((m) => m.id === id);
      if (!found) throw Error("ম্যাপিংটি পাওয়া যায়নি।");
      return {
        patch: { biometric_mappings: maps.filter((m) => m.id !== id) },
        result: found,
      };
    });
    await audit({
      action: "BIOMETRIC_MAPPING_DELETED",
      entityType: "biometric_mapping",
      entityId: id,
      entityLabel: `${removed.target_name} (ID: ${removed.device_user_id})`,
      summary: `বায়োমেট্রিক ম্যাপিং মুছে ফেলা হয়েছে: ${removed.target_name} (ID: ${removed.device_user_id})`,
    });
    refresh();
    return { success: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function importBiometricLogsFromFile(
  text: string,
  fileName: string,
  deviceId: string,
  audience = "all",
) {
  try {
    const { tenant, audit } = await operator();
    if (!deviceId?.trim()) {
      return {
        success: false,
        message: "ইমপোর্টের আগে একটি নিবন্ধিত ডিভাইস নির্বাচন করুন।",
      };
    }
    const meta = await getMadrasaMetadata(tenant, true);
    const devices: Device[] = Array.isArray(meta.biometric_devices)
      ? meta.biometric_devices
      : [];
    if (!devices.some((d) => d.id === deviceId)) {
      return {
        success: false,
        message: "নির্বাচিত ডিভাইসটি প্রতিষ্ঠানের তালিকায় পাওয়া যায়নি।",
      };
    }
    if (text.length > 800000) throw Error("ছোট ফাইলে ভাগ করে ইমপোর্ট করুন।");
    const { records, rejected } = parsePunchReport(text);
    const errors = rejected.map((r) => `লাইন ${r.line}: ${r.reason}`);
    if (!records.length)
      return {
        success: false,
        message: "কোনো বৈধ পাঞ্চ নেই।",
        errors,
        totalParsed: 0,
        rejectedCount: rejected.length,
      };
    const out = await ingestPunches(
      tenant,
      deviceId,
      records,
      "usb_import",
      audience,
    );
    await audit({
      action: "BIOMETRIC_FILE_IMPORTED",
      entityType: "biometric_device",
      entityId: deviceId,
      summary: `ইমপোর্ট: হাজিরা ${out.totalProcessed}, অপেক্ষায় ${out.unmappedCount}, বাতিল ${rejected.length}, ডুপ্লিকেট ${out.duplicates}`,
      metadata: {
        fileName,
        failed: out.failed,
        unmappedIds: out.unknownIds,
        rejectedCount: rejected.length,
      },
    });
    attendanceChanged();
    return {
      ...out,
      success: out.failed === 0,
      errors,
      totalParsed: records.length,
      rejectedCount: rejected.length,
      uniqueDates: [...new Set(records.map((r) => r.date))],
      message: `${fileName}: নিশ্চিত পাঞ্চ ${out.totalProcessed}, নতুন ব্যক্তি-দিন ${out.attendanceDaysCreated}, ম্যাপিং অপেক্ষায় ${out.unmappedCount}${out.unknownIds.length ? " (ID: " + out.unknownIds.join(", ") + ")" : ""}, ডুপ্লিকেট ${out.duplicates}, বাতিল ${rejected.length}, ফিল্টারে বাদ ${out.skipped}, লেখা ব্যর্থ ${out.failed}।`,
    };
  } catch (e) {
    return { success: false, message: message(e) };
  }
}

export async function replayBiometricEvent(
  device: string,
  id: string,
  mapping: string,
  target: string,
) {
  try {
    const { tenant, audit } = await operator();
    const r = await replayPunch(tenant, device, id, mapping, target);
    if (r.totalProcessed || r.failed)
      await audit({
        action: "BIOMETRIC_PUNCH_REPLAYED",
        entityType: "biometric_device",
        entityId: device,
        summary: `পুনঃপ্রক্রিয়া: নিশ্চিত ${r.totalProcessed}, ব্যর্থ ${r.failed}`,
      });
    attendanceChanged();
    return {
      success: !r.failed,
      message: r.failed
        ? "বিদ্যমান হাজিরা বা ম্যাপিং যাচাই করুন।"
        : `পুনঃপ্রক্রিয়ায় ${r.totalProcessed}টি পাঞ্চ নিশ্চিত হয়েছে।`,
    };
  } catch (e) {
    return { success: false, message: message(e) };
  }
}

export async function previewUnmappedBiometricReplayAction(
  dateFilter?: string,
) {
  try {
    const { tenant } = await operator();
    const { summary } = await collectReplayableUnmappedPunches(
      tenant,
      dateFilter || undefined,
    );
    return {
      success: true,
      ...summary,
    };
  } catch (e) {
    return {
      success: false,
      totalPunches: 0,
      uniquePeople: 0,
      uniqueDates: [] as string[],
      peopleNames: [] as string[],
      message: message(e),
    };
  }
}

export async function replayAllUnmappedBiometricEventsAction(
  dateFilter?: string,
) {
  try {
    const { tenant, audit } = await operator();
    const { candidates, summary } = await collectReplayableUnmappedPunches(
      tenant,
      dateFilter || undefined,
    );
    if (candidates.length === 0) {
      return {
        success: true,
        replayed: 0,
        attendanceDaysCreated: 0,
        failed: 0,
        message: "পুনঃপ্রক্রিয়া করার মতো কোনো ম্যাপড পুরোনো পাঞ্চ নেই।",
      };
    }

    let replayed = 0;
    let attendanceDaysCreated = 0;
    let failed = 0;
    const failureReasons = new Set<string>();

    for (const item of candidates) {
      try {
        const res = await replayPunch(
          tenant,
          item.log.device_id,
          item.log.id,
          item.mapping.id,
          item.mapping.target_id,
        );
        replayed += Number(res.totalProcessed || 0);
        attendanceDaysCreated += Number(
          "attendanceDaysCreated" in res ? res.attendanceDaysCreated || 0 : 0,
        );
        failed += Number(res.failed || 0);
      } catch (err) {
        failed++;
        failureReasons.add(message(err));
      }
    }

    const reasonList = Array.from(failureReasons).slice(0, 3);
    await audit({
      action: "BIOMETRIC_UNMAPPED_BATCH_REPLAYED",
      entityType: "biometric_punch",
      entityLabel: dateFilter ? `পুনঃপ্রক্রিয়া (${dateFilter})` : "সকল তারিখ",
      summary: `পুরোনো আনম্যাপড পাঞ্চ পুনঃপ্রক্রিয়া: নিশ্চিত ${replayed}টি, নতুন ব্যক্তি-দিন ${attendanceDaysCreated}, ব্যর্থ/বিদ্যমান হাজিরা সংরক্ষিত ${failed}টি`,
      metadata: {
        dateFilter: dateFilter || "all",
        dates: summary.uniqueDates,
        peopleCount: summary.uniquePeople,
        replayed,
        attendanceDaysCreated,
        failed,
        ...(reasonList.length ? { failureReasons: reasonList } : {}),
      },
    });
    attendanceChanged();

    return {
      success: failed === 0,
      replayed,
      attendanceDaysCreated,
      failed,
      message: `পুনঃপ্রক্রিয়া সম্পন্ন: ${replayed}টি পাঞ্চ নিশ্চিত, ${attendanceDaysCreated}টি নতুন হাজিরা যুক্ত হয়েছে${failed > 0 ? `, ${failed}টি বিদ্যমান হাজিরা/ম্যাপিং যাচাই বাকি${reasonList.length ? ` (${reasonList.join("; ")})` : ""}` : ""}।`,
    };
  } catch (e) {
    return {
      success: false,
      replayed: 0,
      attendanceDaysCreated: 0,
      failed: 0,
      message: message(e),
    };
  }
}
