import { paymentForm, paymentReturn } from "@/lib/payment-return";
export async function POST(req: Request) {
  const { id, path } = await paymentForm(req);
  return paymentReturn(path, { error: "গেটওয়ে থেকে পেমেন্ট সফল হওয়ার নিশ্চয়তা পাওয়া যায়নি।", txn: id });
}
