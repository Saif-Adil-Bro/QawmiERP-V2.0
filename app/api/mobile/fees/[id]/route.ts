import {legacyFeeWrite} from "@/lib/finance/mobile-fees";
import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  beforeWrite:legacyFeeWrite,
  allowPortalRead:false,
  table: "fees",
  module: "finance",
  detailSelect: "*, students(id, first_name, last_name, roll_number)",
});

export { GET, PATCH, PUT, DELETE };
