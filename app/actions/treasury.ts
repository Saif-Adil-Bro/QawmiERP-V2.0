"use server";
import { revalidatePath } from "next/cache";
import { treasuryAccess } from "@/lib/finance/treasury-access";
import {
  daybook,
  validDate,
  spendable,
  type DayFilters,
} from "@/lib/finance/daybook";
import { readBooks } from "@/lib/finance/read-books";
import { financeRows } from "@/lib/finance/funds";
import { getFeeMetadata } from "./fee-management";
import { salaryAccess } from "@/lib/finance/staff-access";
import { getMadrasaMetadata } from "@/lib/sessions";
import { bdtPoisha } from "@/lib/payment-gateway-engine";
import { toDhakaDateString } from "@/lib/date-utils";
import type {
  ActionResult,
  Cashbook,
  Choice,
  Head,
} from "@/lib/finance/treasury-types";
const base = "/dashboard/accounting";
const field = (fd: FormData, k: string) => String(fd.get(k) || "").trim();
function date(s: string) {
  if (!validDate(s)) throw Error("সঠিক তারিখ দিন।");
  return s;
}
function amount(s: string, zero = false) {
  const n = bdtPoisha(s);
  if (n === null || (!zero && n === 0))
    throw Error("পয়সা পর্যন্ত সঠিক পরিমাণ দিন।");
  return n / 100;
}
function failure(e: unknown): ActionResult {
  return {
    message: e instanceof Error ? e.message : "হিসাব সংরক্ষণ করা যায়নি।",
  };
}
function checked<T>(res: {
  data: T;
  error: { message: string; code?: string } | null;
}) {
  if (res.error)
    throw Error(
      ["PGRST202", "42P01", "42883", "PGRST205"].includes(res.error.code || "")
        ? "হিসাবের দ্বিতীয় ধাপের মাইগ্রেশন প্রয়োগ করুন।"
        : res.error.message,
    );
  return res.data;
}
export async function getCashbook(day: string): Promise<Cashbook> {
  const { db, tenant, actor } = await treasuryAccess();
  return checked(
    await db.rpc("treasury_cashbook", { t: tenant, a: actor, d: date(day) }),
  );
}
export async function recordCash(
  _: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  try {
    const { db, tenant, actor } = await treasuryAccess(true),
      op = field(fd, "op"),
      d = date(field(fd, "date"));
    const n = ["ACCEPT", "CANCEL"].includes(op)
      ? null
      : amount(field(fd, "amount"), ["OPEN", "CLOSE"].includes(op));
    checked(
      await db.rpc("treasury_cash_action", {
        t: tenant,
        a: actor,
        d,
        op,
        k: field(fd, "key") || null,
        n,
        receiver: field(fd, "recipient") || null,
        ref: field(fd, "ref"),
        seen: op === "CLOSE" ? field(fd, "expected") : null,
      }),
    );
    revalidatePath(base + "/cashbook");
    return { ok: true, message: "ক্যাশবই হালনাগাদ হয়েছে।" };
  } catch (e) {
    return failure(e);
  }
}
export async function getDaybook(filters: DayFilters) {
  const { tenant, gate } = await treasuryAccess();
  const books = await readBooks(tenant, getFeeMetadata);
  const rows = daybook(books, filters, salaryAccess(gate, "read"));
  return { rows, funds: books.funds.map(({ id, name }) => ({ id, name })) };
}
export async function recordJournal(
  _: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  try {
    const { db, tenant, actor } = await treasuryAccess("manage"),
      kind = field(fd, "kind"),
      d = date(field(fd, "date"));
    if (
      d > toDhakaDateString() ||
      !["TRANSFER", "OPENING", "ADJUST_IN", "ADJUST_OUT"].includes(kind)
    )
      throw Error("তারিখ বা ভাউচারের ধরন সঠিক নয়।");
    const src = field(fd, "src") || null,
      dst = field(fd, "dst") || null,
      n = amount(field(fd, "amount"));
    let rev = null,
      available = null;
    if (src) {
      // Read revision BEFORE any constituent query. The RPC rechecks under the posting lock.
      rev =
        checked(
          await db
            .from("treasury_epochs")
            .select("revision")
            .eq("madrasa_id", tenant)
            .maybeSingle(),
        )?.revision || 0;
      available = spendable(await readBooks(tenant, getFeeMetadata), src, d);
    }
    const key = checked(
      await db.rpc("treasury_post_journal", {
        t: tenant,
        a: actor,
        k: field(fd, "key"),
        d,
        kind_: kind,
        src,
        dst,
        n,
        memo: field(fd, "ref"),
        rev,
        available,
      }),
    );
    revalidatePath(base, "layout");
    revalidatePath("/dashboard/zakat", "layout");
    return { ok: true, message: `ভাউচার সংরক্ষিত: JV-${key}` };
  } catch (e) {
    return failure(e);
  }
}
export async function getExpenseHeads(): Promise<Head[]> {
  const { db, tenant } = await treasuryAccess();
  return (
    await financeRows(db, tenant, "treasury_heads", "id,name,policy,active")
  ).sort((a, b) => a.name.localeCompare(b.name));
}
export async function editExpenseHead(
  _: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  try {
    const { db, tenant, actor } = await treasuryAccess("manage");
    checked(
      await db.rpc("treasury_head", {
        t: tenant,
        a: actor,
        k: field(fd, "id") || null,
        label: field(fd, "name"),
        policy_: field(fd, "policy"),
        enabled: field(fd, "active") === "on",
      }),
    );
    revalidatePath(base + "/expense-heads");
    revalidatePath(base + "/expenses/new");
    return { ok: true, message: "খরচের খাত সংরক্ষিত।" };
  } catch (e) {
    return failure(e);
  }
}
export async function getVoucherChoices(): Promise<{
  students: Choice[];
  staff: Choice[];
}> {
  const { db, tenant } = await treasuryAccess();
  const [students, meta] = await Promise.all([
    financeRows(db, tenant, "students", "id,first_name,last_name,roll_number"),
    getMadrasaMetadata(tenant, true),
  ]);
  return {
    students: students.map((s) => ({
      id: s.id,
      name: [s.first_name, s.last_name, s.roll_number]
        .filter(Boolean)
        .join(" "),
    })),
    staff: (meta.staff_members || [])
      .filter((s: any) => !s.madrasa_id || s.madrasa_id === tenant)
      .map((s: any) => ({
        id: s.id,
        name:
          s.personal?.full_name_bn ||
          [s.personal?.first_name, s.personal?.last_name, s.staff_id_code]
            .filter(Boolean)
            .join(" ") ||
          s.id,
      })),
  };
}
