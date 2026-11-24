import { salaryAccess, expenseForView } from "@/lib/finance/staff-access";
import { validateMobilePosting } from "@/lib/finance/mobile-posting";
import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
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
});

export { GET, PATCH, PUT, DELETE };
