import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "attendance",
  module: "attendance",
  select: "*, students(id, full_name, roll_number, student_id_code, class_id)",
  filterColumns: ["student_id", "date", "status"],
  defaultSort: "date",
  requiredFields: ["student_id", "date", "status"],
});

export { GET, POST };
