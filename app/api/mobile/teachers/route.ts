import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "teachers",
  module: "teachers",
  select: "*",
  searchColumns: ["full_name", "phone", "email", "designation"],
  filterColumns: ["status"],
  defaultSort: "created_at",
  requiredFields: ["full_name"],
});

export { GET, POST };
