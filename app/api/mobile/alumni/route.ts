import { createMobileMetadataHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileMetadataHandlers({
  storeKey: "alumni_records",
  module: "students",
  idPrefix: "alm",
  searchFields: ["full_name", "batch", "phone", "occupation"],
  requiredFields: ["full_name"],
});

export { GET, POST };
