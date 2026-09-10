"use client";

import { useActionState } from "react";
import { createSubject } from "@/app/actions/subjects";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function NewSubjectPage() {
  const [state, formAction, isPending] = useActionState(createSubject, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.push("/dashboard/subjects");
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/subjects"
          className="p-2 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">নতুন বিষয় / কিতাব যুক্ত করুন</h1>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <form action={formAction} className="space-y-6">
          {state?.error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200">
              {state.error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                বিষয়ের নাম (যেমন: হেদায়াতুন্নাহু, তাজবীদ) *
              </label>
              <input
                type="text"
                name="name"
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm font-medium"
                placeholder="বিষয়ের নাম লিখুন"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                বিষয় কোড (ঐচ্ছিক)
              </label>
              <input
                type="text"
                name="code"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm font-mono"
                placeholder="যেমন: ARB-101"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              বিবরণ (ঐচ্ছিক)
            </label>
            <textarea
              name="description"
              rows={3}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm"
              placeholder="বিষয় বা কিতাব সম্পর্কিত বিবরণ লিখুন"
            ></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Link
              href="/dashboard/subjects"
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-bold transition-colors"
            >
              বাতিল
            </Link>
            <button
              type="submit"
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isPending ? "সংরক্ষণ হচ্ছে..." : "বিষয় সংরক্ষণ করুন"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
