import { createMobileTableHandlers } from "@/lib/mobile-api";
import { mobileDonor } from "@/lib/finance/mobile-donors";
export const dynamic = "force-dynamic";
export const { GET, POST } = createMobileTableHandlers({
  table: "donors",
  module: "zakat",
  presentRow: mobileDonor,
  select: "id,name,phone,address,donor_type,created_at",
  allowPortalRead: false,
  searchColumns: ["name"],
  filterColumns: ["donor_type"],
  defaultSort: "created_at",
  requiredFields: ["name"],
});
