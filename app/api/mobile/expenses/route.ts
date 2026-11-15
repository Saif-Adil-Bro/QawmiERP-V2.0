import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "expenses",
  module: "finance",
  select: "*",
  searchColumns: ["category", "description", "voucher_no"],
  filterColumns: ["category", "expense_date"],
  defaultSort: "expense_date",
  requiredFields: ["category", "amount"],
});

export { GET, POST };
