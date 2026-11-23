import {mobileDonation} from "@/lib/finance/mobile-donors";
import { validateMobilePosting } from "@/lib/finance/mobile-posting";
import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  allowPortalRead:false,
  table: "donations",
  presentRow:mobileDonation,
  beforeWrite: validateMobilePosting("deposit"),
  module: "zakat",
  detailSelect: "id,madrasa_id,donor_id,member_id,receipt_no,amount,donation_type,donation_date,fund_id,fund_name,status,voided_at,created_at,notes,donors(id,name,madrasa_id)",
});

export { GET, PATCH, PUT, DELETE };
