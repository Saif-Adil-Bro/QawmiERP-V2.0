import {legacyFeeRead} from "@/lib/finance/mobile-schedules";
import {mobileInvoice} from "@/lib/finance/mobile-fees";
import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  beforeWrite:mobileInvoice,
  allowPortalRead:false,
  beforeRead:legacyFeeRead,
  table: "student_fees",
  module: "finance",
  select: "*, students(id, first_name, last_name, roll_number), fee_types(id, name)",
  filterColumns: ["student_id", "fee_type_id", "status", "billing_period", "year"],
  defaultSort: "due_date",
  requiredFields: ["student_id", "fee_type_id", "billing_period"],
});

export { GET, POST };
