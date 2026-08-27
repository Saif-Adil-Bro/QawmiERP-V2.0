import { getMadrasaUsers, getLinkableProfiles } from "@/app/actions/users";
import UserManagementClient from "./UserManagementClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [usersRes, profilesRes] = await Promise.all([
    getMadrasaUsers(),
    getLinkableProfiles(),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <UserManagementClient
        initialUsers={usersRes.users || []}
        teachers={profilesRes.teachers || []}
        students={profilesRes.students || []}
      />
    </div>
  );
}
