"use client";

import { useActionState, useEffect, useState } from "react";
import { getTeacher, updateTeacher } from "@/app/actions/teachers";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";

const initialState: { error?: string; success?: boolean } = {};

export default function EditTeacherPage() {
  const [state, formAction, isPending] = useActionState(updateTeacher, initialState);
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [teacher, setTeacher] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTeacher() {
      if (id) {
        const data = await getTeacher(id);
        setTeacher(data);
        setLoading(false);
      }
    }
    fetchTeacher();
  }, [id]);

  useEffect(() => {
    if (state?.success) {
      router.push("/dashboard/teachers");
    }
  }, [state, router]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">শিক্ষক/স্টাফের তথ্য লোড হচ্ছে...</div>;
  }

  if (!teacher) {
    return <div className="p-8 text-center text-red-500">শিক্ষক/স্টাফ পাওয়া যায়নি।</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link
          href="/dashboard/teachers"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">শিক্ষক/স্টাফ সম্পাদনা করুন</h1>
          <p className="text-slate-500">
            {teacher.first_name} {teacher.last_name} এর তথ্য আপডেট করুন
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <form action={formAction} className="space-y-6">
          <input type="hidden" name="id" value={teacher.id} />
          
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
                defaultValue={teacher.first_name}
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
                defaultValue={teacher.last_name}
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
                defaultValue={teacher.phone || ""}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-700">ইমেইল</label>
              <input
                type="email"
                id="email"
                name="email"
                defaultValue={teacher.email || ""}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="designation" className="text-sm font-medium text-slate-700">পদবী / দায়িত্ব</label>
              <input
                type="text"
                id="designation"
                name="designation"
                defaultValue={teacher.designation || ""}
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
              {isPending ? "সেভ হচ্ছে..." : "পরিবর্তন সেভ করুন"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
