"use client";

import { useActionState } from "react";
import { createClass } from "@/app/actions/classes";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function NewClassPage() {
  const [state, formAction, isPending] = useActionState(createClass, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.push("/dashboard/classes");
    }
  }, [state, router]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/classes"
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">Add New Class</h1>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <form action={formAction} className="space-y-6">
          {state?.error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
              {state.error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Class Name (e.g. মিজান, নাহবেমীর) *
            </label>
            <input
              type="text"
              name="name"
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              placeholder="Enter class name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              name="description"
              rows={3}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              placeholder="Enter class details"
            ></textarea>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Sequence Number (জামাত ক্রমবিন্যাস স্তর - e.g. 1, 2, 3) *
            </label>
            <input
              type="number"
              name="sequence"
              defaultValue="0"
              required
              min="0"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-mono font-bold"
              placeholder="0"
            />
            <p className="text-xs text-slate-500 mt-1">
              নিম্ন নম্বর উচ্চ প্রাধিকার বা নিম্নতম জামাতকে নির্দেশ করে। যেমন: ১ (মিজান), ২ (নাহবেমীর), ৩ (হেদায়াতুন্নাহু)...
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Link
              href="/dashboard/classes"
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Save Class"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
