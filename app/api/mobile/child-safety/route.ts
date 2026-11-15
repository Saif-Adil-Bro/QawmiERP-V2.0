import { createMobileMetadataHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileMetadataHandlers({
  storeKey: "child_safety_reports",
  module: "generic",
  idPrefix: "csf",
  searchFields: ["title", "description", "status"],
  requiredFields: ["title"],
});

export { GET, POST };
