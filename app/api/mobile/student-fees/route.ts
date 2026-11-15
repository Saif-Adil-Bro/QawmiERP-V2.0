import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "student_fees",
  module: "finance",
  select: "*, students(id, full_name, roll_number, student_id_code), fee_types(id, name)",
  filterColumns: ["student_id", "fee_type_id", "status", "month", "year"],
  defaultSort: "due_date",
  requiredFields: ["student_id", "fee_type_id", "amount"],
});

export { GET, POST };
