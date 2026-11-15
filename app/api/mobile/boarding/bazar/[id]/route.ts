import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  table: "bazar_expenses",
  module: "boarding",
});

export { GET, PATCH, PUT, DELETE };
