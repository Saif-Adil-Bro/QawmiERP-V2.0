import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "fees",
  module: "finance",
  select: "*, students(id, full_name, roll_number, student_id_code)",
  filterColumns: ["student_id", "month", "year", "status"],
  defaultSort: "payment_date",
  requiredFields: ["student_id", "amount"],
});

export { GET, POST };
