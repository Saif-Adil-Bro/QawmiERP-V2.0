import { createMobileMetadataHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileMetadataHandlers({
  storeKey: "holidays",
  module: "holidays",
  idPrefix: "hol",
  searchFields: ["title", "type"],
  requiredFields: ["title", "start_date"],
});

export { GET, POST };
