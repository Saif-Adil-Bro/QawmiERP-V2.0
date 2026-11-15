import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  table: "students",
  module: "students",
  detailSelect: "*, classes(id, name), student_enrollments(*, academic_sessions(id, name))",
});

export { GET, PATCH, PUT, DELETE };
