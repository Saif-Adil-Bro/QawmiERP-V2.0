import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "donations",
  module: "zakat",
  select: "*, donors(id, name, phone), zakat_funds(id, name, type)",
  searchColumns: ["receipt_no", "notes", "donor_name"],
  filterColumns: ["donor_id", "fund_id", "donation_date"],
  defaultSort: "donation_date",
  requiredFields: ["amount"],
});

export { GET, POST };
