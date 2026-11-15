import { createMobileMetadataHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileMetadataHandlers({
  storeKey: "id_card_templates",
  module: "certificates",
  idPrefix: "idc",
  searchFields: ["name", "target_type"],
  requiredFields: ["name"],
});

export { GET, POST };
