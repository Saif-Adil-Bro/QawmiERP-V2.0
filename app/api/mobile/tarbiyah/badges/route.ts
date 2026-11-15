import { createMobileMetadataHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileMetadataHandlers({
  storeKey: "tarbiyah_badges",
  module: "students",
  idPrefix: "trb",
  searchFields: ["student_name", "badge_title", "category"],
  requiredFields: ["student_id", "badge_title"],
});

export { GET, POST };
