import { createMobileMetadataHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileMetadataHandlers({
  storeKey: "issued_certificates",
  module: "certificates",
  idPrefix: "cert",
  searchFields: ["student_name", "certificate_no", "type"],
  requiredFields: ["student_id", "type"],
});

export { GET, POST };
