import { createMobileMetadataItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileMetadataItemHandlers({
  storeKey: "syllabuses",
  module: "syllabus",
});

export { GET, PATCH, PUT, DELETE };
