import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "student_enrollments",
  module: "sessions",
  select: "*, students(id, full_name, roll_number), classes(id, name), academic_sessions(id, name)",
  filterColumns: ["student_id", "class_id", "session_id", "status"],
  defaultSort: "created_at",
  requiredFields: ["student_id", "class_id", "session_id"],
});

export { GET, POST };
