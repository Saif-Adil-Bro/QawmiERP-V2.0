import { createMobileMetadataItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileMetadataItemHandlers({
  storeKey: "holidays",
  module: "holidays",
});

export { GET, PATCH, PUT, DELETE };
