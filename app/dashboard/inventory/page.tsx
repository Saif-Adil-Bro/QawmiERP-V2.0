import { getInventoryData } from "@/app/actions/inventory";
import InventoryClient from "./InventoryClient";
import PermissionGuard from "@/components/permissions/PermissionGuard";

export default async function InventoryPage() {
  const data = await getInventoryData();

  return (
    <PermissionGuard permission="expense.view">
      <InventoryClient
        initialItems={data.items || []}
        initialAllocations={data.allocations || []}
        initialMaintenance={data.maintenance || []}
      />
    </PermissionGuard>
  );
}
