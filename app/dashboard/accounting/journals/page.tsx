import { randomUUID } from "node:crypto";
import { treasuryAccess } from "@/lib/finance/treasury-access";
import { fundCatalog } from "@/lib/finance/funds";
import { recordJournal } from "@/app/actions/treasury";
import {
  BookShell,
  BookError,
  fieldClass,
} from "@/components/accounting/treasury/BookShell";
import { BookForm } from "@/components/accounting/treasury/Controls";
import { isRestrictedFund } from "@/lib/fund-utils";
import { toDhakaDateString } from "@/lib/date-utils";
import { journalNames, type JournalKind } from "@/lib/finance/journal";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function JournalPage() {
  let funds;
  try {
    const { tenant } = await treasuryAccess("manage");
    funds = (await fundCatalog(tenant, true)).filter(
      (f) => f.is_active !== false,
    );
  } catch (e) {
    return <BookError message={(e as Error).message} />;
  }
  const today = toDhakaDateString();
  return (
    <BookShell
      title="ফান্ড জার্নাল"
      note="স্থানান্তরে একটি ভাউচারেই দুই ফান্ড বদলায়। প্রারম্ভিক স্থিতি ও সমন্বয় দান বা খরচ নয়; ক্যাশবইও বদলায় না।"
    >
      <Link
        className="text-emerald-800 underline"
        href="/dashboard/accounting/daybook"
      >
        জার্নালসহ ডেবুক দেখুন →
      </Link>
      <div className="grid gap-4 md:grid-cols-2">
        {(Object.keys(journalNames) as JournalKind[]).map((kind) => (
          <BookForm action={recordJournal} title="ভাউচার পোস্ট করুন" key={kind}>
            <h2 className="font-bold">{journalNames[kind]}</h2>
            <input type="hidden" name="key" value={randomUUID()} />
            <input type="hidden" name="kind" value={kind} />
            {(kind === "TRANSFER" || kind === "ADJUST_OUT") && (
              <label>
                উৎস ফান্ড
                <select required className={fieldClass} name="src">
                  <option value="">নির্বাচন করুন</option>
                  {funds
                    .filter((f) => !isRestrictedFund(f))
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {kind !== "ADJUST_OUT" && (
              <label>
                জমার ফান্ড
                <select className={fieldClass} required name="dst">
                  <option value="">নির্বাচন করুন</option>
                  {funds.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              কার্যকর তারিখ
              <input
                name="date"
                type="date"
                className={fieldClass}
                defaultValue={today}
                required
                max={today}
              />
            </label>
            <label>
              পরিমাণ (৳)
              <input
                className={fieldClass}
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
              />
            </label>
            <label>
              কারণ / রেফারেন্স
              <input
                name="ref"
                className={fieldClass}
                required
                maxLength={500}
              />
            </label>
          </BookForm>
        ))}
      </div>
    </BookShell>
  );
}
