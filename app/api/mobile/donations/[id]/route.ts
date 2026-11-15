import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  table: "donations",
  module: "zakat",
  detailSelect: "*, donors(id, name, phone), zakat_funds(id, name, type)",
});

export { GET, PATCH, PUT, DELETE };
