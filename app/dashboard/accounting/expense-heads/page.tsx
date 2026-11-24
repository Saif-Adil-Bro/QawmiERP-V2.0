import { editExpenseHead, getExpenseHeads } from "@/app/actions/treasury";
import {
  BookShell,
  BookError,
  fieldClass,
} from "@/components/accounting/treasury/BookShell";
import { BookForm } from "@/components/accounting/treasury/Controls";
import { policies } from "@/lib/finance/treasury-types";
import Link from "next/link";
import { treasuryAccess } from "@/lib/finance/treasury-access";
export const dynamic = "force-dynamic";
export default async function HeadsPage() {
  let heads;
  try {
    await treasuryAccess("manage");
    heads = await getExpenseHeads();
  } catch (e) {
    return <BookError message={(e as Error).message} />;
  }
  return (
    <BookShell
      title="প্রতিষ্ঠানের ব্যয়ের খাত"
      note="নাম ও সক্রিয় অবস্থা পরিবর্তন করা যায়। পুরোনো ভাউচারে পোস্ট করার সময়কার খাতের নাম থাকে। যাকাতের ব্যয়নীতি খাতের নাম পাল্টালেও বদলায় না।"
    >
      <Link
        className="text-emerald-800 underline"
        href="/dashboard/accounting/expenses/new"
      >
        নতুন ব্যয় ভাউচার →
      </Link>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[null, ...heads].map((h) => (
          <BookForm
            key={h?.id || "new"}
            title={h ? "পরিবর্তন সংরক্ষণ" : "নতুন খাত যোগ করুন"}
            action={editExpenseHead}
          >
            <h2 className="font-bold">{h ? h.name : "নতুন ব্যয়ের খাত"}</h2>
            <input type="hidden" name="id" value={h?.id || ""} />
            <label>
              খাতের নাম
              <input
                className={fieldClass}
                required
                maxLength={100}
                name="name"
                defaultValue={h?.name}
              />
            </label>
            {h ? (
              <>
                <p>ব্যয়নীতি: {policies[h.policy]}</p>
                <input type="hidden" name="policy" value={h.policy} />
              </>
            ) : (
              <label>
                ব্যয়নীতি
                <select
                  className={fieldClass}
                  name="policy"
                  defaultValue="Other"
                >
                  {Object.entries(policies).map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              <input
                type="checkbox"
                name="active"
                defaultChecked={h?.active ?? true}
              />{" "}
              সক্রিয়
            </label>
          </BookForm>
        ))}
      </div>
    </BookShell>
  );
}
