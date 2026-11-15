import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  table: "fee_structures",
  module: "finance",
  detailSelect: "*, classes(id, name), academic_sessions(id, name), fee_structure_items(*, fee_types(id, name))",
});

export { GET, PATCH, PUT, DELETE };
