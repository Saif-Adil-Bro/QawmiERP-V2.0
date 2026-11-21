export const dynamic = "force-dynamic";

import RegisterForm from "../RegisterForm";
import { webIdentity } from "@/lib/portal/identity";
import { redirect } from "next/navigation";
import { getPortalRedirectUrl } from "@/lib/role-redirect";

export default async function RegisterPage() {
  const identity = await webIdentity();
  if (identity) redirect(getPortalRedirectUrl(identity.userRow.role, identity.perms.roles));

  return <RegisterForm />;
}
