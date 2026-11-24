import {legacyFeeRead,mobileSchedule} from "@/lib/finance/mobile-schedules";
import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  allowPortalRead:false,
  beforeWrite:mobileSchedule("fee_structures"),
  beforeRead:legacyFeeRead,
  table: "fee_structures",
  module: "finance",
  select: "*, fee_structure_items(*, fee_types(id, name))",
  searchColumns: ["name"],
  filterColumns: ["class_id", "session_id"],
  defaultSort: "created_at",
  requiredFields: ["name"],
});

export { GET, POST };
