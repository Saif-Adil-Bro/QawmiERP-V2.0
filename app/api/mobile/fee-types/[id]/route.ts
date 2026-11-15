import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  table: "fee_types",
  module: "finance",
});

export { GET, PATCH, PUT, DELETE };
