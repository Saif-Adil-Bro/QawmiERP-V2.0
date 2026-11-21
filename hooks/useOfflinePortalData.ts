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
