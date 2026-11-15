import { createMobileMetadataHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileMetadataHandlers({
  storeKey: "exam_routines",
  module: "exams",
  idPrefix: "exr",
  searchFields: ["exam_title", "class_name", "subject_name"],
  requiredFields: ["exam_id"],
});

export { GET, POST };
