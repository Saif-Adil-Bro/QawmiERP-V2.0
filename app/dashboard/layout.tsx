export const dynamic = "force-dynamic";

import { ReactNode } from "react";
import DashboardShell from "./DashboardShell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}

