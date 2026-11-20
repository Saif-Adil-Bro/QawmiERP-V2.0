export const dynamic = "force-dynamic";

import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getPortalRedirectUrl } from "@/lib/role-redirect";
import type { AppMode } from "@/components/mode/ModeContext";
import DashboardShell from "./DashboardShell";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  let initialMode: AppMode = "advanced";

  try {
    const cookieStore = await cookies();
    const cookieMode = cookieStore.get("qawmi_app_mode")?.value;
    if (cookieMode === "basic" || cookieMode === "advanced") {
      initialMode = cookieMode;
    }

    const user = await getAuthUser();
    if (user) {
      let dbRole: string | null = null;
      try {
        const rawCache = cookieStore.get("qawmi_mw_cache")?.value;
        if (rawCache) {
          const parsed = JSON.parse(rawCache);
          if (parsed?.uid === user.id && parsed?.role && parsed?.exp > Date.now()) {
            dbRole = parsed.role;
          }
        }
      } catch {
        dbRole = null;
      }

      if (!dbRole) {
        try {
          const supabase = await createClient();
          const { data: userRow } = await supabase
            .from("users")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();
          dbRole = userRow?.role || null;
        } catch {
          dbRole = null;
        }
      }

      const effectiveRole = dbRole || user.user_metadata?.role;
      const targetPortal = getPortalRedirectUrl(effectiveRole);
      if (targetPortal !== "/dashboard") {
        redirect(targetPortal);
      }
    }

    const remoteMode = user?.user_metadata?.app_mode;
    if (remoteMode === "basic" || remoteMode === "advanced") {
      initialMode = remoteMode;
    }
  } catch (err: any) {
    if (err?.digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    // Fallback to default advanced mode
  }

  return <DashboardShell initialMode={initialMode}>{children}</DashboardShell>;
}

