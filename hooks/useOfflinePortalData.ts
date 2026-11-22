"use client";
import { createContext, useContext, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useSearchParams } from "next/navigation";
import { getOfflineDb } from "@/lib/offlineDb";
import { ownerKey, browserSession } from "@/lib/offline-auth";
export const PortalOwner = createContext("");
export const usePortalOwner = () => useContext(PortalOwner);
function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
    window.removeEventListener("storage", cb);
  };
}
export function useOfflinePortalSnapshot() {
  const owner = usePortalOwner();
  const student = useSearchParams()?.get("student_id") || "";
  const offlineOwner = useSyncExternalStore(
    subscribe,
    () => (navigator.onLine ? "" : ownerKey(browserSession())),
    () => "",
  );
  const id = owner.endsWith(":teacher") ? "teacher:" : `student:${student}`;
  const row = useLiveQuery(
    () =>
      owner && offlineOwner === owner
        ? getOfflineDb(owner).portalSnapshots.get(id)
        : undefined,
    [owner, id, offlineOwner],
  );
  // An online empty result is authoritative. Never rehydrate from a different render/child.
  return owner &&
    offlineOwner === owner &&
    row?.owner === owner &&
    row.id === id
    ? row.data
    : null;
}

// A parent may have multiple cached children. Never read a shared event-store
// row by event ID here: each child's snapshot has a different projection.
export function useOfflineChildHifz(childId: string) {
  const data = useOfflinePortalSnapshot();
  return data?.activeStudent?.id === childId && data.hifzProfiles
    ? {
        hifz_logs: data.hifzLogs,
        hifz_profiles: data.hifzProfiles,
        hifz_weekly_sabina: data.hifzWeeklySabina,
        hifz_special_sabina: data.hifzSpecialSabina,
      }
    : null;
}
