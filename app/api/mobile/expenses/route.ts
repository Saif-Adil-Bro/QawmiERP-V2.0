import { validateMobilePosting } from "@/lib/finance/mobile-posting";
import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  allowPortalRead:false,
  table: "expenses",
  beforeWrite: validateMobilePosting("expense"),
  module: "finance",
  select: "*",
  searchColumns: ["category", "description", "voucher_no"],
  filterColumns: ["category", "expense_date"],
  defaultSort: "expense_date",
  requiredFields: ["fund_id", "category", "amount"],
});

export { GET, POST };
