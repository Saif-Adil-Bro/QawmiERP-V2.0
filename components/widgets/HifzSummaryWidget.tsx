import Link from "next/link";
import { BookOpen } from "lucide-react";
import type { HifzSummary } from "@/lib/hifz-utils";
const bn = (n: number) => n.toLocaleString("bn-BD");
export default function HifzSummaryWidget({
  summary: s,
  teacher = false,
  period,
}: {
  summary: HifzSummary;
  teacher?: boolean;
  period?: string;
}) {
  return (
    <section
      aria-label="হিফজুল কুরআন ও সবিনা সারসংক্ষেপ"
      className="h-full space-y-4 rounded-2xl border border-emerald-200 bg-white p-5 text-slate-800 shadow-sm"
    >
      <header className="flex flex-wrap items-center gap-2">
        <BookOpen className="text-emerald-700" />
        <h2 className="font-bold">হিফজুল কুরআন ও সবিনা সারসংক্ষেপ</h2>
        {s.events.length > 0 && (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-800">
            ● লাইভ · বিশেষ সবিনা {bn(s.events.length)}
          </span>
        )}
      </header>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["সবকী", bn(s.sabqi)],
          ["খতমী", bn(s.khatmi)],
          [period ? "দিনের এন্ট্রি" : "আজকের এন্ট্রি", bn(s.rate) + "%"],
          [period ? `${period} · খতম` : "এ মাসে খতম", bn(s.khatams)],
        ].map(([label, v]) => (
          <div key={label} className="rounded-xl bg-emerald-50 p-3">
            <dt className="text-xs">{label}</dt>
            <dd className="text-xl font-bold">{v}</dd>
          </div>
        ))}
      </dl>
      <p>
        বৃহস্পতিবার ({s.thursday}) · সবিনা সম্পন্ন {bn(s.weekly)} জন (
        {bn(s.weekly_rate)}%)
      </p>
      <p className={s.weak.length ? "text-rose-700" : "text-slate-500"}>
        {s.weak.length
          ? "পুনরায় শোনাতে হবে: " +
            s.weak
              .map((w) => `পারা ${bn(w.para)} (${bn(w.count)} জন)`)
              .join(" · ")
          : "ওই বৃহস্পতিবার দুর্বল পারার রেকর্ড নেই।"}
      </p>
      {s.events.length > 0 && (
        <p>চলমান: {s.events.map((e) => e.title).join(" · ")}</p>
      )}
      <footer className="flex flex-wrap items-center justify-between gap-2">
        <Link
          className="inline-flex min-h-11 items-center rounded-lg bg-emerald-700 px-4 text-white"
          href={teacher ? "/teacher-portal/hifz" : "/dashboard/hifz"}
        >
          দৈনিক এন্ট্রি
        </Link>
        <Link
          className="inline-flex min-h-11 items-center font-semibold text-emerald-800"
          href="/dashboard/hifz/report"
        >
          বিস্তারিত রিপোর্ট →
        </Link>
      </footer>
    </section>
  );
}
