"use client";

import { useActionState } from "react";
import { createTeacher } from "@/app/actions/teachers";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const initialState: { error?: string; success?: boolean } = {};

export default function NewTeacherPage() {
  const [state, formAction, isPending] = useActionState(createTeacher, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.push("/dashboard/teachers");
    }
  }, [state, router]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/dashboard/teachers" className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">নতুন শিক্ষক/স্টাফ যুক্ত করুন</h1>
          <p className="text-slate-500">মাদ্রাসায় নতুন শিক্ষক বা স্টাফ নিবন্ধন করুন</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <form action={formAction} className="space-y-6">
          {state?.error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {state.error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="first_name" className="text-sm font-medium text-slate-700">প্রথম নাম <span className="text-red-500">*</span></label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                required
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="last_name" className="text-sm font-medium text-slate-700">শেষ নাম <span className="text-red-500">*</span></label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                required
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium text-slate-700">ফোন নম্বর</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-700">ইমেইল</label>
              <input
                type="email"
                id="email"
                name="email"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">পাসওয়ার্ড (পোর্টাল অ্যাক্সেসের জন্য)</label>
              <input
                type="password"
                id="password"
                name="password"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="designation" className="text-sm font-medium text-slate-700">পদবী / দায়িত্ব</label>
              <input
                type="text"
                id="designation"
                name="designation"
                placeholder="যেমন: মুহতামিম, ওস্তাদ, স্টাফ"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <button
              type="submit"
              disabled={isPending}
              className="bg-slate-900 text-white px-6 py-2 rounded-md hover:bg-slate-800 disabled:opacity-50 transition"
            >
              {isPending ? "সেভ হচ্ছে..." : "সেভ করুন"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
