"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {useSearchParams,useRouter} from 'next/navigation';
import {usePortalOwner} from './useOfflinePortalData';
import { Network } from "@capacitor/network";
import { useLiveQuery } from "dexie-react-hooks";
import { getOfflineDb, type OfflineOutboxItem } from "@/lib/offlineDb";
import {
  backgroundSync,
  enqueueOfflineOutbox,
  initialFullSync,
  type PortalSyncResult,
  type PortalSyncType,
} from "@/lib/portal-sync";
import { checkIsOnline } from "@/lib/syncManager";

export function useNetworkSync(portalType?: PortalSyncType) {
  const owner = usePortalOwner(); const router = useRouter();
  const selectedStudent = useSearchParams()?.get('student_id');
  const studentId = portalType==='student' ? selectedStudent || '' : '';
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [syncMessage, setSyncMessage] = useState<string>("");
  const wasOnlineRef = useRef<boolean>(true);

  const outboxStats = useLiveQuery(async () => {
    if (typeof window === "undefined") return { pending: 0, failed: 0 };
    const db = getOfflineDb(owner);
    const all = await db.offlineOutbox.toArray();
    return {
      pending: all.filter((i) => i.status === "pending" || i.status === "syncing").length,
      failed: all.filter((i) => i.status === "failed").length,
    };
  }, [owner]);

  const lastSyncedAt = useLiveQuery(async () => {
    if (typeof window === "undefined") return null;
    const db = getOfflineDb(owner);
    const record = await db.portalSnapshots.get(`${portalType}:${studentId}`);
    return record?.syncedAt ?? null;
  }, [portalType,studentId,owner]);

  const triggerInitialSync = useCallback(
    async (overridePortal?: PortalSyncType): Promise<PortalSyncResult | null> => {
      const target = overridePortal || portalType;
      if (!target) return null;
      setIsSyncing(true);
      setSyncProgress(5);
      try {
        return await initialFullSync(target, {
          onProgress: (pct, label) => {
            setSyncProgress(pct);
            setSyncMessage(label);
          },
        });
      } finally {
        setIsSyncing(false);
      }
    },
    [portalType]
  );

  const triggerBackgroundSync = useCallback(
    async (options?: { force?: boolean; refreshOnSuccess?: boolean }) => {
      if (typeof window === "undefined") return null;
      const force = Boolean(options?.force);

      try {
        const db = getOfflineDb(owner);
        const pendingBefore = await db.offlineOutbox
          .filter((i) => !i.rejected && (i.status === "pending" || i.status === "syncing"))
          .count();

        if (!force && portalType && pendingBefore === 0) {
          const snapshot = await db.portalSnapshots.get(`${portalType}:${studentId}`);
          if (snapshot?.syncedAt && Date.now() - snapshot.syncedAt < 60_000) {
            return {
              ok: true,
              portal: portalType,
              syncedAt: snapshot.syncedAt,
              counts: {},
            } satisfies PortalSyncResult;
          }
        }

        setIsSyncing(true);
        const result = await backgroundSync(portalType, studentId);
        setSyncMessage(result && !result.ok ? result.error || "সিঙ্ক ব্যর্থ" : "");

        if (result?.ok) {
          const pendingAfter = await db.offlineOutbox
            .filter((i) => !i.rejected && (i.status === "pending" || i.status === "syncing"))
            .count();
          const drainedLocalWrites = pendingBefore > 0 && pendingAfter < pendingBefore;
          if (drainedLocalWrites || options?.refreshOnSuccess) {
            router.refresh();
          }
        }
        return result;
      } finally {
        setIsSyncing(false);
      }
    },
    [owner, portalType, studentId, router],
  );

  const queueOfflineAction = useCallback(
    async (input: {
      portal: "teacher" | "student" | "guardian";
      actionType: OfflineOutboxItem["actionType"];
      endpoint: string;
      method?: "POST" | "PATCH" | "PUT";
      payload: Record<string, unknown>;
    }) => {
      return enqueueOfflineOutbox(input);
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    let listener: { remove: () => Promise<void> } | null = null;

    const handleConnectivityChange = (connected: boolean) => {
      const wasOffline = !wasOnlineRef.current;
      wasOnlineRef.current = connected;
      setIsOnline(connected);

      if (connected && wasOffline) {
        triggerBackgroundSync({ force: true }).catch(() => {});
      }
    };

    checkIsOnline().then((connected) => {
      wasOnlineRef.current = connected;
      setIsOnline(connected);
      if (connected && portalType) {
        triggerBackgroundSync({ force: false }).catch(() => {});
      }
    });

    Network.addListener("networkStatusChange", (status) => {
      handleConnectivityChange(status.connected);
    })
      .then((h) => {
        listener = h;
      })
      .catch(() => {});

    const onFocus = () => {
      if (document.visibilityState === "visible") {
        triggerBackgroundSync({ force: false }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onFocus);
    const onOnline = () => handleConnectivityChange(true);
    const onOffline = () => handleConnectivityChange(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      listener?.remove().catch(() => {});
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [portalType, triggerBackgroundSync]);

  return {
    isOnline,
    isSyncing,
    lastSyncedAt: lastSyncedAt ?? null,
    pendingOutboxCount: outboxStats?.pending ?? 0,
    failedOutboxCount: outboxStats?.failed ?? 0,
    syncProgress,
    syncMessage,
    triggerInitialSync,
    triggerBackgroundSync,
    queueOfflineAction,
  };
}
