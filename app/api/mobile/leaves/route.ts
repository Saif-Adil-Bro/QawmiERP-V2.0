import { createMobileMetadataHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileMetadataHandlers({
  storeKey: "leave_applications",
  module: "leaves",
  idPrefix: "lv",
  searchFields: ["applicant_name", "reason", "status", "type"],
  requiredFields: ["applicant_name", "from_date", "to_date"],
});

export { GET, POST };
