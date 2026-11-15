import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "hifz_logs",
  module: "hifz",
  select: "*, students(id, full_name, roll_number, student_id_code)",
  filterColumns: ["student_id", "date", "status"],
  defaultSort: "date",
  requiredFields: ["student_id"],
});

export { GET, POST };
