import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "kitab_logs",
  module: "kitab",
  select: "*, students(id, full_name, roll_number, student_id_code)",
  filterColumns: ["student_id", "date"],
  defaultSort: "date",
  requiredFields: ["student_id"],
});

export { GET, POST };
