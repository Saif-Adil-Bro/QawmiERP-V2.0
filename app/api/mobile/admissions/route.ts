import { createMobileMetadataHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileMetadataHandlers({
  storeKey: "admissions",
  module: "admissions",
  idPrefix: "adm",
  searchFields: ["student_name", "guardian_name", "phone", "tracking_no"],
  requiredFields: ["student_name"],
});

export { GET, POST };
