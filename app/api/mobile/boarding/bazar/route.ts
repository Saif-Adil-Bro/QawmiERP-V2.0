import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "bazar_expenses",
  module: "boarding",
  select: "*",
  searchColumns: ["item_name", "notes", "buyer_name"],
  filterColumns: ["expense_date"],
  defaultSort: "expense_date",
  requiredFields: ["item_name", "amount"],
});

export { GET, POST };
