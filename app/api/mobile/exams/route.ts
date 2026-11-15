import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "exams",
  module: "exams",
  select: "*, academic_sessions(id, name)",
  searchColumns: ["title", "description"],
  filterColumns: ["session_id", "is_published"],
  defaultSort: "created_at",
  requiredFields: ["title"],
});

export { GET, POST };
