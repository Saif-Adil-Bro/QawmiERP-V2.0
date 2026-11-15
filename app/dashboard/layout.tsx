export const dynamic = "force-dynamic";

import { ReactNode } from "react";
import { cookies } from "next/headers";
import { getAuthUser } from "@/lib/supabase/server";
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
    const remoteMode = user?.user_metadata?.app_mode;
    if (remoteMode === "basic" || remoteMode === "advanced") {
      initialMode = remoteMode;
    }
  } catch {
    // Fallback to default advanced mode
  }

  return <DashboardShell initialMode={initialMode}>{children}</DashboardShell>;
}

