import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "routines",
  module: "routine",
  select: "*, classes(id, name), subjects(id, name), teachers(id, full_name)",
  filterColumns: ["class_id", "teacher_id", "day_of_week"],
  defaultSort: "created_at",
  requiredFields: ["class_id", "day_of_week"],
});

export { GET, POST };
