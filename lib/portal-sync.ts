import { apiUrl } from "./api-url";
import {
  generateOfflineId,
  getOfflineDb,
  type OfflineOutboxItem,
  type OfflineRecord,
} from "./offlineDb";
import { checkIsOnline, MAX_SYNC_RETRIES } from "./syncManager";
import { getOfflineAuthSession, resolvePortalTypeFromRole } from "./offline-auth";

export type PortalSyncType = "student" | "teacher";

export interface PortalSyncResult {
  ok: boolean;
  portal: PortalSyncType;
  syncedAt: number;
  counts: Record<string, number>;
  error?: string;
}

export type SyncProgressCallback = (percent: number, label: string) => void;

function getAuthHeaders(accessToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  let token = accessToken;
  if (!token && typeof window !== "undefined") {
    token =
      window.localStorage.getItem("qawmi_access_token") ||
      window.localStorage.getItem("access_token") ||
      undefined;
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const apiKey = process.env.NEXT_PUBLIC_MOBILE_API_KEY?.trim();
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }
  return headers;
}

async function fetchJsonSafe(path: string, headers: Record<string, string>): Promise<any | null> {
  try {
    const res = await fetch(apiUrl(path), {
      method: "GET",
      headers,
      credentials: "include",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function normalizeRows(rows: unknown): OfflineRecord[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object" && (r as any).id != null))
    .map((r) => ({
      ...r,
      id: String((r as any).id),
      _offlinePending: false,
    }));
}

let activePortalSync: Promise<PortalSyncResult> | null = null;

/**
 * Initial full sync immediately after online login (or manual refresh).
 * Fetches all portal-specific endpoints concurrently, normalizes payloads,
 * and persists them into IndexedDB via Dexie.
 */
export async function initialFullSync(
  portalType: PortalSyncType,
  options?: { accessToken?: string; onProgress?: SyncProgressCallback }
): Promise<PortalSyncResult> {
  if (typeof window === "undefined") {
    return { ok: false, portal: portalType, syncedAt: 0, counts: {}, error: "SSR" };
  }

  if (activePortalSync) {
    return activePortalSync;
  }

  const run = async (): Promise<PortalSyncResult> => {
    const onProgress = options?.onProgress;
    const online = await checkIsOnline();
    if (!online) {
      return {
        ok: false,
        portal: portalType,
        syncedAt: Date.now(),
        counts: {},
        error: "অফলাইন অবস্থায় সিঙ্ক করা সম্ভব নয়",
      };
    }

    onProgress?.(10, "সার্ভারের সাথে সংযোগ স্থাপন করা হচ্ছে...");

    const savedSession = await getOfflineAuthSession();
    const headers = getAuthHeaders(options?.accessToken || savedSession?.accessToken);
    const db = getOfflineDb();
    const now = Date.now();
    const counts: Record<string, number> = {};

    try {
      const mainEndpoint =
        portalType === "teacher" ? "/api/mobile/portal/teacher" : "/api/mobile/portal/student";

      onProgress?.(25, "পোর্টাল ডেটা ডাউনলোড হচ্ছে...");

      const [mainRes, routinesRes, holidaysRes, assignmentsRes, noticesRes] =
        await Promise.all([
          fetchJsonSafe(mainEndpoint, headers),
          fetchJsonSafe("/api/mobile/routines", headers),
          fetchJsonSafe("/api/mobile/holidays", headers),
          fetchJsonSafe("/api/mobile/assignments", headers),
          fetchJsonSafe("/api/mobile/notices", headers),
        ]);

      onProgress?.(65, "অফলাইন ডাটাবেস সংরক্ষণ করা হচ্ছে...");

      const mainData = mainRes?.data || {};
      const routinesData = normalizeRows(
        routinesRes?.data?.routines || routinesRes?.data || mainData.routines || []
      );
      const holidaysData = normalizeRows(holidaysRes?.data?.holidays || holidaysRes?.data || []);
      const homeworkData = normalizeRows(
        assignmentsRes?.data?.assignments || assignmentsRes?.data || []
      );
      const noticesData = normalizeRows(
        noticesRes?.data?.notices || noticesRes?.data || mainData.notices || []
      );

      await db.transaction(
        "rw",
        [
          db.portalProfiles,
          db.students,
          db.classes,
          db.subjects,
          db.attendance,
          db.fees,
          db.exams,
          db.examResults,
          db.examSummaries,
          db.hifzLogs,
          db.kitabLogs,
          db.notices,
          db.routines,
          db.academicCalendar,
          db.homework,
          db.syncMeta,
        ],
        async () => {
          // Save portal profile snapshot
          const profileId = savedSession?.userId || `active_${portalType}`;
          await db.portalProfiles.put({
            id: profileId,
            role: savedSession?.role || portalType,
            madrasa_id: savedSession?.madrasaId || "",
            full_name: savedSession?.fullName || mainData.teacher?.name || mainData.active_student?.name || "",
            active_student: mainData.active_student || null,
            teacher: mainData.teacher || null,
            assigned_subjects: mainData.assigned_subjects || [],
            in_charge_classes: mainData.in_charge_classes || [],
            updated_at: new Date(now).toISOString(),
          });
          counts.portalProfiles = 1;

          const examsList = normalizeRows(mainData.exams || []);
          if (examsList.length) await db.exams.bulkPut(examsList);
          counts.exams = examsList.length;

          if (portalType === "student") {
            const students = normalizeRows(mainData.students || []);
            const attendance = normalizeRows(mainData.attendance || []);
            const fees = normalizeRows(mainData.fees || []);
            const examResults = normalizeRows(mainData.exam_results || []);
            const examSummaries = normalizeRows(mainData.exam_summaries || []);
            const hifzLogs = normalizeRows(mainData.hifz_logs || []);
            const kitabLogs = normalizeRows(mainData.kitab_logs || []);

            if (students.length) await db.students.bulkPut(students);
            if (attendance.length) await db.attendance.bulkPut(attendance);
            if (fees.length) await db.fees.bulkPut(fees);
            if (examResults.length) await db.examResults.bulkPut(examResults);
            if (examSummaries.length) await db.examSummaries.bulkPut(examSummaries);
            if (hifzLogs.length) await db.hifzLogs.bulkPut(hifzLogs);
            if (kitabLogs.length) await db.kitabLogs.bulkPut(kitabLogs);

            counts.students = students.length;
            counts.attendance = attendance.length;
            counts.fees = fees.length;
            counts.examResults = examResults.length;
            counts.examSummaries = examSummaries.length;
            counts.hifzLogs = hifzLogs.length;
            counts.kitabLogs = kitabLogs.length;
          } else {
            const classes = normalizeRows(mainData.classes || []);
            const students = normalizeRows(mainData.students || []);
            if (classes.length) await db.classes.bulkPut(classes);
            if (students.length) await db.students.bulkPut(students);
            counts.classes = classes.length;
            counts.students = students.length;
          }

          if (noticesData.length) await db.notices.bulkPut(noticesData);
          if (routinesData.length) await db.routines.bulkPut(routinesData);
          if (holidaysData.length) await db.academicCalendar.bulkPut(holidaysData);
          if (homeworkData.length) await db.homework.bulkPut(homeworkData);

          counts.notices = noticesData.length;
          counts.routines = routinesData.length;
          counts.academicCalendar = holidaysData.length;
          counts.homework = homeworkData.length;

          await db.syncMeta.put({
            entity: `portal_${portalType}`,
            lastSyncedAt: now,
          });
          await db.syncMeta.put({
            entity: "portal_last_sync",
            lastSyncedAt: now,
          });
        }
      );

      onProgress?.(100, "অফলাইন সিঙ্ক সম্পন্ন হয়েছে!");

      return {
        ok: true,
        portal: portalType,
        syncedAt: now,
        counts,
      };
    } catch (err: any) {
      return {
        ok: false,
        portal: portalType,
        syncedAt: now,
        counts,
        error: err?.message || "সিঙ্ক করতে সমস্যা হয়েছে",
      };
    }
  };

  activePortalSync = run().finally(() => {
    activePortalSync = null;
  });

  return activePortalSync;
}

/**
 * Enqueue a teacher/portal offline write action into IndexedDB offlineOutbox.
 */
export async function enqueueOfflineOutbox(input: {
  portal: "teacher" | "student" | "guardian";
  actionType: OfflineOutboxItem["actionType"];
  endpoint: string;
  method?: "POST" | "PATCH" | "PUT";
  payload: Record<string, unknown>;
}): Promise<OfflineOutboxItem> {
  const db = getOfflineDb();
  const item: OfflineOutboxItem = {
    id: generateOfflineId("outbox"),
    portal: input.portal,
    actionType: input.actionType,
    endpoint: input.endpoint,
    method: input.method || "POST",
    payload: input.payload,
    createdAt: Date.now(),
    status: "pending",
    retryCount: 0,
  };
  await db.offlineOutbox.put(item);
  return item;
}

/**
 * Drains offlineOutbox items to the backend API when online.
 */
export async function processOfflineOutbox(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  if (typeof window === "undefined") {
    return { processed: 0, succeeded: 0, failed: 0 };
  }
  const online = await checkIsOnline();
  if (!online) return { processed: 0, succeeded: 0, failed: 0 };

  const db = getOfflineDb();
  const savedSession = await getOfflineAuthSession();
  const headers = getAuthHeaders(savedSession?.accessToken);

  const items = await db.offlineOutbox.orderBy("createdAt").toArray();
  const pending = items.filter(
    (it) => it.status === "pending" || (it.status === "failed" && it.retryCount < MAX_SYNC_RETRIES)
  );

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const item of pending) {
    if (!(await checkIsOnline())) break;
    processed++;
    await db.offlineOutbox.update(item.id, { status: "syncing" });

    try {
      const res = await fetch(apiUrl(item.endpoint), {
        method: item.method,
        headers,
        credentials: "include",
        body: JSON.stringify(item.payload),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`);
        throw new Error(errText || `HTTP ${res.status}`);
      }

      await db.offlineOutbox.delete(item.id);
      succeeded++;
    } catch (err: any) {
      failed++;
      await db.offlineOutbox.update(item.id, {
        status: "failed",
        retryCount: item.retryCount + 1,
        lastError: err?.message || "Sync failed",
      });
    }
  }

  return { processed, succeeded, failed };
}

/**
 * Background sync triggered on app launch or offline -> online reconnection.
 * Drains offlineOutbox first, then refreshes portal data silently.
 */
export async function backgroundSync(portalOverride?: PortalSyncType): Promise<PortalSyncResult | null> {
  if (typeof window === "undefined") return null;
  const online = await checkIsOnline();
  if (!online) return null;

  await processOfflineOutbox();

  if (portalOverride) {
    return initialFullSync(portalOverride);
  }

  const session = await getOfflineAuthSession();
  if (!session) return null;

  const resolved = resolvePortalTypeFromRole(session.role);
  if (resolved === "admin") return null;

  return initialFullSync(resolved, { accessToken: session.accessToken });
}

export interface PortalSeedPayload {
  profile?: Record<string, unknown> | null;
  students?: Array<Record<string, unknown>>;
  classes?: Array<Record<string, unknown>>;
  attendance?: Array<Record<string, unknown>>;
  fees?: Array<Record<string, unknown>>;
  exams?: Array<Record<string, unknown>>;
  examResults?: Array<Record<string, unknown>>;
  examSummaries?: Array<Record<string, unknown>>;
  hifzLogs?: Array<Record<string, unknown>>;
  kitabLogs?: Array<Record<string, unknown>>;
  notices?: Array<Record<string, unknown>>;
  routines?: Array<Record<string, unknown>>;
  academicCalendar?: Array<Record<string, unknown>>;
  homework?: Array<Record<string, unknown>>;
}

/**
 * Seeds Dexie IndexedDB silently from server-hydrated props so every visited
 * portal view is immediately available offline via useLiveQuery().
 */
export async function seedPortalOfflineCache(
  portalType: PortalSyncType,
  payload: PortalSeedPayload
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const db = getOfflineDb();
    const now = Date.now();

    await db.transaction(
      "rw",
      [
        db.portalProfiles,
        db.students,
        db.classes,
        db.attendance,
        db.fees,
        db.exams,
        db.examResults,
        db.examSummaries,
        db.hifzLogs,
        db.kitabLogs,
        db.notices,
        db.routines,
        db.academicCalendar,
        db.homework,
        db.syncMeta,
      ],
      async () => {
        if (payload.profile && payload.profile.id) {
          await db.portalProfiles.put({
            ...payload.profile,
            id: String(payload.profile.id),
            updated_at: new Date(now).toISOString(),
          });
        }
        if (payload.students?.length) await db.students.bulkPut(normalizeRows(payload.students));
        if (payload.classes?.length) await db.classes.bulkPut(normalizeRows(payload.classes));
        if (payload.attendance?.length) await db.attendance.bulkPut(normalizeRows(payload.attendance));
        if (payload.fees?.length) await db.fees.bulkPut(normalizeRows(payload.fees));
        if (payload.exams?.length) await db.exams.bulkPut(normalizeRows(payload.exams));
        if (payload.examResults?.length) await db.examResults.bulkPut(normalizeRows(payload.examResults));
        if (payload.examSummaries?.length) await db.examSummaries.bulkPut(normalizeRows(payload.examSummaries));
        if (payload.hifzLogs?.length) await db.hifzLogs.bulkPut(normalizeRows(payload.hifzLogs));
        if (payload.kitabLogs?.length) await db.kitabLogs.bulkPut(normalizeRows(payload.kitabLogs));
        if (payload.notices?.length) await db.notices.bulkPut(normalizeRows(payload.notices));
        if (payload.routines?.length) await db.routines.bulkPut(normalizeRows(payload.routines));
        if (payload.academicCalendar?.length) await db.academicCalendar.bulkPut(normalizeRows(payload.academicCalendar));
        if (payload.homework?.length) await db.homework.bulkPut(normalizeRows(payload.homework));

        await db.syncMeta.put({
          entity: `portal_${portalType}`,
          lastSyncedAt: now,
        });
      }
    );
  } catch {
    // Never block UI if IndexedDB quota or private browsing fails
  }
}

