import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "academic_sessions",
  module: "sessions",
  select: "*",
  searchColumns: ["name"],
  filterColumns: ["is_active"],
  defaultSort: "created_at",
  requiredFields: ["name"],
});

export { GET, POST };
