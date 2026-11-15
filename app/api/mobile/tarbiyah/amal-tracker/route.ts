import { createMobileMetadataHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileMetadataHandlers({
  storeKey: "amal_tracker_logs",
  module: "students",
  idPrefix: "aml",
  searchFields: ["student_name", "date"],
  requiredFields: ["student_id", "date"],
});

export { GET, POST };
