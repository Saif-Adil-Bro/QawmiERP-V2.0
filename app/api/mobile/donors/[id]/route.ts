import { createMobileTableItemHandlers } from "@/lib/mobile-api";

import { mobileDonor } from "@/lib/finance/mobile-donors";
export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  table: "donors",
  module: "zakat",
  allowPortalRead: false,
  presentRow: mobileDonor,
  detailSelect: "id,name,phone,address,donor_type,created_at",
});

export { GET, PATCH, PUT, DELETE };
