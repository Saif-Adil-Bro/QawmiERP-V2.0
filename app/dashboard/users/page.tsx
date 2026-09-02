import { getMadrasaUsers, getLinkableProfiles } from "@/app/actions/users";
import { getMadrasaRolesAndPermissions } from "@/app/actions/permissions";
import UserManagementClient from "./UserManagementClient";
import PermissionGuard from "@/components/permissions/PermissionGuard";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [usersRes, profilesRes, rolesRes] = await Promise.all([
    getMadrasaUsers(),
    getLinkableProfiles(),
    getMadrasaRolesAndPermissions(),
  ]);

  return (
    <PermissionGuard permission="user.view">
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <UserManagementClient
          initialUsers={usersRes.users || []}
          teachers={profilesRes.teachers || []}
          students={profilesRes.students || []}
          initialSystemRoles={rolesRes.systemRoles || []}
          initialCustomRoles={rolesRes.customRoles || []}
          initialAllRoles={rolesRes.allRoles || []}
          initialAuditLogs={rolesRes.auditLogs || []}
          initialApprovalRequests={rolesRes.approvalRequests || []}
          initialSecurityProfiles={rolesRes.userSecurityProfiles || {}}
        />
      </div>
    </PermissionGuard>
  );
}
