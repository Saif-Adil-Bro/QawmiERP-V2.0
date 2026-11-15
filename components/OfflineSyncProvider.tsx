"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { liveQuery } from "dexie";
import { Network } from "@capacitor/network";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { getOfflineDb } from "@/lib/offlineDb";
import {
  checkIsOnline,
  processSyncQueue,
  pullAllCoreEntities,
  retryFailedSyncItems,
  type SyncProcessResult,
} from "@/lib/syncManager";

interface OfflineSyncContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncedAt: number | null;
  syncNow: () => Promise<SyncProcessResult>;
  retryFailed: () => Promise<SyncProcessResult>;
  refreshCache: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue>({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  failedCount: 0,
  lastSyncedAt: null,
  syncNow: async () => ({ processed: 0, succeeded: 0, failed: 0, skippedOffline: true }),
  retryFailed: async () => ({ processed: 0, succeeded: 0, failed: 0, skippedOffline: true }),
  refreshCache: async () => {},
});

export function useOfflineSync() {
  return useContext(OfflineSyncContext);
}

export default function OfflineSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const wasOnlineRef = useRef<boolean>(true);

  const syncNow = useCallback(async (): Promise<SyncProcessResult> => {
    setIsSyncing(true);
    try {
      const result = await processSyncQueue();
      if (result.succeeded > 0) {
        setLastSyncedAt(Date.now());
      }
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const retryFailed = useCallback(async (): Promise<SyncProcessResult> => {
    setIsSyncing(true);
    try {
      const result = await retryFailedSyncItems();
      if (result.succeeded > 0) {
        setLastSyncedAt(Date.now());
      }
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const refreshCache = useCallback(async () => {
    await pullAllCoreEntities();
    setLastSyncedAt(Date.now());
  }, []);

  // Subscribe to Dexie syncQueue counts via liveQuery
  useEffect(() => {
    if (typeof window === "undefined") return;
    const db = getOfflineDb();
    const subscription = liveQuery(async () => {
      const items = await db.syncQueue.toArray();
      const pending = items.filter(
        (i) => i.status === "pending" || i.status === "syncing"
      ).length;
      const failed = items.filter((i) => i.status === "failed").length;
      return { pending, failed };
    }).subscribe({
      next: ({ pending, failed }) => {
        setPendingCount(pending);
        setFailedCount(failed);
      },
      error: () => {},
    });

    return () => subscription.unsubscribe();
  }, []);

  // Monitor network status & app resume
  useEffect(() => {
    if (typeof window === "undefined") return;

    let networkListener: { remove: () => Promise<void> } | null = null;
    let appStateListener: { remove: () => Promise<void> } | null = null;

    const handleConnectivityChange = async (connected: boolean) => {
      const wasOffline = !wasOnlineRef.current;
      wasOnlineRef.current = connected;
      setIsOnline(connected);

      if (connected && wasOffline) {
        await syncNow();
        await pullAllCoreEntities().catch(() => {});
      }
    };

    // Initial check
    checkIsOnline().then((connected) => {
      wasOnlineRef.current = connected;
      setIsOnline(connected);
      if (connected) {
        syncNow().catch(() => {});
      }
    });

    // Capacitor Network listener
    Network.addListener("networkStatusChange", (status) => {
      handleConnectivityChange(status.connected);
    })
      .then((handle) => {
        networkListener = handle;
      })
      .catch(() => {});

    // Browser online/offline fallback
    const onBrowserOnline = () => handleConnectivityChange(true);
    const onBrowserOffline = () => handleConnectivityChange(false);
    window.addEventListener("online", onBrowserOnline);
    window.addEventListener("offline", onBrowserOffline);

    // Capacitor App resume listener
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener("appStateChange", async ({ isActive }) => {
        if (isActive) {
          const connected = await checkIsOnline();
          setIsOnline(connected);
          wasOnlineRef.current = connected;
          if (connected) {
            await syncNow();
          }
        }
      })
        .then((handle) => {
          appStateListener = handle;
        })
        .catch(() => {});
    }

    return () => {
      networkListener?.remove().catch(() => {});
      appStateListener?.remove().catch(() => {});
      window.removeEventListener("online", onBrowserOnline);
      window.removeEventListener("offline", onBrowserOffline);
    };
  }, [syncNow]);

  return (
    <OfflineSyncContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingCount,
        failedCount,
        lastSyncedAt,
        syncNow,
        retryFailed,
        refreshCache,
      }}
    >
      {children}
    </OfflineSyncContext.Provider>
  );
}
