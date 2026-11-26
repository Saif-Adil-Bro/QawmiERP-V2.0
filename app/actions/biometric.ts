"use server";

import { revalidatePath } from "next/cache";
import { writeGuard } from "@/lib/action-authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMadrasaMetadata, hydrateStudentWithMetadata } from "@/lib/sessions";
import { rows } from "@/lib/portal/queries";
import { toDhakaDateString } from "@/lib/date-utils";
import { patchTenantJson } from "@/lib/tenant-json-patch";
import { storeDevice } from "@/lib/biometric-registry";
import { ingestPunches, replayPunch } from "@/lib/biometric-ingest";
import {
  historicalPunch,
  getDeviceConnectionStatus,
  parsePunchReport,
  uniquePunchLogs,
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

// The registry tab needs one summary, not a roster and a day of logs. For the
// log tab use the last displayed (instant,id) as a stable tenant-scoped cursor.
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
  let q = db
    .from("biometric_punch_events")
    .select("*")
    .eq("madrasa_id", tenant);
  if (date) q = q.eq("punch_date", date);
  if (deviceId !== "all") q = q.eq("device_id", deviceId);
  if (before) {
    if (
      !/^[A-Za-z0-9_-]{1,160}$/.test(before.id) ||
      !Number.isFinite(Date.parse(before.time))
    )
      throw Error("লগের পৃষ্ঠা মেলেনি।");
    const iso = new Date(before.time).toISOString();
    q = q.or(
      `punch_time.lt.${iso},and(punch_time.eq.${iso},id.lt.${before.id})`,
    );
  }
  const [recent, totals] = await Promise.all([
    date === undefined
      ? { data: [], error: null }
      : q
          .order("punch_time", { ascending: false })
          .order("id", { ascending: false })
          .limit(size + 1),
    db.rpc("biometric_event_counts", { t: tenant, today }),
  ]);
  if (recent.error || totals.error) throw Error("পাঞ্চের খাতা পড়া যায়নি।");
  const legacy = uniquePunchLogs(meta.biometric_logs || []),
    counts = new Map<string, number>(),
    uncertain = new Map<string, number>();
  let totalPunchesToday = 0;
  for (const r of totals.data || []) {
    counts.set(r.device, Number(r.total));
    totalPunchesToday += Number(r.today_count);
  }
  for (const l of legacy) {
    if (historicalPunch(l)) {
      counts.set(l.device_id, (counts.get(l.device_id) || 0) + 1);
      if (l.punch_date === today) totalPunchesToday++;
    } else uncertain.set(l.device_id, (uncertain.get(l.device_id) || 0) + 1);
  }
  const old =
    date === undefined
      ? []
      : legacy.filter(
          (l) =>
            (!date || l.punch_date === date) &&
            (deviceId === "all" || deviceId === l.device_id) &&
            (!before ||
              Date.parse(l.punch_time) < Date.parse(before.time) ||
              (Date.parse(l.punch_time) === Date.parse(before.time) &&
                l.id < before.id)),
        );
  const all = uniquePunchLogs([...((recent.data as Log[]) || []), ...old]).sort(
    (a, b) =>
      Date.parse(b.punch_time) - Date.parse(a.punch_time) ||
      (a.id > b.id ? -1 : 1),
  );
  const devices: Device[] = (meta.biometric_devices || []).map((d: Device) => ({
    ...d,
    total_punches_count: counts.get(d.id) || 0,
    unverified_history_count: uncertain.get(d.id) || 0,
  }));
  const mappings: Mapping[] = meta.biometric_mappings || [],
    active = devices.filter((d) => d.status === "active");
  return {
    devices,
    mappings,
    logs: all.slice(0, size),
    hasMore: all.length > size,
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
  return [
    ...ss.map((row) => {
      const s = hydrateStudentWithMetadata(row, meta),
        code = String(s.student_id || "").trim();
      const pin = String(
        row.biometric_user_id ||
          (
            meta.student_profiles?.[row.id] as
              { biometric_user_id?: string } | undefined
          )?.biometric_user_id ||
          (/^\d+$/.test(code)
            ? code
            : /^[A-Za-z]+[-_](\d+)$/.exec(code)?.[1]) ||
          "",
      );
      return {
        id: row.id,
        type: "student" as const,
        name: `${s.first_name} ${s.last_name || ""}`.trim(),
        code,
        pin,
        className: s.class_name || row.classes?.name || "",
      };
    }),
    ...ts.map((t) => ({
      id: t.id,
      type: "teacher" as const,
      name: `${t.first_name} ${t.last_name || ""}`.trim(),
      code: String(t.staff_id_code || ""),
      pin: String(t.biometric_user_id || ""),
      className: "",
    })),
  ];
}
export async function getBiometricRoster() {
  return roster((await operator()).tenant);
}

export async function autoGenerateUserMappings() {
  try {
    const { tenant } = await operator(),
      people = await roster(tenant),
      counts = new Map<string, number>();
    for (const p of people) counts.set(p.pin, (counts.get(p.pin) || 0) + 1);
    return await patchTenantJson(tenant, (meta) => {
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
      return {
        patch: add.length
          ? { biometric_mappings: [...maps, ...add] }
          : undefined,
        result: {
          success: true,
          message: `নতুন ম্যাপিং ${add.length}টি। আগেই ম্যাপড ${existing}, সংখ্যাসূচক ID নেই ${noPin}, দ্ব্যর্থক/ব্যবহৃত ID ${people.length - add.length - existing - noPin}। অন্য ID নিজে ম্যাপ করুন।`,
        },
      };
    });
  } catch (e) {
    return { success: false, message: message(e) };
  }
}
export async function saveBiometricUserMapping(input: Partial<Mapping>) {
  try {
    const { tenant } = await operator(),
      pin = input.device_user_id?.trim();
    if (!pin || !/^\d{1,32}$/.test(pin)) throw Error("সংখ্যায় মেশিন ID দিন।");
    const p = (await roster(tenant)).find(
      (p) => p.id === input.target_id && p.type === input.user_type,
    );
    if (!p) throw Error("প্রতিষ্ঠানের শিক্ষার্থী বা শিক্ষক নির্বাচন করুন।");
    await patchTenantJson(tenant, (meta) => {
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
      return { patch: { biometric_mappings: [m, ...rest] }, result: null };
    });
    refresh();
    return { success: true };
  } catch (e) {
    return { error: message(e) };
  }
}
export async function deleteBiometricUserMapping(id: string) {
  try {
    const { tenant } = await operator();
    await patchTenantJson(tenant, (meta) => {
      const maps: Mapping[] = meta.biometric_mappings || [];
      if (!maps.some((m) => m.id === id)) throw Error("ম্যাপিংটি পাওয়া যায়নি।");
      return {
        patch: { biometric_mappings: maps.filter((m) => m.id !== id) },
        result: null,
      };
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
    if (text.length > 800000) throw Error("ছোট ফাইলে ভাগ করে ইমপোর্ট করুন।");
    const { records, rejected } = parsePunchReport(text);
    const errors = rejected.map((r) => `লাইন ${r.line}: ${r.reason}`);
    if (!records.length)
      return { success: false, message: "কোনো বৈধ পাঞ্চ নেই।", errors };
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
      metadata: { failed: out.failed },
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
