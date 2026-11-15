import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  table: "fees",
  module: "finance",
  detailSelect: "*, students(id, full_name, roll_number, student_id_code)",
});

export { GET, PATCH, PUT, DELETE };
