import { getFeeMetadata } from "@/lib/fee-store";
import type { StudentFee } from "@/lib/fee-management";
import type { createAdminClient } from "@/lib/supabase/admin";
import { postingFund, postingError } from "./funds";

type Db = Awaited<ReturnType<typeof createAdminClient>>;
// No receipt, fee waiver, payment or whole-book write is performed by this API.
export async function saveUnpaidBill(
  db: Db,
  tenant: string,
  payload: Record<string, any>,
  prior?: StudentFee | null,
) {
  const student = prior?.student_id ?? payload.student_id,
    type = prior?.fee_type_id ?? payload.fee_type_id;
  if (
    prior &&
    ((payload.student_id && student !== payload.student_id) ||
      (payload.fee_type_id && type !== payload.fee_type_id))
  )
    throw Error("Bill identity cannot change");
  const [{ data: pupil, error }, book] = await Promise.all([
    db
      .from("students")
      .select("first_name,last_name,roll_number,class_id,class_name")
      .eq("madrasa_id", tenant)
      .eq("id", String(student))
      .single(),
    getFeeMetadata(tenant),
  ]);
  const matches = book.fee_types?.filter(
    (f) =>
      f.is_active !== false &&
      (type ? f.id === type : f.name === payload.fee_type_name),
  );
  if (error || !pupil || matches?.length !== 1)
    throw Error("শিক্ষার্থী ও একটি সচল ফি খাত নির্বাচন করুন।");
  const ft = matches[0];
  const base = Number(
    payload.base_amount ?? payload.amount ?? prior?.base_amount,
  );
  if (
    !Number.isFinite(base) ||
    base < 0 ||
    Math.abs(base * 100 - Math.round(base * 100)) > 0.000001
  )
    throw Error("পয়সা পর্যন্ত সঠিক অঙ্ক দিন।");
  const charge =
    (Math.round(base * 100) +
      Math.round(Number(prior?.fine_amount || 0) * 100) -
      Math.round(Number(prior?.discount_amount || 0) * 100)) /
    100;
  const billing_period = payload.billing_period || prior?.billing_period;
  if (!billing_period || charge < 0)
    throw Error("বিলের সময়কাল বা অঙ্ক সঠিক নয়।");
  const source = payload.fund_id ? payload : prior?.fund_id ? prior : ft;
  const fund = await postingFund(
    tenant,
    source.fund_id,
    "deposit",
    "",
    "",
    source.fund_name,
  );
  const row = {
    ...prior,
    id: prior?.id || crypto.randomUUID(),
    madrasa_id: tenant,
    student_id: student,
    student_name: [pupil.first_name, pupil.last_name].filter(Boolean).join(" "),
    student_roll: prior?.student_roll ?? pupil.roll_number,
    class_id: prior?.class_id ?? pupil.class_id,
    class_name: prior?.class_name ?? pupil.class_name,
    session_id: payload.session_id || prior?.session_id || "default",
    fee_type_id: ft.id,
    fee_type_name: ft.name,
    billing_period,
    due_date: payload.due_date || prior?.due_date || null,
    base_amount: base,
    payable_amount: charge,
    paid_amount: 0,
    due_amount: charge,
    status: charge === 0 ? "WAIVED" : "UNPAID",
    fund_id: fund.id,
    fund_name: fund.name,
    updated_at: new Date().toISOString(),
  };
  const r = await db.rpc("finance_edit_bills", {
    p_tenant: tenant,
    p_changes: [{ id: row.id, before: prior || null, after: row }],
    p_audit: null,
  });
  if (r.error) throw new InvoiceConflict(postingError(r.error));
  return row;
}
export class InvoiceConflict extends Error {}
