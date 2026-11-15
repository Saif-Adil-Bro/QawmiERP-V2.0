import { createMobileMetadataHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileMetadataHandlers({
  storeKey: "syllabuses",
  module: "syllabus",
  idPrefix: "syl",
  searchFields: ["title", "subject_name", "class_name"],
  requiredFields: ["title"],
});

export { GET, POST };
