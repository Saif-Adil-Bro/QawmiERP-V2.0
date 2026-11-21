import { guardMobileResult } from "@/lib/mobile-exam-guard";
import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "exam_results",
  module: "exams",
  allowPortalRead: false,
  beforeWrite: guardMobileResult,
  select: "*, exams(id, title), students(id, full_name, roll_number, student_id_code), subjects(id, name)",
  filterColumns: ["exam_id", "student_id", "subject_id"],
  defaultSort: "created_at",
  requiredFields: ["exam_id", "student_id", "subject_id", "marks_obtained", "total_marks"],
});

export { GET, POST };
