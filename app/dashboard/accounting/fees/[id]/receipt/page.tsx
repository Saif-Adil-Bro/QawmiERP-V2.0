import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getFeeWithReceiptNo } from "@/app/actions/accounting";
import { getFeeMetadata } from "@/app/actions/fee-management";
import { getAuthMadrasaId } from "@/app/actions/students";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import { notFound } from "next/navigation";
import ReceiptClient from "./ReceiptClient";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  let fee = await getFeeWithReceiptNo(resolvedParams.id);

  if (!fee) {
    // Check MadrasaFeeData metadata payments
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;
    if (madrasaId) {
      const meta = await getFeeMetadata(madrasaId);
      const payment = meta?.payments?.find(
        (p) => p.id === resolvedParams.id || p.receipt_no === resolvedParams.id
      );
      if (payment) {
        fee = {
          id: payment.id,
          receipt_no: payment.receipt_no,
          amount: payment.total_amount_received,
          payment_date: payment.payment_date,
          notes: payment.notes,
          payment_method: payment.payment_method,
          allocations: payment.allocations,
          discount_total: payment.discount_total,
          fine_total: payment.fine_total,
          students: {
            first_name: payment.student_name,
            last_name: "",
            roll_number: payment.student_roll,
            class_name: payment.class_name,
          },
        };
      }
    }
  }

  if (!fee) {
    return notFound();
  }

  const madrasaInfo = await getMadrasaInfo();

  return <ReceiptClient fee={fee} madrasaInfo={madrasaInfo} />;
}
