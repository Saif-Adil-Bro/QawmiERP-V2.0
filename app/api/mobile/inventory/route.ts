import { createMobileMetadataHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileMetadataHandlers({
  storeKey: "inventory_items",
  module: "inventory",
  idPrefix: "inv",
  searchFields: ["name", "category", "serial_no", "location"],
  requiredFields: ["name"],
});

export { GET, POST };
