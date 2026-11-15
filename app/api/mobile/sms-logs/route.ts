import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "sms_logs",
  module: "communication",
  select: "*",
  searchColumns: ["phone", "message", "status"],
  filterColumns: ["status"],
  defaultSort: "created_at",
  requiredFields: ["phone", "message"],
});

export { GET, POST };
