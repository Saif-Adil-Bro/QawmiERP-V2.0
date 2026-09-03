import React from "react";
import { getStudentPublicFeeInfo } from "@/app/actions/payment-gateway";
import DirectPayClient from "./DirectPayClient";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DirectPayPage(props: {
  searchParams?: Promise<{ student_id?: string }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const studentId = searchParams.student_id;

  if (!studentId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-md text-center space-y-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">কোন শিক্ষার্থী পাওয়া যায়নি</h2>
          <p className="text-xs text-slate-500">
            অনুগ্রহ করে আপনার এসএমএস বা নোটিফিকেশনে প্রাপ্ত সঠিক পেমেন্ট লিংকটি ব্যবহার করুন।
          </p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
          >
            হোমপেজে ফিরে যান
          </Link>
        </div>
      </div>
    );
  }

  const feeData = await getStudentPublicFeeInfo(studentId);

  if (!feeData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-md text-center space-y-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">শিক্ষার্থীর তথ্য পাওয়া যায়নি</h2>
          <p className="text-xs text-slate-500">
            প্রদত্ত আইডি অনুযায়ী শিক্ষার্থীর ফি সংক্রান্ত কোনো রেকর্ড খুঁজে পাওয়া যায়নি।
          </p>
        </div>
      </div>
    );
  }

  return <DirectPayClient data={feeData} />;
}
