import PortalOwnerProvider from "@/components/portal/PortalOwnerProvider";
import { redirect } from "next/navigation";
import { webIdentity, hasRole } from "@/lib/portal/identity";
import { HEALTH_ROLES } from "@/lib/student-health/model";
import { teacherRoles, studentRoles } from "@/lib/portal/rules";
import TeacherShell from "./TeacherShell";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await webIdentity();
  if (!identity) redirect("/login");
  if (!hasRole(identity, [...teacherRoles, "super_admin", "admin", "muhtamim"])) redirect("/dashboard");
  return (
    <PortalOwnerProvider
      owner={`${identity.tenant}:${identity.user.id}:teacher`}
    >
      <TeacherShell
        user={identity.user}
        userData={{
          ...identity.userRow,
          canUseHealth: hasRole(identity, HEALTH_ROLES) && !hasRole(identity, studentRoles),
          role:
            [identity.userRow.role, ...identity.perms.roles].find((r) =>
              teacherRoles.includes(r),
            ) || "teacher",
        }}
      >
        {children}
      </TeacherShell>
    </PortalOwnerProvider>
  );
}
