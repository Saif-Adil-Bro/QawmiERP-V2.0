import {legacyFeeRead} from "@/lib/finance/mobile-schedules";
import {feeReceiptWrite} from "@/lib/finance/mobile-fees";
import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  beforeWrite:feeReceiptWrite,
  allowPortalRead:false,
  beforeRead:legacyFeeRead,
  table: "fee_payments",
  module: "finance",
  detailSelect: "*, students(id, first_name, last_name, roll_number), fee_payment_allocations(*, student_fees(*))",
});

export { GET, PATCH, PUT, DELETE };
