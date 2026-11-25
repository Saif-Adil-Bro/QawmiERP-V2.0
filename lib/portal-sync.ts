import { apiUrl } from "./api-url";
import {
  getOfflineDb,
  generateOfflineId,
  type OfflineOutboxItem,
} from "./offlineDb";
import {
  browserSession,
  ownerKey,
  resolvePortalTypeFromRole,
} from "./offline-auth";
import { checkIsOnline, MAX_SYNC_RETRIES } from "./syncManager";
import { mapPortalSnapshot } from "./portal/offline-snapshot";

export type PortalSyncType = "student" | "teacher";
export interface PortalSyncResult {
  ok: boolean;
  portal: PortalSyncType;
  syncedAt: number;
  counts: Record<string, number>;
  error?: string;
}
export type SyncProgressCallback = (percent: number, label: string) => void;
const pulls = new Map<string, Promise<PortalSyncResult>>();

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isNetworkOrTimeoutError(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  if (e && typeof e === "object" && "name" in e) {
    const name = String((e as { name?: unknown }).name);
    if (name === "AbortError" || name === "TimeoutError") return true;
  }
  return false;
}

export function initialFullSync(
  portal: PortalSyncType,
  options?: {
    accessToken?: string;
    studentId?: string;
    onProgress?: SyncProgressCallback;
  },
): Promise<PortalSyncResult> {
  const session = browserSession(),
    owner = ownerKey(session);
  const studentId =
    portal === "student"
      ? (options?.studentId ??
        (typeof window !== "undefined"
          ? new URLSearchParams(window.location?.search).get("student_id")
          : "") ??
        "")
      : "";
  const id = `${portal}:${studentId}`,
    key = `${owner}/${id}`;
  const fail = (error: string): PortalSyncResult => ({
    ok: false,
    portal,
    syncedAt: 0,
    counts: {},
    error,
  });
  if (!session || !owner || resolvePortalTypeFromRole(session.role) !== portal)
    return Promise.resolve(fail("অ্যাকাউন্টের সংযোগ নেই।"));
  const running = pulls.get(key);
  if (running) return running;
  const run = async (): Promise<PortalSyncResult> => {
    try {
      if (!(await checkIsOnline())) return fail("অফলাইন");
      options?.onProgress?.(20, "পোর্টালের তথ্য আনা হচ্ছে…");
      const db = getOfflineDb(owner);
      const params = new URLSearchParams();
      if (studentId) params.set("student_id", studentId);
      const native = !!options?.accessToken;
      if (!native) params.set("portal", portal);
      const headers: Record<string, string> = {};
      if (options?.accessToken) {
        headers.Authorization = `Bearer ${options.accessToken}`;
        if (process.env.NEXT_PUBLIC_MOBILE_API_KEY)
          headers["x-api-key"] = process.env.NEXT_PUBLIC_MOBILE_API_KEY;
      }
      const res = await fetchWithTimeout(
        apiUrl(
          `${native ? `/api/mobile/portal/${portal}` : "/api/portal/snapshot"}?${params}`,
        ),
        {
          headers,
          credentials: native ? "omit" : "include",
          cache: "no-store",
        },
        25000,
      );
      if (res.status === 401 || res.status === 403)
        await db.clearPrivatePortalData();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Replacing the complete selected snapshot also removes recovered/stale health alerts.
      const data = mapPortalSnapshot(
        (await res.json()).data,
        session.userId,
        session.madrasaId,
        studentId,
        portal,
      );
      const syncedAt = Date.now();
      await db.transaction("rw", db.privateTables, async () => {
        if (ownerKey(browserSession()) !== owner)
          throw new Error("অ্যাকাউন্ট বদলেছে।");
        // Mirrors hold just this projection. An event may involve two siblings;
        // only the separate child snapshot retains that child's personal sittings.
        for (const name of [
          "hifzProfiles",
          "hifzWeeklySabina",
          "hifzSpecialSabina",
        ] as const) {
          await db[name].clear();
          await db.table(name).bulkPut(data[name]);
        }
        const linked = new Set(data.students.map((s) => s.id));
        await db.portalSnapshots
          .filter((r) => !!r.studentId && !linked.has(r.studentId))
          .delete();
        const child = data.activeStudent?.id ?? null;
        const keys = new Set([id]);
        if (child) {
          keys.add(`student:${child}`);
          if (data.students[0]?.id === child) keys.add("student:");
        }
        const previousDefault = await db.portalSnapshots.get("student:");
        if (
          previousDefault &&
          previousDefault.studentId !== data.students[0]?.id
        )
          await db.portalSnapshots.delete("student:");
        for (const k of keys)
          await db.portalSnapshots.put({
            id: k,
            owner,
            studentId: child,
            syncedAt,
            data,
          });
      });
      options?.onProgress?.(100, "সিঙ্ক সম্পন্ন");
      return {
        ok: true,
        portal,
        syncedAt,
        counts: Object.fromEntries(
          Object.entries(data)
            .filter(([, v]) => Array.isArray(v))
            .map(([k, v]) => [k, (v as any[]).length]),
        ),
      };
    } catch (e) {
      return fail(e instanceof Error ? e.message : "সিঙ্ক ব্যর্থ");
    }
  };
  const p = run().finally(() => pulls.delete(key));
  pulls.set(key, p);
  return p;
}
export async function enqueueOfflineOutbox(
  input: Pick<
    OfflineOutboxItem,
    "portal" | "actionType" | "endpoint" | "payload"
  > & { method?: OfflineOutboxItem["method"] },
) {
  const session = browserSession(),
    owner = ownerKey(session);
  if (
    !session ||
    !owner ||
    resolvePortalTypeFromRole(session.role) !==
      (input.portal === "guardian" ? "student" : input.portal)
  )
    throw new Error("অ্যাকাউন্ট যাচাই করুন।");
  const item: OfflineOutboxItem = {
    ...input,
    id: generateOfflineId("outbox"),
    method: input.method || "POST",
    createdAt: Date.now(),
    status: "pending",
    retryCount: 0,
  };
  const db = getOfflineDb(owner);
  await db.transaction("rw", db.offlineOutbox, async () => {
    if (ownerKey(browserSession()) !== owner)
      throw new Error("অ্যাকাউন্ট বদলেছে।");
    const last = await db.offlineOutbox.orderBy("createdAt").last();
    item.createdAt = Math.max(item.createdAt, (last?.createdAt || 0) + 1);
    await db.offlineOutbox.add(item);
  });
  return item;
}
const teacherEndpoints = {
  attendance: "/api/attendance/bulk",
  hifz: "/api/teacher/save-hifz",
  kitab: "/api/teacher/save-kitab",
  exam_marks: "/api/teacher/save-marks",
} as const;
export class TeacherEntryError extends Error {
  constructor(message: string, readonly code?: string) { super(message); }
}
export async function postTeacherEntry(
  actionType: keyof typeof teacherEndpoints,
  payload: Record<string, unknown>,
  expectedOwner: string,
  ensureWritable?: () => void,
) {
  const endpoint = teacherEndpoints[actionType];
  if (!expectedOwner || expectedOwner !== ownerKey(browserSession()))
    throw new Error("অ্যাকাউন্ট বদলেছে। পেজ রিফ্রেশ করুন।");
  const isOnline = await checkIsOnline();
  let pending =
    actionType === "hifz"
      ? await getOfflineDb(expectedOwner)
          .offlineOutbox.where("actionType")
          .equals("hifz")
          .filter((i) => !i.rejected)
          .count()
      : 0;
  if (pending > 0 && isOnline) {
    await processOfflineOutbox().catch(() => {});
    pending = await getOfflineDb(expectedOwner)
      .offlineOutbox.where("actionType")
      .equals("hifz")
      .filter((i) => !i.rejected)
      .count();
  }
  if (!pending && isOnline) {
    if (expectedOwner !== ownerKey(browserSession()))
      throw new Error("অ্যাকাউন্ট বদলেছে।");
    ensureWritable?.();
    try {
      const res = await fetchWithTimeout(
        apiUrl(endpoint),
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-Qawmi-Sync-Owner": expectedOwner,
          },
          body: JSON.stringify(payload),
        },
        30000,
      );
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new TeacherEntryError(
          json.error || `HTTP ${res.status}`,
          json.code,
        );
      if (expectedOwner !== ownerKey(browserSession()))
        throw new Error("অ্যাকাউন্ট বদলেছে।");
      try {
        const db = getOfflineDb(expectedOwner);
        const nowTs = Date.now();
        await db.portalSnapshots
          .where("id")
          .equals("teacher:")
          .modify({ syncedAt: nowTs });
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("qawmi-portal-synced", {
              detail: { portal: "teacher", syncedAt: nowTs, actionType },
            })
          );
        }
      } catch {
        // non-fatal timestamp bump
      }
      return { success: true, offlineQueued: false, error: "" };
    } catch (e) {
      if (!isNetworkOrTimeoutError(e)) throw e;
    }
  }
  if (expectedOwner !== ownerKey(browserSession()))
    throw new Error("অ্যাকাউন্ট বদলেছে।");
  ensureWritable?.();
  await enqueueOfflineOutbox({
    portal: "teacher",
    actionType,
    endpoint,
    method: "POST",
    payload,
  });
  if (await checkIsOnline()) {
    await processOfflineOutbox().catch(() => {});
    const remaining = await getOfflineDb(expectedOwner)
      .offlineOutbox.where("actionType")
      .equals(actionType)
      .filter((i) => !i.rejected)
      .count();
    if (remaining === 0) {
      try {
        const db = getOfflineDb(expectedOwner);
        const nowTs = Date.now();
        await db.portalSnapshots
          .where("id")
          .equals("teacher:")
          .modify({ syncedAt: nowTs });
      } catch {
        // non-fatal
      }
      return { success: true, offlineQueued: false, error: "" };
    }
  }
  return { success: true, offlineQueued: true, error: "" };
}
const draining = new Set<string>();
export async function processOfflineOutbox() {
  const owner = ownerKey(browserSession());
  if (!owner || draining.has(owner) || !(await checkIsOnline())) return;
  if (draining.has(owner)) return;
  draining.add(owner);
  try {
    const db = getOfflineDb(owner);
    for (const item of await db.offlineOutbox.orderBy("createdAt").toArray()) {
      if (ownerKey(browserSession()) !== owner) break;
      if (item.rejected) continue;
      if (item.retryCount >= MAX_SYNC_RETRIES) break;
      // Claim the head in IndexedDB, not just a tab-local mutex. A crashed tab's lease expires.
      const claimed = await db.transaction("rw", db.offlineOutbox, async () => {
        const live = await db.offlineOutbox.get(item.id);
        if (
          !live || live.rejected ||
          live.retryCount >= MAX_SYNC_RETRIES ||
          (live.leaseUntil || 0) > Date.now()
        )
          return false;
        await db.offlineOutbox.update(item.id, {
          status: "syncing",
          leaseUntil: Date.now() + 120000,
        });
        return true;
      });
      if (!claimed) break;
      try {
        if (ownerKey(browserSession()) !== owner) break;
        const res = await fetchWithTimeout(
          apiUrl(item.endpoint),
          {
            method: item.method,
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "X-Qawmi-Sync-Owner": owner,
            },
            body: JSON.stringify(item.payload),
          },
          45000,
        );
        const response = await res.json();
        if (!res.ok || !response.success) {
          if (
            item.actionType === "hifz" &&
            [400, 403, 404, 409].includes(res.status) &&
            response.code !== "OWNER_CHANGED"
          ) {
            // A changed roster or newer daily entry requires a person, not five
            // identical retries. Keep it for its owner; allow later writes through.
            await db.offlineOutbox.update(item.id, {
              status: "failed",
              rejected: "HIFZ_REVIEW",
              leaseUntil: 0,
              lastError: response.error || response.message,
            });
            continue;
          }
          if (item.actionType === "exam_marks" && response.code === "EXAM_LOCKED") {
            // A final freeze refusal isn't a transient network failure. Keep the rejected draft
            // for its owner; neither replay it after unlock nor block unrelated attendance etc.
            await db.offlineOutbox.update(item.id, {status: "failed", rejected: "EXAM_LOCKED", leaseUntil: 0, lastError: response.error});
            continue;
          }
          throw new Error(response.error || `HTTP ${res.status}`);
        }
        await db.offlineOutbox.delete(item.id);
      } catch (e) {
        await db.offlineOutbox.update(item.id, {
          status: "failed",
          leaseUntil: 0,
          retryCount: item.retryCount + 1,
          lastError: String(e),
        });
        break; // Preserve the order of offline corrections.
      }
    }
  } finally {
    draining.delete(owner);
  }
}
export async function backgroundSync(
  portalOverride?: PortalSyncType,
  studentId?: string,
) {
  const session = browserSession();
  if (!session) return null;
  const portal = resolvePortalTypeFromRole(session.role);
  if (
    portal === "admin" ||
    (portalOverride && portal !== portalOverride) ||
    !(await checkIsOnline())
  )
    return null;
  const owner = ownerKey(session);
  await processOfflineOutbox();
  if (owner !== ownerKey(browserSession())) return null;
  return initialFullSync(portal, { studentId });
}
