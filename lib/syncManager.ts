import {browserSession,ownerKey,resolvePortalTypeFromRole} from './offline-auth';
import { Network } from "@capacitor/network";
import { apiUrl } from "./api-url";
import {
  generateOfflineId,
  getOfflineDb,
  type OfflineEntity,
  type OfflineRecord,
  type SyncAction,
  type SyncQueueItem,
} from "./offlineDb";

export const MAX_SYNC_RETRIES = 5;

export const ENTITY_API_PATHS: Record<OfflineEntity, string> = {
  students: "/api/mobile/students",
  teachers: "/api/mobile/teachers",
  classes: "/api/mobile/classes",
  subjects: "/api/mobile/subjects",
  attendance: "/api/mobile/attendance",
  fees: "/api/mobile/fees",
  feePayments: "/api/mobile/fee-payments",
  expenses: "/api/mobile/expenses",
  hifzLogs: "/api/mobile/hifz",
  hifzProfiles: "/api/mobile/hifz?kind=profile",
  hifzWeeklySabina: "/api/mobile/hifz?kind=weekly",
  hifzSpecialSabina: "/api/mobile/hifz?kind=special",
  kitabLogs: "/api/mobile/kitab",
  notices: "/api/mobile/notices",
  exams: "/api/mobile/exams",
  examResults: "/api/mobile/exam-results",
  examSummaries: "/api/mobile/portal/student",
  portalProfiles: "/api/mobile/portal/student",
  routines: "/api/mobile/routines",
  academicCalendar: "/api/mobile/holidays",
  homework: "/api/mobile/assignments",
};

const CORE_PULL_ENTITIES: OfflineEntity[] = [
  "students",
  "teachers",
  "classes",
  "subjects",
  "attendance",
  "fees",
  "expenses",
  "hifzLogs",
  "hifzProfiles",
  "hifzSpecialSabina",
  "hifzWeeklySabina",
  "kitabLogs",
  "notices",
  "exams",
];

let syncInProgress = false;
const ownerIds = new Map<string,Map<string,string>>();

export async function checkIsOnline(): Promise<boolean> {
  if (typeof window === "undefined") return true;
  try {
    const status = await Network.getStatus();
    return status.connected;
  } catch {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  }
}

function buildAuthHeaders(owner=ownerKey(browserSession())): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Qawmi-Sync-Owner": owner,
  };
  if (typeof window !== "undefined") {
    const token = browserSession()?.accessToken;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  const apiKey = process.env.NEXT_PUBLIC_MOBILE_API_KEY?.trim();
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }
  return headers;
}

function resolveTargetEndpoint(item: SyncQueueItem,tempIdToServerId:Map<string,string>): { url: string; method: string } {
  const basePath = item.endpoint || ENTITY_API_PATHS[item.entity];
  const resolvedRecordId = item.recordId
    ? tempIdToServerId.get(item.recordId) || item.recordId
    : undefined;

  if (item.action === "CREATE") {
    return { url: apiUrl(basePath), method: "POST" };
  }

  if (item.action === "UPDATE") {
    const target =
      resolvedRecordId && !item.endpoint
        ? `${basePath}/${encodeURIComponent(resolvedRecordId)}`
        : basePath;
    return { url: apiUrl(target), method: "PATCH" };
  }

  // DELETE
  const target =
    resolvedRecordId && !item.endpoint
      ? `${basePath}/${encodeURIComponent(resolvedRecordId)}`
      : basePath;
  return { url: apiUrl(target), method: "DELETE" };
}

export interface SyncProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
  skippedOffline: boolean;
}

