import { bdtPoisha } from "@/lib/payment-gateway-engine";
export interface ExpenseLine {
  label: string;
  amount: number;
}
export function parseVoucherLines(
  value: FormDataEntryValue | null,
  total: unknown,
): ExpenseLine[] | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 40000)
    throw Error("ভাউচারের আইটেম তালিকা সঠিক নয়।");
  const rows: unknown = JSON.parse(value);
  if (!Array.isArray(rows) || !rows.length || rows.length > 100)
    throw Error("১–১০০টি খরচের আইটেম দিন।");
  let sum = 0;
  const lines = rows.map((row) => {
    const label = typeof row?.label === "string" ? row.label.trim() : "";
    const cents = bdtPoisha(row?.amount);
    if (!label || label.length > 180 || !cents)
      throw Error("প্রতিটি আইটেমের নাম ও পয়সা পর্যন্ত সঠিক অঙ্ক দিন।");
    sum += cents;
    return { label, amount: cents / 100 };
  });
  if (sum !== bdtPoisha(total))
    throw Error("আইটেমগুলোর যোগফল ও ভাউচারের অঙ্ক মেলেনি।");
  return lines;
}
