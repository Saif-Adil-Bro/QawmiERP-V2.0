"use client";
import { useActionState, type ReactNode } from "react";
import { printElementIsolated } from "@/lib/printUtils";
import type { ActionResult } from "@/lib/finance/treasury-types";
export function BookForm({
  action,
  title,
  children,
}: {
  action: (state: ActionResult, fd: FormData) => Promise<ActionResult>;
  title: string;
  children: ReactNode;
}) {
  const [state, submit, pending] = useActionState(action, { message: "" });
  return (
    <form
      action={submit}
      className="grid gap-3 rounded-xl border bg-white p-4 print:hidden"
    >
      {children}
      <button
        disabled={pending}
        className="rounded-lg bg-emerald-800 px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {pending ? "অপেক্ষা করুন…" : title}
      </button>
      {state.message && (
        <p
          role="status"
          className={state.ok ? "text-emerald-800" : "text-red-700"}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
export function PrintBook({ id, title }: { id: string; title: string }) {
  return (
    <button
      type="button"
      aria-controls={id}
      className="rounded border bg-white px-3 py-2 text-sm print:hidden"
      onClick={() => printElementIsolated(id, title, "landscape", "A4")}
    >
      প্রিন্ট / PDF
    </button>
  );
}
