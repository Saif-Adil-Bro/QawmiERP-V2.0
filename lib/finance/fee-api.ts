import { postingError, postingFund } from "./funds";
import { toDhakaDateString } from "@/lib/date-utils";
import type { createAdminClient } from "@/lib/supabase/admin";

// Single-line mobile/AI collections use the same transaction as the cashier.
// An invoice can supply its configured fund; an unallocated deposit needs a selection.
export async function collectSingleFee(
  db: Awaited<ReturnType<typeof createAdminClient>>,
  tenant: string,
  actor: string,
  input: Record<string, any>,
) {
  if (
    input.allocations ||
    input.fee_allocations ||
    Number(input.discount_amount) ||
    Number(input.discount_total) ||
    Number(input.fine_amount) ||
    Number(input.fine_total) ||
    Number(input.advance_amount)
  )
    throw new Error("বহু খাত বা ছাড়ের জন্য ফি আদায় ফর্ম ব্যবহার করুন।");
  const amount = Number(input.total_amount_received ?? input.amount),
    student = input.student_id;
  if (typeof student !== "string" || !(amount > 0 && Number.isFinite(amount)))
    throw new Error("শিক্ষার্থী ও আদায়ের অঙ্ক আবশ্যক।");
  const { data: pupil, error: err } = await db
    .from("students")
    .select("first_name,last_name,roll_number,class_name")
    .eq("madrasa_id", tenant)
    .eq("id", student)
    .single();
  if (err || !pupil) throw new Error("শিক্ষার্থী পাওয়া যায়নি।");
  let bill: any;
  if (input.student_fee_id) {
    const res = await db
      .from("student_fees")
      .select("*")
      .eq("madrasa_id", tenant)
      .eq("student_id", student)
      .eq("id", input.student_fee_id)
      .maybeSingle();
    if (res.error) throw new Error("শিক্ষার্থীর বিল পড়া যায়নি।");
    bill = res.data;
    if (!bill) {
      const { data: legacy, error } = await db.rpc("finance_json_fee_rows", {
        t: tenant,
        k: "student_fees",
      });
      if (error) throw Error(postingError(error));
      bill = legacy?.find(
        (b: any) => b.id === input.student_fee_id && b.student_id === student,
      );
    }
    if (!bill) throw Error("শিক্ষার্থীর বিল মেলেনি।");
  }
  const f = await postingFund(
    tenant,
    input.fund_id || bill?.fund_id,
    "deposit",
    "",
    "",
    input.fund_id ? input.fund_name : bill?.fund_name,
  );
  const id = crypto.randomUUID(),
    receipt = input.receipt_no;
  const payment = {
    id,
    madrasa_id: tenant,
    receipt_no: receipt,
    student_id: student,
    session_id: bill?.session_id || "default",
    student_name: [pupil.first_name, pupil.last_name].filter(Boolean).join(" "),
    student_roll: pupil.roll_number,
    class_name: pupil.class_name,
    payment_date: input.payment_date || toDhakaDateString(),
    payment_method: input.payment_method || "Cash",
    total_amount_received: amount,
    fund_id: f.id,
    fund_name: f.name,
    idempotency_key: input.idempotency_key,
    notes: input.notes,
    allocations: [
      {
        fund_id: f.id,
        fund_name: f.name,
        allocated_amount: amount,
        student_fee_id: bill?.id,
        fee_type_id: bill?.fee_type_id,
        fee_type_name: bill?.fee_type_name || "Fee",
        billing_period: bill?.billing_period,
      },
    ],
  };
  const { data, error } = await db.rpc("finance_collect_fee", {
    p_tenant: tenant,
    p_actor: actor,
    p: payment,
    p_expected: bill
      ? {
          [bill.id]: {
            paid_amount: bill.paid_amount,
            due_amount: bill.due_amount,
          },
        }
      : {},
  });
  if (error || !data?.receipt_no || (data.id !== id && !data.already_posted))
    throw new Error(
      error ? postingError(error) : "রসিদ নিশ্চিত হয়নি। তালিকা যাচাই করুন।",
    );
  return data;
}
