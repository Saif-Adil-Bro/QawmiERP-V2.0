import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  table: "student_fees",
  module: "finance",
  detailSelect: "*, students(id, full_name, roll_number, student_id_code), fee_types(id, name)",
});

export { GET, PATCH, PUT, DELETE };
