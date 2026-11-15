import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "students",
  module: "students",
  select: "*, classes(id, name)",
  detailSelect: "*, classes(id, name)",
  searchColumns: ["full_name", "roll_number", "guardian_name", "parent_phone", "student_id_code"],
  filterColumns: ["class_id", "status", "gender"],
  defaultSort: "created_at",
  requiredFields: ["full_name", "class_id"],
});

export { GET, POST };
