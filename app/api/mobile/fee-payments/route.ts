import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "fee_payments",
  module: "finance",
  select: "*, students(id, full_name, roll_number, student_id_code), fee_payment_allocations(*)",
  searchColumns: ["receipt_no", "payment_method"],
  filterColumns: ["student_id", "status", "payment_method"],
  defaultSort: "payment_date",
  requiredFields: ["student_id", "total_amount_received"],
});

export { GET, POST };
