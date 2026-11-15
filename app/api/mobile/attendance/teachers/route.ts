import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "teacher_attendance",
  module: "attendance",
  select: "*, teachers(id, full_name, phone, designation)",
  filterColumns: ["teacher_id", "date", "status"],
  defaultSort: "date",
  requiredFields: ["teacher_id", "date", "status"],
});

export { GET, POST };
