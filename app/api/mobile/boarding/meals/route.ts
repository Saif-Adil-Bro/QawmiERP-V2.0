import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "meal_entries",
  module: "boarding",
  select: "*, students(id, full_name, roll_number)",
  filterColumns: ["student_id", "date", "meal_type"],
  defaultSort: "date",
  requiredFields: ["student_id", "date"],
});

export { GET, POST };
