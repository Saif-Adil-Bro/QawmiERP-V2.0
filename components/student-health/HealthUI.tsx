"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import {
  severityLabel,
  statusLabel,
  displayTime,
  type ClinicalState,
  type PortalCase,
} from "@/lib/student-health/model";
export const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:border-teal-600 focus-visible:outline-teal-600 disabled:opacity-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100";
export const primary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50";
export const input =
  "block w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-teal-600 dark:bg-slate-950 dark:border-slate-700 dark:text-white";
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid content-start gap-1 text-sm font-semibold">
      {label}
      {children}
    </label>
  );
}
export function Badges({ status, severity }: ClinicalState) {
  return (
    <span className="inline-flex flex-wrap gap-1 text-xs font-bold">
      <span className="rounded-full bg-teal-100 px-2 py-1 text-teal-900 dark:bg-teal-900 dark:text-teal-100">
        {statusLabel[status]}
      </span>
      <span
        className={`rounded-full px-2 py-1 ${severity === "critical" || severity === "severe" ? "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100"}`}
      >
        {severityLabel[severity]}
      </span>
    </span>
  );
}
export function Modal({
  title,
  children,
  close,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
      className="m-auto max-h-[90dvh] w-[min(94vw,40rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/65 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700"
    >
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2 dark:bg-slate-900 dark:border-slate-700">
        <h2 id={id} className="text-lg font-bold">
          {title}
        </h2>
        <button
          type="button"
          disabled={busy}
          aria-label="বন্ধ করুন"
          className={btn + " min-w-11"}
          onClick={close}
        >
          <X size={18} />
        </button>
      </header>
      <div className="space-y-4 p-4 sm:p-6">{children}</div>
    </dialog>
  );
}
export function Timeline({ items }: { items: PortalCase["timeline"] }) {
  return (
    <ol className="space-y-3 border-s-2 border-teal-300 ps-4">
      {items.map((v) => (
        <li key={v.id} className="space-y-1 break-words text-sm">
          <div className="font-semibold">
            {statusLabel[v.status]} ·{" "}
            <time dateTime={v.created_at}>{displayTime(v.created_at)}</time>
          </div>
          <p className="whitespace-pre-wrap">{v.note}</p>
          {v.temperature && <p>তাপমাত্রা: {v.temperature}</p>}
          {v.treatment_notes && (
            <p className="whitespace-pre-wrap">
              ওষুধ ও পরিচর্যা: {v.treatment_notes}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
