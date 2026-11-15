import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  table: "donors",
  module: "zakat",
  detailSelect: "*, donations(*)",
});

export { GET, PATCH, PUT, DELETE };
