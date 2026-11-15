import { createMobileMetadataHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileMetadataHandlers({
  storeKey: "biometric_devices",
  module: "biometric",
  idPrefix: "bio",
  searchFields: ["device_name", "serial_number", "location"],
  requiredFields: ["device_name"],
});

export { GET, POST };
