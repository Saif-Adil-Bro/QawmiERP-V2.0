export const dynamic = "force-dynamic";

import RegisterForm from "./RegisterForm";
import { getAuthUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPortalRedirectUrl } from "@/lib/role-redirect";

export default async function Home() {
  const user = await getAuthUser();
  if (user) {
    const role = user.user_metadata?.role;
    const targetUrl = getPortalRedirectUrl(role);
    redirect(targetUrl || "/dashboard");
  }

  return <RegisterForm />;
}
