"use client";

import { useActionState } from "react";
import { createStudent, getClasses } from "@/app/actions/students";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "@/components/ImageUploader";

const initialState: { error?: string; success?: boolean } = {};

export default function NewStudentPage() {
  const [state, formAction, isPending] = useActionState(
    createStudent,
    initialState,
  );
  const router = useRouter();
  const [classes, setClasses] = useState<any[]>([]);

  useEffect(() => {
    getClasses().then((data) => setClasses(data || []));
  }, []);

  useEffect(() => {
    if (state?.success) {
      router.push("/dashboard/students");
    }
  }, [state, router]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link
          href="/dashboard/students"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">নতুন শিক্ষার্থী যুক্ত করুন</h1>
          <p className="text-slate-500">
            আপনার মাদ্রাসায় নতুন শিক্ষার্থী নিবন্ধন করুন
          </p>
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
              <label
                htmlFor="first_name"
                className="text-sm font-medium text-slate-700"
              >
                প্রথম নাম <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                required
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="last_name"
                className="text-sm font-medium text-slate-700"
              >
                শেষ নাম <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                required
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="roll_number"
                className="text-sm font-medium text-slate-700"
              >
                রোল নম্বর
              </label>
              <input
                type="text"
                id="roll_number"
                name="roll_number"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="class_id"
                className="text-sm font-medium text-slate-700"
              >
                জামাত / ক্লাস <span className="text-red-500">*</span>
              </label>
              <select
                id="class_id"
                name="class_id"
                required
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
              >
                <option value="">ক্লাস নির্বাচন করুন</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label
                htmlFor="father_name"
                className="text-sm font-medium text-slate-700"
              >
                পিতার নাম
              </label>
              <input
                type="text"
                id="father_name"
                name="father_name"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label
                htmlFor="address"
                className="text-sm font-medium text-slate-700"
              >
                ঠিকানা
              </label>
              <textarea
                id="address"
                name="address"
                rows={2}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            <div className="md:col-span-2">
              <ImageUploader
                name="photo_url"
                label="শিক্ষার্থীর ছবি (Photo)"
                subLabel="পাসপোর্ট বা স্কয়ার সাইজ ছবি আপলোড করুন (স্বয়ংক্রিয়ভাবে iili.io / Catbox ক্লাউডে সেভ হবে)"
                type="general"
                aspectRatio="portrait"
                placeholder="উদা: https://iili.io/xyz.png অথবা https://files.catbox.moe/abc.jpg"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label
                htmlFor="parent_phone"
                className="text-sm font-medium text-slate-700"
              >
                অভিভাবকের ফোন নম্বর
              </label>
              <input
                type="tel"
                id="parent_phone"
                name="parent_phone"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="parent_email"
                className="text-sm font-medium text-slate-700"
              >
                অভিভাবকের ইমেইল (পোর্টাল অ্যাক্সেসের জন্য)
              </label>
              <input
                type="email"
                id="parent_email"
                name="parent_email"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-slate-700"
              >
                পাসওয়ার্ড
              </label>
              <input
                type="password"
                id="password"
                name="password"
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
              {isPending ? "সেভ হচ্ছে..." : "শিক্ষার্থী সেভ করুন"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
