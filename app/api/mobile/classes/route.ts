import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "classes",
  module: "classes",
  select: "*",
  searchColumns: ["name", "department", "section"],
  filterColumns: ["department"],
  defaultSort: "created_at",
  requiredFields: ["name"],
});

export { GET, POST };
