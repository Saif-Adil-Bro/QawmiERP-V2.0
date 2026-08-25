"use client";

import { useActionState, useEffect } from "react";
import { updateStudent } from "@/app/actions/students";
import { useRouter } from "next/navigation";
import { getStudentIdNumber, convertToBanglaNumber } from "@/lib/student-utils";

const initialState: { error?: string; success?: boolean } = {};

interface EditStudentFormProps {
  student: any;
  classes: any[];
  allStudents: any[];
}

export default function EditStudentForm({
  student,
  classes,
  allStudents,
}: EditStudentFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateStudent,
    initialState
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.push("/dashboard/students");
    }
  }, [state, router]);

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <form action={formAction} className="space-y-6">
        <input type="hidden" name="id" value={student.id} />
        {state?.error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
            {state.error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 md:col-span-2 bg-slate-50/50 p-3 rounded-lg border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">
                শিক্ষার্থী আইডি নম্বর (অটোমেটিক জেনারেটেড)
              </p>
              <p className="text-lg font-bold text-blue-700 font-mono">
                {convertToBanglaNumber(getStudentIdNumber(student, allStudents))}
              </p>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-100">
              Auto Generated
            </span>
          </div>

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
              defaultValue={student.first_name || ""}
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
              defaultValue={student.last_name || ""}
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
              defaultValue={student.roll_number || ""}
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
              defaultValue={student.class_id || ""}
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
              defaultValue={student.father_name || ""}
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
              defaultValue={student.address || ""}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label
              htmlFor="photo_url"
              className="text-sm font-medium text-slate-700"
            >
              ছবি (URL)
            </label>
            <input
              type="url"
              id="photo_url"
              name="photo_url"
              placeholder="https://example.com/photo.jpg"
              defaultValue={student.photo_url || ""}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
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
              defaultValue={student.parent_phone || ""}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <button
            type="submit"
            disabled={isPending}
            className="bg-slate-900 text-white px-6 py-2 rounded-md hover:bg-slate-800 transition disabled:opacity-50"
          >
            {isPending ? "সেভ হচ্ছে..." : "পরিবর্তন সেভ করুন"}
          </button>
        </div>
      </form>
    </div>
  );
}
