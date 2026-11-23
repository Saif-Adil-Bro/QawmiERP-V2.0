import { getFundChoices } from "@/app/actions/zakat";
import { getInventoryData } from "@/app/actions/inventory";
import InventoryClient from "./InventoryClient";
import PermissionGuard from "@/components/permissions/PermissionGuard";

export default async function InventoryPage() {
  const [data, funds] = await Promise.all([getInventoryData(),getFundChoices()]);

  return (
    <PermissionGuard permission="expense.view">
      <InventoryClient funds={funds}
        initialItems={data.items || []}
        initialAllocations={data.allocations || []}
        initialMaintenance={data.maintenance || []}
      />
    </PermissionGuard>
  );
}
