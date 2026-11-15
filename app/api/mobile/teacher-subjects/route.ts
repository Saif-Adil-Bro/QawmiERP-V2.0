import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "teacher_subjects",
  module: "teachers",
  select: "*, teachers(id, full_name), classes(id, name), subjects(id, name, code)",
  filterColumns: ["teacher_id", "class_id", "subject_id"],
  defaultSort: "created_at",
  requiredFields: ["teacher_id", "class_id", "subject_id"],
});

export { GET, POST };
