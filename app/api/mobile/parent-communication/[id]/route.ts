import { createMobileMetadataItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileMetadataItemHandlers({
  storeKey: "parent_feedbacks",
  module: "communication",
});

export { GET, PATCH, PUT, DELETE };
