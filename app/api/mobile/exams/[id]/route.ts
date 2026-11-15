import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  table: "exams",
  module: "exams",
  detailSelect: "*, academic_sessions(id, name), exam_results(*, students(id, full_name, roll_number), subjects(id, name))",
});

export { GET, PATCH, PUT, DELETE };
