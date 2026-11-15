import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "class_subjects",
  module: "subjects",
  select: "*, classes(id, name), subjects(id, name, code)",
  filterColumns: ["class_id", "subject_id"],
  defaultSort: "created_at",
  requiredFields: ["class_id", "subject_id"],
});

export { GET, POST };
