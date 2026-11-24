import Link from "next/link";
import type { ReactNode } from "react";
export const fieldClass =
  "block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm w-full";
export function BookShell({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <Link
        className="text-sm text-emerald-800 underline print:hidden"
        href="/dashboard/accounting"
      >
        ← হিসাবরক্ষণ
      </Link>
      <header>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{note}</p>
      </header>
      {children}
    </main>
  );
}
export function BookError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-amber-300 bg-amber-50 p-4"
    >
      {message}
    </p>
  );
}
