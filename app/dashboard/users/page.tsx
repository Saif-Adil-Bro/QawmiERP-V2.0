import { getMadrasaUsers, getLinkableProfiles } from "@/app/actions/users";
import { getMadrasaRolesAndPermissions } from "@/app/actions/permissions";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import UserManagementClient from "./UserManagementClient";
import PermissionGuard from "@/components/permissions/PermissionGuard";
import AccessDeniedMessage from "@/components/permissions/AccessDeniedMessage";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { loadServerPermissions } from "@/lib/permissions-server";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  // ⛔ CR-6 ফিক্স: আগে সব ডেটা (ইউজার তালিকা, শিক্ষক/শিক্ষার্থী প্রোফাইল, রোল ও
  // নিরাপত্তা কনফিগ, অডিট লগ) PermissionGuard-এর আগেই সার্ভারে ফেচ হয়ে RSC পেলোডে
  // ব্রাউজারে চলে যেত — আর PermissionGuard কেবল একটি ক্লায়েন্ট কম্পোনেন্ট, তাই সে
  // শুধু DOM লুকাতে পারত, ডেটা লিক ঠেকাতে পারত না। এখন ফেচ করার *আগেই* সার্ভারে
  // অনুমতি যাচাই করা হয়; অনুমতি না থাকলে ডেটা একেবারেই লোড হয় না।
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  if (!authUser) {
    return (
      <div className="p-6">
        <AccessDeniedMessage requiredPermission="user.view" />
      </div>
    );
  }

  const madrasaId = await getAuthMadrasaId(supabase, authUser);
  const permissionCtx = madrasaId
    ? await loadServerPermissions(authUser.id, madrasaId)
    : null;

  const canViewUsers =
    !!permissionCtx &&
    (permissionCtx.roles.includes("super_admin") ||
      permissionCtx.role === "super_admin" ||
      permissionCtx.summary.effectivePermissions.includes("user.view"));

  if (!canViewUsers) {
    return (
      <div className="p-6">
        <AccessDeniedMessage requiredPermission="user.view" />
      </div>
    );
  }

  // অনুমতি নিশ্চিত হওয়ার পরেই ডেটা লোড — এখন কোনো অতিরিক্ত ডেটা ব্রাউজারে যায় না।
  const [usersRes, profilesRes, rolesRes, madrasaInfo] = await Promise.all([
    getMadrasaUsers(),
    getLinkableProfiles(),
    getMadrasaRolesAndPermissions(),
    getMadrasaInfo(),
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
          madrasaInfo={madrasaInfo}
        />
      </div>
    </PermissionGuard>
  );
}
