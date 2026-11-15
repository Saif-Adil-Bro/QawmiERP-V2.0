import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  table: "classes",
  module: "classes",
  detailSelect: "*, class_subjects(*, subjects(id, name, code))",
});

export { GET, PATCH, PUT, DELETE };
