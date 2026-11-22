export const dynamic = "force-dynamic";

import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {webIdentity} from "@/lib/portal/identity";
import { getPortalRedirectUrl } from "@/lib/role-redirect";
import type { AppMode } from "@/components/mode/ModeContext";
import DashboardShell from "./DashboardShell";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  let initialMode: AppMode = "advanced";

  const i=await webIdentity();
  if (!i) redirect('/login');
  const target=getPortalRedirectUrl(i.userRow.role,i.perms.roles);
  if(target!=='/dashboard') redirect(target);
  const cookieMode=(await cookies()).get('qawmi_app_mode')?.value;
  const mode=i.user.user_metadata?.app_mode ?? cookieMode;
  if(mode==='basic' || mode==='advanced') initialMode=mode;
  return <DashboardShell initialMode={initialMode}>{children}</DashboardShell>;
}

