import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  table: "exam_results",
  module: "exams",
  detailSelect: "*, exams(id, title), students(id, full_name, roll_number), subjects(id, name)",
});

export { GET, PATCH, PUT, DELETE };
