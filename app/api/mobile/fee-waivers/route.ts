import {mobileError, createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "fee_discount_waivers",
  module: "finance",
  allowPortalRead:false,
  select: "id,student_id,session_id,fee_type_id,discount_type,value,reason,status,created_at",
  beforeWrite:async()=>mobileError("ছাড় বা মওকুফের জন্য শিক্ষার্থীর ফি আদায় ফর্ম ব্যবহার করুন।",409,"CASHIER_APPROVAL_REQUIRED"),
  filterColumns: ["student_id", "status", "session_id"],
  defaultSort: "created_at",
  requiredFields: ["student_id", "discount_type"],
});

export { GET, POST };
