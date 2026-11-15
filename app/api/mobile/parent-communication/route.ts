import { createMobileMetadataHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileMetadataHandlers({
  storeKey: "parent_feedbacks",
  module: "communication",
  idPrefix: "pfb",
  searchFields: ["parent_name", "student_name", "subject", "message", "status"],
  requiredFields: ["message"],
});

export { GET, POST };
