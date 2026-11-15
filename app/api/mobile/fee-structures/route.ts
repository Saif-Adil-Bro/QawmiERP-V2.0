import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "fee_structures",
  module: "finance",
  select: "*, classes(id, name), academic_sessions(id, name), fee_structure_items(*, fee_types(id, name))",
  searchColumns: ["name"],
  filterColumns: ["class_id", "session_id", "is_active"],
  defaultSort: "created_at",
  requiredFields: ["name"],
});

export { GET, POST };
