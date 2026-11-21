import { guardMobileExam } from "@/lib/mobile-exam-guard";
import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "exams",
  module: "exams",
  allowPortalRead: false,
  beforeWrite: guardMobileExam,
  select: "*, academic_sessions(id, name)",
  searchColumns: ["title", "description"],
  filterColumns: ["session_id", "is_published"],
  defaultSort: "created_at",
  requiredFields: ["title"],
});

export { GET, POST };
