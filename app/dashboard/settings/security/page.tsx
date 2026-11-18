import { redirect } from "next/navigation";
import { getSecurityOverviewAction } from "@/app/actions/security";
import SecuritySettingsClient from "./SecuritySettingsClient";
import {
  DEFAULT_TENANT_MASKING_POLICY,
  DEFAULT_TENANT_STEP_UP_POLICY,
} from "@/lib/step-up-auth";

export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage() {
  const overview = await getSecurityOverviewAction("self");

  if (!overview.success || !overview.mfa) {
    redirect("/login");
  }

  return (
    <SecuritySettingsClient
      initialSessions={overview.sessions || []}
      initialCurrentSessionId={overview.currentSessionId || null}
      canManageAllSessions={Boolean(overview.canManageAllSessions)}
      canManageTenantPolicy={Boolean(overview.canManageTenantPolicy)}
      initialMfa={overview.mfa}
      initialStepUpPolicy={overview.stepUpPolicy || DEFAULT_TENANT_STEP_UP_POLICY}
      initialMaskingPolicy={overview.maskingPolicy || DEFAULT_TENANT_MASKING_POLICY}
    />
  );
}
