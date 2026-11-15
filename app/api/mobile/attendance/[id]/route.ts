import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  table: "attendance",
  module: "attendance",
  detailSelect: "*, students(id, full_name, roll_number, student_id_code, class_id)",
});

export { GET, PATCH, PUT, DELETE };
