import { randomUUID } from "node:crypto";
import { getCashbook, recordCash } from "@/app/actions/treasury";
import { BookForm, PrintBook } from "@/components/accounting/treasury/Controls";
import {
  BookShell,
  BookError,
  fieldClass,
} from "@/components/accounting/treasury/BookShell";
import { toDhakaDateString } from "@/lib/date-utils";
export const dynamic = "force-dynamic";
const format = (n: number | null) =>
  n === null
    ? "—"
    : `৳ ${n.toLocaleString("bn-BD", { minimumFractionDigits: 2 })}`;
export default async function CashbookPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const today = toDhakaDateString(),
    day = (await searchParams).date || today;
  let b;
  try {
    b = await getCashbook(day);
  } catch (e) {
    return <BookError message={(e as Error).message} />;
  }
  const hidden = (op: string, key: string = randomUUID()) => (
    <>
      <input type="hidden" name="op" value={op} />
      <input type="hidden" name="key" value={key} />
      <input type="hidden" name="date" value={day} />
    </>
  );
  const amount = (label: string, zero = false) => (
    <label>
      {label} (৳)
      <input
        className={fieldClass}
        name="amount"
        type="number"
        required
        min={zero ? 0 : 0.01}
        step="0.01"
      />
    </label>
  );
  const reference = (label: string) => (
    <label>
      {label}
      <input className={fieldClass} required maxLength={200} name="ref" />
    </label>
  );
  return (
    <BookShell
      title="আমার দৈনিক ক্যাশবই"
      note="কেবল আপনার হাতে থাকা ভৌত নগদ। ব্যাংক, বিকাশ, নগদ ওয়ালেট, গেটওয়ে এবং পদ্ধতি বা অপারেটর অজানা এমন পুরোনো রসিদ এখানে আসে না।"
    >
      <form className="flex items-end gap-3 print:hidden">
        <label>
          তারিখ
          <input
            className={fieldClass}
            type="date"
            name="date"
            defaultValue={day}
            max={today}
            required
          />
        </label>
        <button className="rounded border p-2">খাতা দেখুন</button>
        <PrintBook id="cash-sheet" title="দৈনিক ক্যাশবই" />
      </form>
      <section
        id="cash-sheet"
        className="space-y-4 rounded-xl border bg-white p-5"
      >
        <h2 className="font-bold">
          দৈনিক নগদ মিল · {b.operatorName} · {day} ·{" "}
          {b.closed ? "সমাপ্ত" : b.opening === null ? "শুরুর গণনা বাকি" : "খোলা"}
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(
            [
              ["শুরুর নগদ", b.opening],
              ["নগদ আদায় (+)", b.collected],
              ["নগদ ব্যয় (−)", b.expenses],
              ["হস্তান্তর গ্রহণ (+)", b.handedIn],
              ["হস্তান্তর প্রদান (−)", b.handedOut],
              ["ব্যাংকে জমা (−)", b.deposited],
              ["প্রত্যাশিত সমাপনী", b.expected],
              ["গণনাকৃত সমাপনী", b.counted],
              ["পার্থক্য (গণনা − প্রত্যাশিত)", b.variance],
            ] as [string, number | null][]
          ).map(([title, value]) => (
            <div className="rounded-lg bg-slate-50 p-3" key={title}>
              <dt className="text-xs text-slate-600">{title}</dt>
              <dd className="mt-1 font-semibold">{format(value)}</dd>
            </div>
          ))}
        </dl>
        {b.note && <p>সমাপনী মন্তব্য: {b.note}</p>}
        <h3 className="font-semibold">নগদ রসিদ ও ভাউচার</h3>
        {b.rows.length ? (
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>উৎস</th>
                <th>রেফারেন্স</th>
                <th className="text-right">পরিমাণ</th>
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r) => (
                <tr className="border-t" key={r.source + r.id}>
                  <td>{r.source}</td>
                  <td>{r.reference || r.id}</td>
                  <td className="text-right">
                    {r.incoming ? "+" : "−"} {format(r.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-slate-500">এই দিনে আপনার কোনো নগদ লেনদেন নেই।</p>
        )}
        {b.moves.length > 0 && (
          <>
            <h3 className="font-semibold">ব্যাংক জমা ও হস্তান্তর</h3>
            {b.moves.map((m) => (
              <div key={m.id} className="border-t py-2 text-sm">
                {m.reference} · {format(m.amount)} ·{" "}
                {m.cancelled_at
                  ? "প্রস্তাব বাতিল"
                  : !m.recipient
                    ? "ব্যাংকে জমা"
                    : `${m.recipient === b.operator ? "গ্রহণ" : "প্রদান"} · ${m.accepted_at ? "গৃহীত" : "অপেক্ষমাণ (স্থিতিতে যোগ হয়নি)"}`}
              </div>
            ))}
          </>
        )}
      </section>
      {!b.closed &&
        day <= today &&
        (b.opening === null ? (
          <BookForm action={recordCash} title="ক্যাশবই খুলুন">
            {hidden("OPEN")}
            {amount("দিনের শুরুতে গণনাকৃত নগদ", true)}
          </BookForm>
        ) : (
          <>
            {b.moves
              .filter((m) => m.recipient && !m.accepted_at && !m.cancelled_at)
              .map((m) => (
                <BookForm
                  action={recordCash}
                  title={
                    m.recipient === b.operator
                      ? "নগদ পেয়েছি — গ্রহণ করুন"
                      : "অপেক্ষমাণ হস্তান্তর বাতিল"
                  }
                  key={m.id}
                >
                  {hidden(
                    m.recipient === b.operator ? "ACCEPT" : "CANCEL",
                    m.id,
                  )}
                  <p>
                    {m.reference} · {format(m.amount)}
                  </p>
                </BookForm>
              ))}
            <div className="grid gap-4 md:grid-cols-3">
              <BookForm action={recordCash} title="ব্যাংকে জমা লিখুন">
                {hidden("BANK")}
                {amount("ব্যাংকে জমা")}
                {reference("ব্যাংক / জমার স্লিপ নম্বর")}
              </BookForm>
              <BookForm action={recordCash} title="হস্তান্তরের প্রস্তাব পাঠান">
                {hidden("HANDOVER")}
                {amount("হস্তান্তরের নগদ")}
                <label>
                  গ্রহীতার খোলা ক্যাশবই
                  <select name="recipient" required className={fieldClass}>
                    <option value="">গ্রহীতা নির্বাচন করুন</option>
                    {b.recipients.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                {reference("হস্তান্তরের বিবরণ")}
              </BookForm>
              <BookForm action={recordCash} title="গণনা নিশ্চিত করে দিন বন্ধ করুন">
                {hidden("CLOSE")}
                <input type="hidden" name="expected" value={b.expected ?? ""} />
                {amount("হাতে গুনে পাওয়া টাকা", true)}
                <label>
                  পার্থক্য থাকলে কারণ আবশ্যক
                  <textarea className={fieldClass} maxLength={500} name="ref" />
                </label>
              </BookForm>
            </div>
          </>
        ))}
    </BookShell>
  );
}
