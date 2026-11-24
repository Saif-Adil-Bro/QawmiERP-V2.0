import PortalOwnerProvider from "@/components/portal/PortalOwnerProvider";
import { redirect } from "next/navigation";
import { webIdentity, hasRole } from "@/lib/portal/identity";
import { studentRoles } from "@/lib/portal/rules";
import PortalShell from "./PortalShell";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
  health,
}: {
  children: React.ReactNode;
  health: React.ReactNode;
}) {
  const identity = await webIdentity();
  if (!identity) redirect("/login");
  if (!hasRole(identity, [...studentRoles, "super_admin", "admin", "muhtamim"])) redirect("/dashboard");
  return (
    <PortalOwnerProvider
      owner={`${identity.tenant}:${identity.user.id}:student`}
    >
      <PortalShell
        user={identity.user}
        userData={{
          ...identity.userRow,
          role:
            [identity.userRow.role, ...identity.perms.roles].find((r) =>
              studentRoles.includes(r),
            ) || "student",
        }}
      >
        {health}
        {children}
      </PortalShell>
    </PortalOwnerProvider>
  );
}
