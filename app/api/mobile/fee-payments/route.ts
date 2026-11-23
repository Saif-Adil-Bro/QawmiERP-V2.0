import {legacyFeeRead} from "@/lib/finance/mobile-schedules";
import {feeReceiptWrite} from "@/lib/finance/mobile-fees";
import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  beforeWrite:feeReceiptWrite,
  allowPortalRead:false,
  beforeRead:legacyFeeRead,
  table: "fee_payments",
  module: "finance",
  select: "*, students(id, first_name, last_name, roll_number), fee_payment_allocations(*)",
  searchColumns: ["receipt_no", "payment_method"],
  filterColumns: ["student_id", "status", "payment_method"],
  defaultSort: "payment_date",
  requiredFields: ["student_id", "total_amount_received"],
});

export { GET, POST };
