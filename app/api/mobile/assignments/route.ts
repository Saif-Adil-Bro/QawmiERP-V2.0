import { createMobileMetadataHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileMetadataHandlers({
  storeKey: "assignments",
  module: "syllabus",
  idPrefix: "asg",
  searchFields: ["title", "description", "subject_name", "class_name"],
  requiredFields: ["title"],
});

export { GET, POST };
