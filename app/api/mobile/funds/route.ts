import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "zakat_funds",
  module: "zakat",
  select: "*",
  searchColumns: ["name", "type", "description"],
  filterColumns: ["type"],
  defaultSort: "created_at",
  requiredFields: ["name"],
});

export { GET, POST };
