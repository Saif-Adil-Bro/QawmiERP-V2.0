import {logAuditEvent} from "@/lib/audit-log";
import {mobileDonation} from "@/lib/finance/mobile-donors";
import { validateMobilePosting } from "@/lib/finance/mobile-posting";
import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  allowPortalRead:false,
  table: "donations",
  afterCreate:async(row,ctx)=>(await logAuditEvent({madrasaId:ctx.madrasaId,actorId:ctx.userId,module:"finance",action:"DONATION_RECEIPT_CREATED",entityType:"donation",entityId:row.id,entityLabel:row.receipt_no,summary:`দান-রসিদ তৈরি: ${row.receipt_no || row.id}`,metadata:{channel:"mobile"}})).success,
  presentRow:mobileDonation,
  beforeWrite: validateMobilePosting("deposit"),
  module: "zakat",
  select: "id,madrasa_id,donor_id,member_id,receipt_no,amount,donation_type,donation_date,fund_id,fund_name,status,voided_at,created_at,notes,donors(id,name,madrasa_id)",
  searchColumns: ["receipt_no"],
  filterColumns: ["donor_id","member_id", "fund_id", "donation_date"],
  defaultSort: "donation_date",
  requiredFields: ["fund_id", "amount"],
});

export { GET, POST };
