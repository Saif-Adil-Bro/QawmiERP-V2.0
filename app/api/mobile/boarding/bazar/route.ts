import { validateMobilePosting } from "@/lib/finance/mobile-posting";
import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  allowPortalRead:false,
  table: "bazar_expenses",
  beforeWrite: validateMobilePosting("bazar"),
  module: "finance",
  select: "*",
  searchColumns: ["items_details", "voucher_no", "buyer_name"],
  filterColumns: ["expense_date"],
  defaultSort: "expense_date",
  requiredFields: ["fund_id", "items_details", "amount"],
});

export { GET, POST };
