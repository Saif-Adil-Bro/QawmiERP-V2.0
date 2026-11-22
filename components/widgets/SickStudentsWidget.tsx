"use client";
import { useEffect, useState } from "react";
import { getSickStudentsWidgetAction } from "@/app/actions/student-health";
import Link from "next/link";
import { HeartPulse, ArrowUpRight, Bell, Plus } from "lucide-react";
import {
  type HealthWidgetData,
  statusLabel,
  severityLabel,
} from "@/lib/student-health/model";
const href = "/dashboard/students/health";
export default function SickStudentsWidget({
  summary: initial,
  tenant,
  actor,
}: {
  summary: HealthWidgetData | "unavailable";
  tenant: string;
  actor: string;
}) {
  const [summary, setSummary] = useState<typeof initial | null>(initial);
  useEffect(() => {
    // The server already supplied the first paint in the dashboard Promise.all.
    // Only an enabled, mounted widget polls; never fan out clinical data to plugins.
    setSummary(initial);
    let alive = true,
      pending = false;
    async function update() {
      if (
        pending ||
        document.visibilityState !== "visible" ||
        !navigator.onLine
      )
        return;
      pending = true;
      try {
        const next = await getSickStudentsWidgetAction(tenant, actor);
        if (alive) setSummary(next);
      } catch {
        if (alive) setSummary("unavailable");
      } finally {
        pending = false;
      }
    }
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("online", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("online", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [initial, tenant, actor]);
  if (!summary) return null;
  return (
    <section className="h-full space-y-3 rounded-2xl border border-teal-200 bg-white p-5 text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100 dark:border-teal-900">
      <header className="flex items-center gap-2">
        <HeartPulse className="text-teal-600" />
        <h2 className="font-bold">অসুস্থ শিক্ষার্থী ও স্বাস্থ্য আপডেট</h2>
      </header>
      {summary === "unavailable" ? (
        <p role="status">স্বাস্থ্য তালিকা এখন লোড করা যাচ্ছে না।</p>
      ) : (
        <>
          <p>
            বর্তমানে অসুস্থ{" "}
            <b className="text-2xl">{summary.active.toLocaleString("bn-BD")}</b>{" "}
            জন
          </p>
          {summary.urgent > 0 && (
            <p className="rounded-lg bg-rose-100 p-2 text-sm font-bold text-rose-900 dark:bg-rose-950 dark:text-rose-200">
              জরুরি বা হাসপাতালে ভর্তি: {summary.urgent.toLocaleString("bn-BD")}{" "}
              জন
            </p>
          )}
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {summary.cases.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 py-2 text-sm"
              >
                <div>
                  <b>{r.name}</b> · {r.class_name} · রোল {r.roll_number || "—"}
                  <p>
                    {r.illness_type} · {statusLabel[r.status]} ·{" "}
                    {severityLabel[r.severity]}
                  </p>
                </div>
                <Link
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border"
                  href={`${href}?notify=${r.id}`}
                  aria-label={`${r.name} এর অভিভাবককে জানান`}
                >
                  <Bell size={16} />
                </Link>
              </li>
            ))}
          </ul>
          {!summary.active && (
            <p className="text-sm">কোনো সক্রিয় স্বাস্থ্য নথি নেই।</p>
          )}
        </>
      )}
      <footer className="flex flex-wrap justify-between gap-2 border-t pt-2 text-sm font-semibold text-teal-700 dark:text-teal-300">
        <Link
          className="inline-flex min-h-11 items-center gap-1"
          href={`${href}?new=1`}
        >
          <Plus size={16} />
          নতুন নথি
        </Link>
        <Link className="inline-flex min-h-11 items-center gap-1" href={href}>
          সকল নথি
          <ArrowUpRight size={16} />
        </Link>
      </footer>
    </section>
  );
}
