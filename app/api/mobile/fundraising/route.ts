import { createMobileMetadataHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileMetadataHandlers({
  storeKey: "mahfils",
  module: "fundraising",
  idPrefix: "mah",
  searchFields: ["title", "venue", "status"],
  requiredFields: ["title"],
});

export { GET, POST };
