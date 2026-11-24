import { salaryAccess, expenseForView } from "@/lib/finance/staff-access";
import { validateMobilePosting } from "@/lib/finance/mobile-posting";
import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  allowPortalRead: false,
  table: "expenses",
  presentRow: (row, ctx) =>
    expenseForView(
      row,
      salaryAccess(
        {
          allowed: true,
          roles: [ctx.role, ...ctx.roles],
          permissions: ctx.permissions,
        },
        "read",
      ),
    ),
  beforeWrite: validateMobilePosting("expense"),
  module: "finance",
  select: "*",
  // Matching a hidden salary description would itself link the worker to an amount.
  readSearchColumns: (ctx) =>
    salaryAccess(
      { allowed: true, roles: ctx.roles, permissions: ctx.permissions },
      "read",
    )
      ? ["category", "description", "voucher_no"]
      : ["category", "voucher_no"],
  sortColumns: [
    "id",
    "expense_date",
    "voucher_no",
    "category",
    "amount",
    "created_at",
  ],
  filterColumns: ["category", "expense_date"],
  defaultSort: "expense_date",
  requiredFields: ["fund_id", "category", "amount"],
});

export { GET, POST };
