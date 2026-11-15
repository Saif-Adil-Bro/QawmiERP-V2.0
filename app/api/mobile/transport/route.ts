import { createMobileMetadataHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileMetadataHandlers({
  storeKey: "transport_vehicles",
  module: "generic",
  idPrefix: "veh",
  searchFields: ["vehicle_name", "plate_number", "driver_name", "route_name"],
  requiredFields: ["vehicle_name"],
});

export { GET, POST };
