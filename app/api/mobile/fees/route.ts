import {legacyFeeWrite} from "@/lib/finance/mobile-fees";
import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  beforeWrite:legacyFeeWrite,
  allowPortalRead:false,
  table: "fees",
  module: "finance",
  select: "*, students(id, first_name, last_name, roll_number)",
  filterColumns: ["student_id", "month", "year", "status"],
  defaultSort: "payment_date",
  requiredFields: ["student_id", "amount"],
});

export { GET, POST };
