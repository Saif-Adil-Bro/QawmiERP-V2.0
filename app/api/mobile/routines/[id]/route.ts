import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  table: "routines",
  module: "routine",
  detailSelect: "*, classes(id, name), subjects(id, name), teachers(id, full_name)",
});

export { GET, PATCH, PUT, DELETE };