export async function processSyncQueue(): Promise<SyncProcessResult> {
  if (typeof window === "undefined") {
    return { processed: 0, succeeded: 0, failed: 0, skippedOffline: true };
  }

  const session = browserSession(), owner = ownerKey(session);
  if (!owner || resolvePortalTypeFromRole(session?.role)!=='admin' || syncInProgress) {
    return { processed: 0, succeeded: 0, failed: 0, skippedOffline: false };
  }

  const online = await checkIsOnline();
  if (!online) {
    return { processed: 0, succeeded: 0, failed: 0, skippedOffline: true };
  }

  if (syncInProgress || owner!==ownerKey(browserSession())) return {processed:0,succeeded:0,failed:0,skippedOffline:false};
  syncInProgress = true;
  const headers=buildAuthHeaders(owner);
  const db = getOfflineDb(owner);
  const tempIdToServerId=ownerIds.get(owner) || new Map<string,string>(); ownerIds.set(owner,tempIdToServerId);
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  try {
    const allItems = await db.syncQueue.orderBy("timestamp").toArray();
    for (const item of allItems) {
      if (!await checkIsOnline() || ownerKey(browserSession())!==owner || item.retryCount>=MAX_SYNC_RETRIES) break;
      const claimed=await db.transaction('rw',db.syncQueue,async()=>{
        const live=await db.syncQueue.get(item.id);
        if (!live || (live.leaseUntil || 0)>Date.now() || live.retryCount>=MAX_SYNC_RETRIES) return false;
        await db.syncQueue.update(item.id,{status:'syncing',leaseUntil:Date.now()+120000});return true;
      });
      if (!claimed) break;
      processed++;
      try {
        const { url, method } = resolveTargetEndpoint(item,tempIdToServerId);
        const bodyPayload = { ...item.payload };

        // Remap any temp IDs inside payload if created earlier in queue
        if (
          typeof bodyPayload.id === "string" &&
          tempIdToServerId.has(bodyPayload.id)
        ) {
          bodyPayload.id = tempIdToServerId.get(bodyPayload.id);
        }

        const res = await fetch(url, {
          signal:AbortSignal.timeout(45000),
          method,
          headers,
          credentials: "include",
          body: method === "DELETE" && Object.keys(bodyPayload).length === 0
            ? undefined
            : JSON.stringify(bodyPayload),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => `HTTP ${res.status}`);
          throw new Error(errText || `HTTP ${res.status}`);
        }

        const json = await res.json().catch(() => null);
        if (!json?.success) throw new Error('সার্ভার পরিবর্তন নিশ্চিত করেনি।');
        const serverRecord = json?.data && !Array.isArray(json.data) ? json.data : null;

        // Reconcile local Dexie cache
        const table = db.getEntityTable(item.entity);
        if (item.action === "CREATE") {
          if (item.recordId && serverRecord?.id) {
            tempIdToServerId.set(item.recordId, String(serverRecord.id));
            await table.delete(item.recordId).catch(() => {});
            await table.put({
              ...serverRecord,
              id: String(serverRecord.id),
              _offlinePending: false,
            });
          } else if (item.recordId) {
            await table.update(item.recordId, { _offlinePending: false }).catch(() => {});
          }
        } else if (item.action === "UPDATE" && item.recordId) {
          const finalId = tempIdToServerId.get(item.recordId) || item.recordId;
          await table
            .update(finalId, {
              ...(serverRecord || item.payload),
              _offlinePending: false,
            })
            .catch(() => {});
        } else if (item.action === "DELETE" && item.recordId) {
          const finalId = tempIdToServerId.get(item.recordId) || item.recordId;
          await table.delete(finalId).catch(() => {});
        }

        // Remove from queue on success
        await db.syncQueue.delete(item.id);
        succeeded++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Sync failed";
        const nextRetry = (item.retryCount || 0) + 1;
        await db.syncQueue.update(item.id, {
          status: nextRetry >= MAX_SYNC_RETRIES ? "failed" : "pending",
          retryCount: nextRetry,leaseUntil:0,
          lastError: message.slice(0, 300),
        });
        failed++; break;
      }
    }
  } finally {
    syncInProgress = false;
  }

  return { processed, succeeded, failed, skippedOffline: false };
}

