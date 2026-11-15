import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "notices",
  module: "communication",
  select: "*",
  searchColumns: ["title", "content", "target_audience"],
  filterColumns: ["target_audience", "is_published"],
  defaultSort: "created_at",
  requiredFields: ["title", "content"],
});

export { GET, POST };
