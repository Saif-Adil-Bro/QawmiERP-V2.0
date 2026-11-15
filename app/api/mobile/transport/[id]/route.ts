import { createMobileMetadataItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileMetadataItemHandlers({
  storeKey: "transport_vehicles",
  module: "generic",
});

export { GET, PATCH, PUT, DELETE };
