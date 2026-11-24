import {legacyFeeRead,mobileSchedule} from "@/lib/finance/mobile-schedules";
import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  allowPortalRead:false,
  beforeWrite:mobileSchedule("fee_types"),
  beforeRead:legacyFeeRead,
  table: "fee_types",
  module: "finance",
});

export { GET, PATCH, PUT, DELETE };
