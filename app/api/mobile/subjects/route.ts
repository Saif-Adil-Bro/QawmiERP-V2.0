import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "subjects",
  module: "subjects",
  select: "*",
  searchColumns: ["name", "code", "description"],
  defaultSort: "created_at",
  requiredFields: ["name"],
});

export { GET, POST };
