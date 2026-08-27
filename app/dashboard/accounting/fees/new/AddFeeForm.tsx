"use client";

import { useActionState, useState } from "react";
import { createFee } from "@/app/actions/accounting";
import { Printer, CheckCircle2, ArrowRight, RefreshCw, FileText } from "lucide-react";
import Link from "next/link";
import DualMoneyReceipt from "@/components/accounting/DualMoneyReceipt";
import StudentSearchSelector from "@/components/common/StudentSearchSelector";

const initialState: { error?: string; success?: boolean; fee?: any } = {};

export default function AddFeeForm({ 
  students,
  madrasaInfo
}: { 
  students: any[];
  madrasaInfo?: any;
}) {
  const [state, formAction, isPending] = useActionState(createFee, initialState);
  const [showFormOnly, setShowFormOnly] = useState(false);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const selectedStudent = state?.fee ? students.find(s => s.id === state.fee.student_id) : null;

  const handleResetForm = () => {
    window.location.reload();
  };

  return (
    <div className="relative">
      {state?.success && state?.fee && !showFormOnly && (
        <div className="space-y-6 mb-8">
          {/* Success Banner & Quick Action Buttons */}
          <div className="p-4 sm:p-5 border border-emerald-200 bg-emerald-50/90 rounded-xl print:hidden shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-600 text-white rounded-lg shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-emerald-900">
                    ফি সফলভাবে গ্রহণ করা হয়েছে!
                  </h3>
                  <p className="text-xs sm:text-sm text-emerald-700 mt-0.5">
                    রিসিট নং: <span className="font-mono font-bold">{state.fee.receipt_no || state.fee.id.substring(0, 8).toUpperCase()}</span> • A4 পেজে ২ কপি (স্টুডেন্ট কপি + অফিস কপি) প্রস্তুত।
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/dashboard/accounting/fees/${state.fee.id}/receipt`}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition text-xs font-semibold shadow-xs"
                >
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span>রিসিট পেজ</span>
                </Link>

                <button
                  type="button"
                  onClick={handleResetForm}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>আরেকটি ফি গ্রহণ করুন</span>
                </button>
              </div>
            </div>
          </div>

          {/* Complete A4 Dual Copy Money Receipt */}
          <DualMoneyReceipt
            fee={state.fee}
            student={selectedStudent}
            madrasaInfo={madrasaInfo}
            showControls={true}
          />
        </div>
      )}

      {/* Entry Form */}
      {(!state?.success || showFormOnly) && (
        <form action={formAction} className="space-y-6 print:hidden">
          {state?.error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100 font-medium">
              {state.error}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <StudentSearchSelector
                students={students}
                name="student_id"
                id="student_id"
                label="শিক্ষার্থী নির্বাচন করুন"
                placeholder="শিক্ষার্থী বেছে নিন (নাম বা রোল লিখে খুঁজুন)..."
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="fee_type" className="text-sm font-semibold text-slate-700">
                ফি'র ধরন <span className="text-red-500">*</span>
              </label>
              <select
                id="fee_type"
                name="fee_type"
                required
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white text-sm"
              >
                <option value="Monthly">মাসিক বেতন (Monthly)</option>
                <option value="Admission">ভর্তি ফি (Admission)</option>
                <option value="Exam">পরীক্ষার ফি (Exam)</option>
                <option value="Hostel">বোর্ডিং / খাবার ফি (Hostel/Food)</option>
                <option value="Books">কিতাব / বই ফি (Books)</option>
                <option value="Other">অন্যান্য (Other)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="amount" className="text-sm font-semibold text-slate-700">
                পরিমাণ (৳) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="amount"
                name="amount"
                required
                min="0"
                step="0.01"
                placeholder="যেমন: 1500"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition text-sm font-semibold"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor="payment_date" className="text-sm font-semibold text-slate-700">
                জমার তারিখ <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="payment_date"
                name="payment_date"
                defaultValue={new Date().toISOString().split('T')[0]}
                required
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition text-sm bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="fee_month" className="text-sm font-semibold text-slate-700">
                মাসের নাম (যদি প্রযোজ্য হয়)
              </label>
              <select
                id="fee_month"
                name="fee_month"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white text-sm"
              >
                <option value="">নির্বাচন করুন</option>
                {[
                  { en: 'January', bn: 'January (জানুয়ারি)' },
                  { en: 'February', bn: 'February (ফেব্রুয়ারি)' },
                  { en: 'March', bn: 'March (মার্চ)' },
                  { en: 'April', bn: 'April (এপ্রিল)' },
                  { en: 'May', bn: 'May (মে)' },
                  { en: 'June', bn: 'June (জুন)' },
                  { en: 'July', bn: 'July (জুলাই)' },
                  { en: 'August', bn: 'August (আগস্ট)' },
                  { en: 'September', bn: 'September (সেপ্টেম্বর)' },
                  { en: 'October', bn: 'October (অক্টোবর)' },
                  { en: 'November', bn: 'November (নভেম্বর)' },
                  { en: 'December', bn: 'December (ডিসেম্বর)' },
                ].map(m => (
                  <option key={m.en} value={m.en}>{m.bn}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="fee_year" className="text-sm font-semibold text-slate-700">
                বছর
              </label>
              <select
                id="fee_year"
                name="fee_year"
                defaultValue={currentYear.toString()}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white text-sm"
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor="notes" className="text-sm font-semibold text-slate-700">
                মন্তব্য / রিসিট নোট (ঐচ্ছিক)
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                placeholder="যেমন: ৩ মাসের বকেয়া পরিশোধ / বিশেষ ছাড়..."
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition resize-none text-sm"
              ></textarea>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-slate-900 text-white px-6 py-3 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition font-bold text-sm shadow-sm cursor-pointer active:scale-99 flex items-center justify-center gap-2"
            >
              {isPending ? "ফি প্রসেসিং হচ্ছে..." : "ফি সেভ ও মানি রিসিট তৈরি করুন"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

