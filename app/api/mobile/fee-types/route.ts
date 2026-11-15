import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "fee_types",
  module: "finance",
  select: "*",
  searchColumns: ["name", "code"],
  filterColumns: ["frequency", "is_active"],
  defaultSort: "created_at",
  requiredFields: ["name"],
});

export { GET, POST };
