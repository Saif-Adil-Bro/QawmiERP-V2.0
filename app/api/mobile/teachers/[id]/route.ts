import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  table: "teachers",
  module: "teachers",
  detailSelect: "*, teacher_subjects(*, classes(id, name), subjects(id, name))",
});

export { GET, PATCH, PUT, DELETE };
