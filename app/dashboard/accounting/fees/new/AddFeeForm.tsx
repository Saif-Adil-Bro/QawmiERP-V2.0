"use client";

import { useActionState, useRef } from "react";
import { createFee } from "@/app/actions/accounting";
import { Printer } from "lucide-react";

const initialState: { error?: string; success?: boolean; fee?: any } = {};

export default function AddFeeForm({ students }: { students: any[] }) {
  const [state, formAction, isPending] = useActionState(createFee, initialState);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const printReceipt = () => {
    window.print();
  };

  const selectedStudent = state?.fee ? students.find(s => s.id === state.fee.student_id) : null;

  return (
    <div className="relative">
      {state?.success && state?.fee && (
        <div className="mb-8 p-6 border-2 border-dashed border-emerald-200 bg-emerald-50 rounded-xl">
          <div className="flex justify-between items-start mb-4 print:hidden">
            <div>
              <h3 className="text-lg font-bold text-emerald-800">ফি সফলভাবে গ্রহণ করা হয়েছে!</h3>
              <p className="text-sm text-emerald-600 mt-1">নিচে মানি রিসিট দেওয়া হলো।</p>
            </div>
            <button 
              onClick={printReceipt}
              className="flex items-center gap-2 px-4 py-2 bg-white text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 transition shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>রিসিট প্রিন্ট করুন</span>
            </button>
          </div>

          {/* Receipt Content for Print / Display */}
          <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-100" id="receipt-area">
            <div className="text-center mb-6 pb-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800">মানি রিসিট</h2>
              <p className="text-slate-500 text-sm mt-1">রিসিট নং: {state.fee.receipt_no || state.fee.id.substring(0, 8).toUpperCase()}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-y-4 text-slate-700">
              <div>
                <p className="text-sm text-slate-500">শিক্ষার্থীর নাম</p>
                <p className="font-semibold">{selectedStudent?.first_name} {selectedStudent?.last_name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">তারিখ</p>
                <p className="font-semibold">{new Date(state.fee.payment_date).toLocaleDateString('en-GB')}</p>
              </div>
              
              <div>
                <p className="text-sm text-slate-500">জামাত (ক্লাস) ও রোল</p>
                <p className="font-semibold">{selectedStudent?.class_name || 'N/A'} - রোল: {selectedStudent?.roll_number || 'N/A'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">ফি'র ধরন</p>
                <p className="font-semibold">{state.fee.fee_type === 'Monthly' ? 'মাসিক বেতন' : state.fee.fee_type === 'Admission' ? 'ভর্তি ফি' : state.fee.fee_type === 'Exam' ? 'পরীক্ষার ফি' : 'অন্যান্য'}</p>
              </div>

              {(state.fee.fee_month || state.fee.fee_year) && (
                <div>
                  <p className="text-sm text-slate-500">মাস ও বছর</p>
                  <p className="font-semibold">{state.fee.fee_month || ''} {state.fee.fee_year || ''}</p>
                </div>
              )}
              
              <div className="col-span-2 mt-4 pt-4 border-t border-slate-200">
                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-md">
                  <p className="font-bold text-slate-700">সর্বমোট পরিমাণ</p>
                  <p className="text-xl font-bold text-slate-900">৳ {Number(state.fee.amount).toLocaleString('en-IN')}</p>
                </div>
              </div>
            </div>
            
            <div className="mt-12 flex justify-between pt-8">
              <div className="text-center">
                <div className="w-32 border-t border-slate-400 mx-auto"></div>
                <p className="text-sm text-slate-500 mt-2">প্রদানকারীর স্বাক্ষর</p>
              </div>
              <div className="text-center">
                <div className="w-32 border-t border-slate-400 mx-auto"></div>
                <p className="text-sm text-slate-500 mt-2">গ্রহণকারীর স্বাক্ষর</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print styles hide the form */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #receipt-area, #receipt-area * {
            visibility: visible;
          }
          #receipt-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}} />

      <form action={formAction} className="space-y-6 print:hidden">
        {state?.error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-md text-sm border border-red-100">
            {state.error}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="student_id" className="text-sm font-medium text-slate-700">শিক্ষার্থী নির্বাচন করুন <span className="text-red-500">*</span></label>
            <select
              id="student_id"
              name="student_id"
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
            >
              <option value="">নির্বাচন করুন</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name} ({s.class_name || 'Class N/A'} - Roll: {s.roll_number || 'N/A'})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="fee_type" className="text-sm font-medium text-slate-700">ফি'র ধরন <span className="text-red-500">*</span></label>
            <select
              id="fee_type"
              name="fee_type"
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
            >
              <option value="Monthly">মাসিক বেতন (Monthly)</option>
              <option value="Admission">ভর্তি ফি (Admission)</option>
              <option value="Exam">পরীক্ষার ফি (Exam)</option>
              <option value="Other">অন্যান্য (Other)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="amount" className="text-sm font-medium text-slate-700">পরিমাণ (৳) <span className="text-red-500">*</span></label>
            <input
              type="number"
              id="amount"
              name="amount"
              required
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="payment_date" className="text-sm font-medium text-slate-700">জমার তারিখ <span className="text-red-500">*</span></label>
            <input
              type="date"
              id="payment_date"
              name="payment_date"
              defaultValue={new Date().toISOString().split('T')[0]}
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="fee_month" className="text-sm font-medium text-slate-700">মাসের নাম (যদি মাসিক বেতন হয়)</label>
            <select
              id="fee_month"
              name="fee_month"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
            >
              <option value="">নির্বাচন করুন</option>
              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="fee_year" className="text-sm font-medium text-slate-700">বছর</label>
            <select
              id="fee_year"
              name="fee_year"
              defaultValue={currentYear.toString()}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
            >
              <option value="">নির্বাচন করুন</option>
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="notes" className="text-sm font-medium text-slate-700">মন্তব্য (ঐচ্ছিক)</label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="বিশেষ কোনো মন্তব্য..."
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition resize-none"
            ></textarea>
          </div>
        </div>

        <div className="pt-4 border-t">
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-slate-900 text-white px-6 py-2.5 rounded-md hover:bg-slate-800 disabled:opacity-50 transition font-medium"
          >
            {isPending ? "প্রসেসিং হচ্ছে..." : "ফি সেভ করুন"}
          </button>
        </div>
      </form>
    </div>
  );
}
