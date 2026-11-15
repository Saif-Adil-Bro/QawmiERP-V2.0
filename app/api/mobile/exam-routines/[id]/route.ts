import { createMobileMetadataItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileMetadataItemHandlers({
  storeKey: "exam_routines",
  module: "exams",
});

export { GET, PATCH, PUT, DELETE };
