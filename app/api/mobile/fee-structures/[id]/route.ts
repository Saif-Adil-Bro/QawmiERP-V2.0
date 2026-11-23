import {legacyFeeRead,mobileSchedule} from "@/lib/finance/mobile-schedules";
import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  allowPortalRead:false,
  beforeWrite:mobileSchedule("fee_structures"),
  beforeRead:legacyFeeRead,
  table: "fee_structures",
  module: "finance",
  detailSelect: "*, fee_structure_items(*, fee_types(id, name))",
});

export { GET, PATCH, PUT, DELETE };