export async function pullEntityFromServer(
  entity: OfflineEntity,
  query = "limit=200"
): Promise<OfflineRecord[]> {
  const owner=ownerKey(browserSession());
  if(!owner.endsWith(':admin')) return [];
  const db = getOfflineDb(owner);
  const table = db.getEntityTable(entity);
  const online = await checkIsOnline();

  if (owner!==ownerKey(browserSession())) return [];
  if (!online) {
    return table.filter((r) => !r._deleted).toArray();
  }

  try {
    const endpoint = ENTITY_API_PATHS[entity];
    const separator = endpoint.includes("?") ? "&" : "?";
    // A full Hifz pull is authoritative only after every page succeeds. Keep
    // pending admin edits and the last good copy on transport/shape failures.
    if (entity.startsWith("hifz") && /^limit=\d+$/.test(query)) {
      const all: OfflineRecord[] = [],
        tenant = browserSession()?.madrasaId;
      let page = 1;
      for (; ; page++) {
        if (owner !== ownerKey(browserSession())) return [];
        const res = await fetch(
          apiUrl(`${endpoint}${separator}limit=100&page=${page}`),
          { headers: buildAuthHeaders(owner), credentials: "include" },
        );
        if (res.status === 401 || res.status === 403)
          await table.filter((r) => !r._offlinePending).delete();
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const packet = await res.json();
        if (
          !packet.success ||
          !Array.isArray(packet.data) ||
          !Number.isInteger(packet.meta?.totalPages) ||
          packet.meta.page !== page
        )
          throw new Error("অসম্পূর্ণ হিফজ সিঙ্ক।");
        for (const r of packet.data) {
          const id = entity === "hifzProfiles" ? r.student_id : r.id;
          if (!id || r.madrasa_id !== tenant)
            throw new Error("হিফজ নথির পরিচয় মেলেনি।");
          all.push({ ...r, id });
        }
        if (page >= packet.meta.totalPages) break;
        if (!packet.data.length) throw new Error("অসম্পূর্ণ হিফজ সিঙ্ক।");
      }
      if (owner !== ownerKey(browserSession())) return [];
      await db.transaction("rw", table, db.syncMeta, async () => {
        const pending = new Set(
          (await table.filter((r) => !!r._offlinePending).toArray()).map(
            (r) => r.id,
          ),
        );
        await table.filter((r) => !r._offlinePending).delete();
        await table.bulkPut(all.filter((r) => !pending.has(r.id)));
        await db.syncMeta.put({ entity, lastSyncedAt: Date.now() });
      });
      return table.filter((r) => !r._deleted).toArray();
    }
    const res = await fetch(apiUrl(`${endpoint}${separator}${query}`), {
      headers: buildAuthHeaders(owner),
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const json = await res.json();
    const rows: OfflineRecord[] = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json)
        ? json
        : [];

    // Preserve local unsynced records
    const existingPending = await table
      .filter((r) => Boolean(r._offlinePending))
      .toArray();
    const pendingIds = new Set(existingPending.map((r) => r.id));

    const cleanRows = rows
      .map((r) =>
        entity === "hifzProfiles" ? { ...r, id: String(r.student_id) } : r,
      )
      .filter((r) => r && r.id && !pendingIds.has(String(r.id)))
      .map((r) => ({
        ...r,
        id: String(r.id),
        _offlinePending: false,
      }));

    if (owner !== ownerKey(browserSession())) return [];
    if (cleanRows.length > 0) {
      await table.bulkPut(cleanRows);
    }

    await db.syncMeta.put({
      entity,
      lastSyncedAt: Date.now(),
    });

    return table.filter((r) => !r._deleted).toArray();
  } catch (err: unknown) {
    if (owner!==ownerKey(browserSession())) return [];
    const message = err instanceof Error ? err.message : "Pull failed";
    await db.syncMeta.put({
      entity,
      lastSyncedAt: Date.now(),
      lastError: message,
    });
    return table.filter((r) => !r._deleted).toArray();
  }
}

export async function pullAllCoreEntities(): Promise<void> {
  const session=browserSession(); if (!ownerKey(session) || resolvePortalTypeFromRole(session?.role)!=='admin') return;
  const online = await checkIsOnline();
  if (!online) return;

  await Promise.allSettled(
    CORE_PULL_ENTITIES.map((entity) => pullEntityFromServer(entity, "limit=100"))
  );
}

export interface OfflineMutateOptions {
  entity: OfflineEntity;
  action: SyncAction;
  payload: Record<string, unknown>;
  recordId?: string;
  endpoint?: string;
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
}

export interface OfflineMutateResult<T = unknown> {
  success: boolean;
  offlineQueued: boolean;
  data?: T;
  error?: string;
}

async function applyOptimisticLocalUpdate(
  db:ReturnType<typeof getOfflineDb>,
  entity: OfflineEntity,
  action: SyncAction,
  payload: Record<string, unknown>,
  recordId: string,
  pending: boolean
) {
  const table = db.getEntityTable(entity);
  const nowIso = new Date().toISOString();

  if (action === "CREATE") {
    await table.put({
      ...payload,
      id: recordId,
      updated_at: nowIso,
      _offlinePending: pending,
    });
  } else if (action === "UPDATE") {
    const existing = await table.get(recordId);
    await table.put({
      ...(existing || {}),
      ...payload,
      id: recordId,
      updated_at: nowIso,
      _offlinePending: pending,
    });
  } else if (action === "DELETE") {
    if (pending) {
      await table.update(recordId, { _deleted: true, _offlinePending: true }).catch(async () => {
        await table.delete(recordId);
      });
    } else {
      await table.delete(recordId);
    }
  }
}

export async function queueOfflineOperation(
  options: OfflineMutateOptions
): Promise<OfflineMutateResult> {
  if(!ownerKey(browserSession()).endsWith(':admin')) throw new Error('অ্যাডমিন সেশন নেই।');
  const db = getOfflineDb();
  const effectiveRecordId =
    options.recordId ||
    (typeof options.payload.id === "string" ? options.payload.id : undefined) ||
    generateOfflineId(options.entity);

  const queueItem: SyncQueueItem = {
    id: generateOfflineId("sync"),
    entity: options.entity,
    action: options.action,
    payload: options.payload,
    recordId: effectiveRecordId,
    endpoint: options.endpoint,
    timestamp: Date.now(),
    status: "pending",
    retryCount: 0,
  };

  await db.transaction('rw',db.syncQueue,db.getEntityTable(options.entity),async()=>{
  await applyOptimisticLocalUpdate(
    db,options.entity,
    options.action,
    options.payload,
    effectiveRecordId,
    true
  );

    await db.syncQueue.add(queueItem);
  });

  return {
    success: true,
    offlineQueued: true,
    data: { ...options.payload, id: effectiveRecordId },
  };
}

export async function offlineMutate<T = unknown>(
  options: OfflineMutateOptions
): Promise<OfflineMutateResult<T>> {
  const owner=ownerKey(browserSession()); if(!owner.endsWith(':admin')) throw new Error('অ্যাডমিন সেশন নেই।');
  const online = await checkIsOnline();
  const effectiveRecordId =
    options.recordId ||
    (typeof options.payload.id === "string" ? options.payload.id : undefined) ||
    generateOfflineId(options.entity);

  if(owner!==ownerKey(browserSession())) throw new Error('অ্যাকাউন্ট বদলেছে।');
  if (!online) {
    return (await queueOfflineOperation({
      ...options,
      recordId: effectiveRecordId,
    })) as OfflineMutateResult<T>;
  }

  const basePath = options.endpoint || ENTITY_API_PATHS[options.entity];
  const method =
    options.method ||
    (options.action === "CREATE"
      ? "POST"
      : options.action === "UPDATE"
      ? "PATCH"
      : "DELETE");

  const targetUrl =
    !options.endpoint &&
    (options.action === "UPDATE" || options.action === "DELETE") &&
    effectiveRecordId
      ? apiUrl(`${basePath}/${encodeURIComponent(effectiveRecordId)}`)
      : apiUrl(basePath);

  try {
    const res = await fetch(targetUrl, {
      method,
      headers: buildAuthHeaders(),
      credentials: "include",
      body:
        method === "DELETE" && Object.keys(options.payload).length === 0
          ? undefined
          : JSON.stringify(options.payload),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        success: false,
        offlineQueued: false,
        data: json as T,
        error: json?.error || json?.message || `HTTP ${res.status}`,
      };
    }

    // Update local Dexie cache with synced server data
    if (owner!==ownerKey(browserSession()) || !json?.success) throw new Error('অ্যাকাউন্ট বা রেসপন্স বদলেছে।');
    const serverRecord = json?.data && !Array.isArray(json.data) ? json.data : null;
    await applyOptimisticLocalUpdate(
      getOfflineDb(owner),options.entity,
      options.action,
      serverRecord || options.payload,
      String(serverRecord?.id || effectiveRecordId),
      false
    );

    return {
      success: true,
      offlineQueued: false,
      data: (json ?? { success: true }) as T,
    };
  } catch (err: unknown) {
    // Network failure mid-request -> queue offline seamlessly
    const stillOnline = await checkIsOnline();
    if (owner!==ownerKey(browserSession())) return {success:false,offlineQueued:false,error:'অ্যাকাউন্ট বদলেছে।'};
    if (!stillOnline || err instanceof TypeError) {
      return (await queueOfflineOperation({
        ...options,
        recordId: effectiveRecordId,
      })) as OfflineMutateResult<T>;
    }
    return {
      success: false,
      offlineQueued: false,
      error: err instanceof Error ? err.message : "Request failed",
    };
  }
}

export async function retryFailedSyncItems(): Promise<SyncProcessResult> {
  const db = getOfflineDb();
  const failedItems = await db.syncQueue.where("status").equals("failed").toArray();
  await Promise.all(
    failedItems.map((item) =>
      db.syncQueue.update(item.id, { status: "pending", retryCount: 0 })
    )
  );
  return processSyncQueue();
}
