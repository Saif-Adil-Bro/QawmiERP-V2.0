"use client";
import { useEffect, useState } from "react";
import { ownerKey, browserSession } from "@/lib/offline-auth";
import { PortalOwner } from "@/hooks/useOfflinePortalData";
export default function PortalOwnerProvider({
  owner,
  children,
}: {
  owner: string;
  children: React.ReactNode;
}) {
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    function verify() {
      if (ownerKey(browserSession()) !== owner) {
        setInvalid(true);
        window.location.reload();
      }
    }
    const storage = (e: StorageEvent) => {
      if (!e.key || e.key === "qawmi_offline_auth_session") verify();
    };
    const restored = (e: PageTransitionEvent) => {
      if (e.persisted) verify();
    };
    window.addEventListener("storage", storage);
    window.addEventListener("pageshow", restored);
    return () => {
      window.removeEventListener("storage", storage);
      window.removeEventListener("pageshow", restored);
    };
  }, [owner]);
  if (invalid) return null;
  return <PortalOwner.Provider value={owner}>{children}</PortalOwner.Provider>;
}
