import { privateResponseHeaders } from "./private-response";

export function paymentTenant(value: unknown) {
  return typeof value === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
    ? value.toLowerCase()
    : null;
}

// A relative 303 keeps the user's public origin behind a proxy; never rebuild it
// from a gateway form, forwarded Host or internal listener address.
export function paymentReturn(path: "/portal/fees" | "/donate", params: Record<string, string>) {
  return new Response(null, {
    status: 303,
    headers: {
      ...privateResponseHeaders,
      "Referrer-Policy": "no-referrer",
      Location: `${path}?${new URLSearchParams(params)}`,
    },
  });
}

export async function paymentForm(req: Request) {
  const body = await req.formData().catch(() => null);
  const field = (name: string) => {
    const values = body?.getAll(name);
    return values?.length === 1 && typeof values[0] === "string" && values[0].length <= 255
      ? values[0].trim()
      : "";
  };
  const id = field("tran_id"),
    validationId = field("val_id");
  const path = /^(DON-|DONATION-)/.test(id) ? ("/donate" as const) : ("/portal/fees" as const);
  return { id, validationId, path };
}

// A redirect query is not proof. Show a receipt only from the signed-in child's
// completed ledger, never a name, number or error message supplied in a URL.
export function feeReturnNotice(
  params: { success?: string; receipt?: string; txn?: string; error?: string },
  tenant: string,
  child: string,
  payments: { id: string; student_id: string; status: string; receipt_no: string }[],
) {
  if (!params.error && params.success !== "true") return null;
  const receipt =
    !params.error &&
    params.txn &&
    params.receipt &&
    payments.find(
      (p) =>
        p.id === `online:${tenant}:${params.txn}` &&
        p.student_id === child &&
        p.status === "COMPLETED" &&
        p.receipt_no === params.receipt,
    );
  return receipt
    ? { confirmed: true, message: `ফি জমা হয়েছে। রসিদ নম্বর: ${receipt.receipt_no}` }
    : {
        confirmed: false,
        message:
          "এই পেমেন্টের রসিদ নিশ্চিত করা যায়নি। টাকা কেটে থাকলে নতুন পেমেন্ট করবেন না; মাদ্রাসার হিসাব বিভাগে যোগাযোগ করুন।",
      };
}
