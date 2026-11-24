import {legacyFeeRead} from "@/lib/finance/mobile-schedules";
import {mobileInvoice} from "@/lib/finance/mobile-fees";
import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  beforeWrite:mobileInvoice,
  allowPortalRead:false,
  beforeRead:legacyFeeRead,
  table: "student_fees",
  module: "finance",
  detailSelect: "*, students(id, first_name, last_name, roll_number), fee_types(id, name)",
});

export { GET, PATCH, PUT, DELETE };
