import { createMobileMetadataItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileMetadataItemHandlers({
  storeKey: "admissions",
  module: "admissions",
});

export { GET, PATCH, PUT, DELETE };
