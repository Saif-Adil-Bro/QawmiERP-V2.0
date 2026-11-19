"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [syncMessage, setSyncMessage] = useState<string>("");
  const wasOnlineRef = useRef<boolean>(true);

  const outboxStats = useLiveQuery(async () => {
    if (typeof window === "undefined") return { pending: 0, failed: 0 };
    const db = getOfflineDb();
    const all = await db.offlineOutbox.toArray();
    return {
      pending: all.filter((i) => i.status === "pending" || i.status === "syncing").length,
      failed: all.filter((i) => i.status === "failed").length,
    };
  }, []);

  const lastSyncedAt = useLiveQuery(async () => {
    if (typeof window === "undefined") return null;
    const db = getOfflineDb();
    const key = portalType ? `portal_${portalType}` : "portal_last_sync";
    const meta = await db.syncMeta.get(key);
    return meta?.lastSyncedAt ?? null;
  }, [portalType]);

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

  const triggerBackgroundSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      return await backgroundSync(portalType);
    } finally {
      setIsSyncing(false);
    }
  }, [portalType]);

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
        triggerBackgroundSync().catch(() => {});
      }
    };

    checkIsOnline().then((connected) => {
      wasOnlineRef.current = connected;
      setIsOnline(connected);
      if (connected && portalType) {
        triggerBackgroundSync().catch(() => {});
      }
    });

    Network.addListener("networkStatusChange", (status) => {
      handleConnectivityChange(status.connected);
    })
      .then((h) => {
        listener = h;
      })
      .catch(() => {});

    const onOnline = () => handleConnectivityChange(true);
    const onOffline = () => handleConnectivityChange(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
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
