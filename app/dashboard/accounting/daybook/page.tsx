import { getDaybook, getVoucherChoices } from "@/app/actions/treasury";
import {
  BookShell,
  BookError,
  fieldClass,
} from "@/components/accounting/treasury/BookShell";
import { PrintBook } from "@/components/accounting/treasury/Controls";
import { MemoControl } from "@/components/accounting/treasury/MemoControl";
import { toDhakaDateString } from "@/lib/date-utils";
import { REVIEW_FUND } from "@/lib/fund-utils";
export const dynamic = "force-dynamic";
const taka = (n: number) =>
  n.toLocaleString("bn-BD", { minimumFractionDigits: 2 });
export default async function DaybookPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const p = await searchParams,
    today = toDhakaDateString(),
    f = {
      start: p.start || today,
      end: p.end || today,
      flow: p.flow || "both",
      fund: p.fund,
      student: p.student,
      staff: p.staff,
      item: p.item,
      q: p.q,
    };
  let book, people;
  try {
    [book, people] = await Promise.all([getDaybook(f), getVoucherChoices()]);
  } catch (e) {
    return <BookError message={(e as Error).message} />;
  }
  const totals = { income: 0, expense: 0, journal: 0 };
  for (const r of book.rows)
    if (!r.void)
      totals[r.kind] += Math.round(
        100 * (r.kind === "journal" ? r.delta : r.amount),
      );
  const select = (
    key: "fund" | "student" | "staff",
    title: string,
    opts: { id: string; name: string }[],
  ) => (
    <label>
      {title}
      <select className={fieldClass} name={key} defaultValue={f[key] || ""}>
        <option value="">সব</option>
        {opts.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
  const studentNames = new Map(people.students.map((s) => [s.id, s.name]));
  return (
    <BookShell
      title="সকল ফান্ডের ডেবুক"
      note="তারিখ, ব্যক্তি বা ভাউচারের আইটেম ধরে খুঁজুন। স্থানান্তরের দুই পাশ দেখা যায়, কিন্তু সেগুলো আয় বা ব্যয় নয়।"
    >
      <form className="grid gap-3 rounded-xl border bg-white p-4 text-sm sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        <label>
          শুরু
          <input
            className={fieldClass}
            name="start"
            type="date"
            required
            defaultValue={f.start}
          />
        </label>
        <label>
          শেষ
          <input
            className={fieldClass}
            name="end"
            type="date"
            required
            defaultValue={f.end}
          />
        </label>
        <label>
          লেনদেন
          <select className={fieldClass} name="flow" defaultValue={f.flow}>
            <option value="both">উভয় ও জার্নাল</option>
            <option value="income">শুধু আয়</option>
            <option value="expense">শুধু ব্যয়</option>
          </select>
        </label>
        {select("fund", "ফান্ড", [...book.funds, REVIEW_FUND])}
        {select("student", "শিক্ষার্থী", people.students)}
        {select("staff", "কর্মী", people.staff)}
        <label>
          স্বতন্ত্র ব্যয়ের আইটেম
          <input
            className={fieldClass}
            name="item"
            defaultValue={f.item}
            placeholder="যেমন: চাল"
          />
        </label>
        <label>
          অনুসন্ধান
          <input
            className={fieldClass}
            name="q"
            defaultValue={f.q}
            placeholder="রসিদ, নাম, খাত…"
          />
        </label>
        <button className="rounded-lg bg-emerald-800 p-2 text-white">
          খুঁজুন
        </button>
        <PrintBook id="daybook-sheet" title="প্রতিষ্ঠানের ডেবুক" />
      </form>
      <section
        id="daybook-sheet"
        className="space-y-3 overflow-x-auto rounded-xl border bg-white p-4"
      >
        <h2 className="font-bold">
          ডেবুক · {f.start} — {f.end}
        </h2>
        <p className="text-xs text-slate-600">
          {[
            f.flow === "both"
              ? "সব ধরন"
              : f.flow === "income"
                ? "শুধু আয়"
                : "শুধু ব্যয়",
            book.funds.find((v) => v.id === f.fund)?.name,
            people.students.find((v) => v.id === f.student)?.name,
            people.staff.find((v) => v.id === f.staff)?.name,
            f.item && `আইটেম: ${f.item}`,
            f.q && `অনুসন্ধান: ${f.q}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="text-sm">
          নির্বাচিত লেনদেন: {book.rows.length} · আয় ৳ {taka(totals.income / 100)}{" "}
          · ব্যয় ৳ {taka(totals.expense / 100)} · জার্নাল নিট ৳{" "}
          {taka(totals.journal / 100)}
        </p>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100">
            <tr>
              {[
                "তারিখ / ভাউচার",
                "ফান্ড",
                "উৎস / ব্যক্তি",
                "খাত ও আইটেম",
                "আয় ৳",
                "ব্যয় ৳",
                "সমন্বয় ৳",
              ].map((k) => (
                <th className="p-2" key={k}>
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {book.rows.map((r) => (
              <tr className="border-b align-top" key={r.key}>
                <td className="p-2">
                  {r.date}
                  <br />
                  {r.voucher}
                  {r.void && <b> · VOID</b>}
                  {r.review && (
                    <small className="block text-amber-700">
                      যাচাই: {r.review}
                    </small>
                  )}
                </td>
                <td className="p-2">{r.fundName}</td>
                <td className="p-2">
                  {r.party}
                  {r.student && (
                    <small className="block">
                      {studentNames.get(r.student) || r.student}
                    </small>
                  )}
                  {r.staffName && (
                    <small className="block">{r.staffName}</small>
                  )}
                </td>
                <td className="p-2">
                  {r.category}
                  {r.lines.map((l, i) => (
                    <div key={i} className="text-xs">
                      {l.label} · ৳ {taka(l.amount)}
                    </div>
                  ))}
                  {r.expenseId && <MemoControl id={r.expenseId} compact />}
                </td>
                <td className="p-2">
                  {r.kind === "income" ? taka(r.amount) : "—"}
                </td>
                <td className="p-2">
                  {r.kind === "expense" ? taka(r.amount) : "—"}
                </td>
                <td className="p-2">
                  {r.kind === "journal" ? taka(r.delta) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!book.rows.length && (
          <p className="py-4 text-slate-500">এই শর্তে কোনো লেনদেন নেই।</p>
        )}
        <small>বাতিল ভাউচার দেখা যায়, যোগফলে গণনা হয় না।</small>
      </section>
    </BookShell>
  );
}
