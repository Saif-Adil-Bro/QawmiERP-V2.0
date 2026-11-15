import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "fee_discount_waivers",
  module: "finance",
  select: "*, students(id, full_name, roll_number)",
  filterColumns: ["student_id", "is_active"],
  defaultSort: "created_at",
  requiredFields: ["student_id", "discount_type"],
});

export { GET, POST };
