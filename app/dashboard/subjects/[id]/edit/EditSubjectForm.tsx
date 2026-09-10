"use client";

import { useActionState, useEffect } from "react";
import { updateSubject } from "@/app/actions/subjects";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function EditSubjectForm({ subject }: { subject: any }) {
  const updateSubjectWithId = updateSubject.bind(null, subject.id);
  const [state, formAction, isPending] = useActionState(updateSubjectWithId, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.push("/dashboard/subjects");
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            বিষয়ের নাম (যেমন: হেদায়াতুন্নাহু, তাজবীদ) *
          </label>
          <input
            type="text"
            name="name"
            defaultValue={subject.name || ""}
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
            placeholder="বিষয়ের নাম লিখুন"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            বিষয় কোড (ঐচ্ছিক)
          </label>
          <input
            type="text"
            name="code"
            defaultValue={subject.code || ""}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
            placeholder="যেমন: ARB-101"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          বিবরণ (ঐচ্ছিক)
        </label>
        <textarea
          name="description"
          defaultValue={subject.description || ""}
          rows={3}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
          placeholder="বিষয় বা কিতাব সম্পর্কিত বিবরণ লিখুন"
        ></textarea>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Link
          href="/dashboard/subjects"
          className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
        >
          বাতিল
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
        >
          {isPending ? "সংরক্ষণ হচ্ছে..." : "পরিবর্তন সংরক্ষণ করুন"}
        </button>
      </div>
    </form>
  );
}
