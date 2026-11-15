import { createMobileMetadataHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileMetadataHandlers({
  storeKey: "staff_members",
  module: "staff",
  idPrefix: "stf",
  searchFields: ["full_name", "name", "phone", "designation", "category"],
  requiredFields: ["full_name"],
});

export { GET, POST };
