import { paymentForm, paymentReturn } from "@/lib/payment-return";
export async function POST(req: Request) {
  const { id, path } = await paymentForm(req);
  return paymentReturn(path, { error: "পেমেন্ট প্রক্রিয়া বাতিল করা হয়েছে।", txn: id });
}
