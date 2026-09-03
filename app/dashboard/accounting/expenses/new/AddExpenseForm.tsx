"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createExpense, ExpenseActionState } from "@/app/actions/accounting";
import { getFunds } from "@/app/actions/zakat";
import { FundItem, DEFAULT_FUNDS } from "@/lib/fund-utils";
import { Landmark, FileText, CheckCircle2, ArrowRight, List } from "lucide-react";
import Link from "next/link";
import ExpenseVoucher, { ExpenseItem, MadrasaInfo } from "@/components/accounting/ExpenseVoucher";

const initialState: ExpenseActionState = {};

export default function AddExpenseForm() {
  const [state, formAction, isPending] = useActionState(createExpense, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [funds, setFunds] = useState<FundItem[]>(DEFAULT_FUNDS);
  const [selectedFundId, setSelectedFundId] = useState<string>("fund-general");
  const [createdVoucher, setCreatedVoucher] = useState<ExpenseItem | null>(null);
  const [madrasaInfo, setMadrasaInfo] = useState<MadrasaInfo | undefined>(undefined);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [fundsList, madrasaRes] = await Promise.all([
          getFunds(),
          fetch("/api/madrasa-info").then(r => r.ok ? r.json() : null).catch(() => null)
        ]);

        if (fundsList && fundsList.length > 0) {
          setFunds(fundsList);
        }
        if (madrasaRes) {
          setMadrasaInfo(madrasaRes);
        }
      } catch (e) {
        console.error("Failed to load initial data:", e);
      }
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    if (state?.success && state?.expense) {
      setCreatedVoucher(state.expense);
      formRef.current?.reset();
      setSelectedFundId("fund-general");
      const dateInput = formRef.current?.elements.namedItem('expense_date') as HTMLInputElement;
      if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
      }
    }
  }, [state]);

  const selectedFund = funds.find(f => f.id === selectedFundId) || funds[0];

  return (
    <>
      <form ref={formRef} action={formAction} className="space-y-6">
        {state?.error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-md text-sm border border-red-100">
            {state.error}
          </div>
        )}
        
        {state?.success && !createdVoucher && (
          <div className="p-4 bg-green-50 text-green-700 rounded-md text-sm border border-green-100 flex items-center justify-between">
            <span className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              খরচ সফলভাবে এন্ট্রি করা হয়েছে!
            </span>
          </div>
        )}

        {/* Hidden inputs to pass fund info */}
        <input type="hidden" name="fund_id" value={selectedFundId} />
        <input type="hidden" name="fund_name" value={selectedFund?.name || "সাধারণ ফান্ড"} />

        <div className="grid grid-cols-1 gap-6">
          {/* Fund Selection Field */}
          <div className="space-y-2">
            <label htmlFor="fund_id_select" className="text-sm font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-emerald-600" />
                <span>কোন ফান্ড থেকে খরচ হবে? (Fund Selection) *</span>
              </span>
              <span className="text-[11px] font-normal text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                আয়-ব্যয় সমন্বয়ের জন্য
              </span>
            </label>
            <select
              id="fund_id_select"
              value={selectedFundId}
              onChange={(e) => setSelectedFundId(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-emerald-50/40 font-semibold text-slate-900"
            >
              {funds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} {f.code ? `(${f.code})` : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              {selectedFund?.description || "নির্বাচিত ফান্ডের তহবিল থেকে এই ব্যয়ের অর্থ সমন্বয় করা হবে।"}
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="category" className="text-sm font-medium text-slate-700">খরচের খাত (Category) <span className="text-red-500">*</span></label>
            <select
              id="category"
              name="category"
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
            >
              <option value="">নির্বাচন করুন</option>
              <option value="Salary">শিক্ষক/স্টাফ বেতন (Salary)</option>
              <option value="Food">খাবার ও মেস (Food/Lillah Boarding)</option>
              <option value="Utility">বিদ্যুৎ/গ্যাস/পানি বিল (Utility)</option>
              <option value="Maintenance">রক্ষণাবেক্ষণ ও মেরামত (Maintenance)</option>
              <option value="Other">অন্যান্য / বিবিধ (Other)</option>
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
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition font-bold"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="expense_date" className="text-sm font-medium text-slate-700">তারিখ <span className="text-red-500">*</span></label>
            <input
              type="date"
              id="expense_date"
              name="expense_date"
              defaultValue={new Date().toISOString().split('T')[0]}
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition font-medium"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium text-slate-700">বিস্তারিত বিবরণ</label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="খরচের বিস্তারিত বিবরণ লিখুন..."
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition resize-none"
            ></textarea>
          </div>
        </div>

        <div className="pt-4 border-t flex flex-col sm:flex-row items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="w-full sm:flex-1 bg-slate-900 text-white px-6 py-2.5 rounded-md hover:bg-slate-800 disabled:opacity-50 transition font-medium cursor-pointer shadow-xs"
          >
            {isPending ? "প্রসেসিং হচ্ছে..." : "খরচ এন্ট্রি সেভ করুন ও ভাউচার তৈরি করুন"}
          </button>
        </div>
      </form>

      {/* Instant Expense Voucher Popup Modal upon saving */}
      {createdVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="max-w-4xl w-full my-auto py-6">
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 print:hidden">
                <div className="flex items-center gap-2 text-emerald-700 font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>খরচ এন্ট্রি সফল হয়েছে এবং ভাউচার প্রস্তুত!</span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setCreatedVoucher(null)}
                    className="flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                  >
                    আরেকটি খরচ যোগ করুন
                  </button>
                  <Link
                    href="/dashboard/accounting/expenses"
                    className="flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition flex items-center justify-center gap-1"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>খরচের তালিকা দেখুন</span>
                  </Link>
                </div>
              </div>

              {/* Render Voucher */}
              <ExpenseVoucher
                expense={createdVoucher}
                madrasaInfo={madrasaInfo}
                onClose={() => setCreatedVoucher(null)}
                showControls={true}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
