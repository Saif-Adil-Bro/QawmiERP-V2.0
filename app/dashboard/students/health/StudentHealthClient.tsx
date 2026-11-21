"use client";
import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { HeartPulse, Plus, Printer, Stethoscope } from "lucide-react";
import {
  type StaffCase,
  type HealthStudent,
  type HealthFilters,
  healthStats,
  filterCases,
  displayTime,
} from "@/lib/student-health/model";
import {
  Badges,
  Field,
  btn,
  input,
  primary,
} from "@/components/student-health/HealthUI";
import {
  AlertForm,
  FollowupForm,
  NewReport,
  classChoices,
} from "./HealthForms";
const tabs = [
  ["active", "বর্তমানে অসুস্থ"],
  ["urgent", "জরুরি"],
  ["under_treatment", "চিকিৎসাধীন"],
  ["recovered", "সুস্থ"],
  ["all", "সকল নথি"],
] as const;
type View =
  | { kind: "new" }
  | { kind: "follow" | "recover" | "notify"; record: StaffCase }
  | null;
const bn = (n: number) => n.toLocaleString("bn-BD");
function KitchenSheet({
  records,
  close,
}: {
  records: StaffCase[];
  close: () => void;
}) {
  const list = records.filter(
    (r) => r.status !== "recovered" && r.boarding_diet_note?.trim(),
  );
  return createPortal(
    <section
      role="dialog"
      aria-label="বিশেষ খাবারের তালিকা"
      id="health-kitchen-print"
      className="fixed inset-0 z-[999] overflow-auto bg-white p-6 text-slate-900"
    >
      <style>{`@media print {body:has(#health-kitchen-print)>*:not(#health-kitchen-print){display:none!important} #health-kitchen-print{position:static!important; overflow:visible!important;padding:0!important} #health-kitchen-print tr{break-inside:avoid} #health-kitchen-print button{display:none!important}}`}</style>
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-bold">রান্নাঘরের বিশেষ খাবারের তালিকা</h1>
        <p>
          {displayTime(new Date().toISOString())} · শুধুমাত্র বোর্ডিংয়ের
          ব্যবহারের জন্য
        </p>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {["শিক্ষার্থী", "জামাত ও রোল", "খাবারের নির্দেশনা"].map((s) => (
                <th className="border p-2" key={s}>
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td className="border p-2">{r.student.name}</td>
                <td className="border p-2">
                  {r.student.class_name} · {r.student.roll_number || "—"}
                </td>
                <td className="whitespace-pre-wrap break-words border p-2">
                  {r.boarding_diet_note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <p>বর্তমানে বিশেষ খাবারের নির্দেশনা নেই।</p>}
        <div className="flex gap-2">
          <button className={primary} onClick={() => window.print()}>
            প্রিন্ট করুন
          </button>
          <button autoFocus className={btn} onClick={close}>
            ফিরে যান
          </button>
        </div>
      </div>
    </section>,
    document.body,
  );
}
export default function StudentHealthClient({
  records,
  students,
  initialNew,
  initialNotify,
}: {
  records: StaffCase[];
  students: HealthStudent[];
  initialNew?: boolean;
  initialNotify?: string;
}) {
  const [view, setView] = useState<View>(() => {
      const r = records.find((v) => v.id === initialNotify);
      return initialNew
        ? { kind: "new" }
        : r
          ? { kind: "notify", record: r }
          : null;
    }),
    [tab, setTab] = useState<(typeof tabs)[number][0]>("active"),
    [search, setSearch] = useState(""),
    [group, setGroup] = useState(""),
    [notice, setNotice] = useState(""),
    [print, setPrint] = useState(false);
  const stats = useMemo(() => healthStats(records), [records]),
    filtered = filterCases(records, {
      classId: group,
      search,
      status: tab === "all" ? undefined : tab,
    } satisfies HealthFilters);
  const kpis = [
    ["বর্তমানে অসুস্থ", stats.active],
    ["জরুরি বা হাসপাতালে", stats.urgent],
    ["আজ সুস্থ হয়েছেন", stats.recovered],
    ["অভিভাবককে জানানো বাকি", stats.pending],
  ] as const;
  const close = () => setView(null),
    done = (msg: string) => {
      setNotice(msg);
      close();
      // The server action already revalidated this route in its response.
    };
  return (
    <main className="mx-auto max-w-6xl space-y-5 p-3 text-slate-900 sm:p-5 dark:text-slate-100">
      <header className="rounded-2xl bg-teal-950 p-5 text-white sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-teal-200">
              <Stethoscope size={19} />
              শিক্ষার্থী ব্যবস্থাপনা / স্বাস্থ্য
            </div>
            <h1 className="text-2xl font-bold sm:text-3xl">
              অসুস্থ শিক্ষার্থী ও স্বাস্থ্যসেবা
            </h1>
            <p className="mt-2 text-sm text-teal-100">
              অসুস্থতার খবর, চিকিৎসার অগ্রগতি ও পরিবারের সঙ্গে যোগাযোগ এক
              জায়গায়।
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={btn} onClick={() => setPrint(true)}>
              <Printer size={16} />
              বিশেষ খাবারের তালিকা
            </button>
            <button
              className={primary}
              onClick={() => setView({ kind: "new" })}
            >
              <Plus size={16} />
              নতুন নথি
            </button>
          </div>
        </div>
      </header>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(([label, n], idx) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <span className="flex items-center gap-2 text-sm">
              {idx === 1 && n > 0 && (
                <span className="size-2 rounded-full bg-rose-600 motion-safe:animate-pulse" />
              )}
              {label}
            </span>
            <b
              className={`mt-2 block text-3xl ${idx === 1 && n ? "text-rose-600 dark:text-rose-300" : ""}`}
            >
              {bn(n)} <small className="text-xs font-normal">জন</small>
            </b>
          </div>
        ))}
      </div>
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-teal-300 bg-teal-50 p-3 dark:bg-teal-950"
        >
          {notice}
        </p>
      )}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div aria-label="নথির ধরন" className="flex flex-wrap gap-2">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              aria-pressed={tab === id}
              className={tab === id ? primary : btn}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="জামাত অনুসারে দেখুন">
            <select
              className={input}
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            >
              <option value="">সকল জামাত</option>
              {classChoices(students).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="শিক্ষার্থী খুঁজুন">
            <input
              className={input}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="নাম, রোল বা শিক্ষার্থী আইডি"
            />
          </Field>
        </div>
      </section>
      <section aria-label="স্বাস্থ্য নথি" className="grid gap-3">
        {!filtered.length && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
            এই বাছাইয়ে কোনো স্বাস্থ্য নথি পাওয়া যায়নি।
          </p>
        )}
        {filtered.map((r) => (
          <article
            key={r.id}
            className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto] dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="min-w-0 space-y-1.5">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <HeartPulse size={18} className="text-teal-600" />
                {r.student.name}
              </h2>
              <p className="text-sm">
                {r.student.class_name || "জামাত নেই"} · রোল{" "}
                {r.student.roll_number || "—"} · আইডি{" "}
                {r.student.student_id_code || "—"}
              </p>
              <p className="flex flex-wrap items-center gap-2">
                <b>{r.illness_type}</b>
                <Badges {...r} />
              </p>
              {r.boarding_diet_note && (
                <p className="break-words text-sm">
                  বিশেষ খাবার: {r.boarding_diet_note}
                </p>
              )}
              <p className="text-xs leading-relaxed">
                সর্বশেষ: {displayTime(r.updated_at)} ·{" "}
                {r.guardian_notified_at
                  ? "বার্তা পাঠানো হয়েছে"
                  : "বার্তা পাঠানো হয়নি"}{" "}
                ·{" "}
                {r.guardian_acknowledged_at
                  ? "অভিভাবক অবগত"
                  : "প্রাপ্তি নিশ্চিত হয়নি"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:max-w-56 sm:justify-end">
              <button
                className={btn}
                onClick={() => setView({ kind: "follow", record: r })}
              >
                {r.status === "recovered" ? "ধারাবিবরণী" : "নথি ও ফলো-আপ"}
              </button>
              <button
                className={btn}
                onClick={() => setView({ kind: "notify", record: r })}
              >
                অভিভাবককে জানান
              </button>
              {r.status !== "recovered" && (
                <button
                  className={btn}
                  onClick={() => setView({ kind: "recover", record: r })}
                >
                  সুস্থ ঘোষণা
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
      {view?.kind === "new" && <NewReport {...{ students, close, done }} />}
      {(view?.kind === "recover" || view?.kind === "follow") && (
        <FollowupForm
          record={view.record}
          recover={view.kind === "recover"}
          {...{ close, done }}
        />
      )}
      {view?.kind === "notify" && (
        <AlertForm record={view.record} {...{ close, done }} />
      )}
      {print && (
        <KitchenSheet records={records} close={() => setPrint(false)} />
      )}
    </main>
  );
}
