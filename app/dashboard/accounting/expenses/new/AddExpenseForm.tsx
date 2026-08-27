"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createExpense } from "@/app/actions/accounting";
import { getFunds } from "@/app/actions/zakat";
import { FundItem, DEFAULT_FUNDS } from "@/lib/fund-utils";
import { Landmark } from "lucide-react";

const initialState: { error?: string; success?: boolean } = {};

export default function AddExpenseForm() {
  const [state, formAction, isPending] = useActionState(createExpense, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [funds, setFunds] = useState<FundItem[]>(DEFAULT_FUNDS);
  const [selectedFundId, setSelectedFundId] = useState<string>("fund-general");

  useEffect(() => {
    async function loadFundsList() {
      try {
        const list = await getFunds();
        if (list && list.length > 0) {
          setFunds(list);
        }
      } catch (e) {
        console.error("Failed to load funds:", e);
      }
    }
    loadFundsList();
  }, []);

  useEffect(() => {
    if (state?.success) {
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
    <form ref={formRef} action={formAction} className="space-y-6">
      {state?.error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-md text-sm border border-red-100">
          {state.error}
        </div>
      )}
      
      {state?.success && (
        <div className="p-4 bg-green-50 text-green-700 rounded-md text-sm border border-green-100">
          খরচ সফলভাবে এন্ট্রি করা হয়েছে!
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
            <option value="Food">খাবার (Food/Lillah Boarding)</option>
            <option value="Utility">বিদ্যুৎ/গ্যাস/পানি বিল (Utility)</option>
            <option value="Maintenance">রক্ষণাবেক্ষণ (Maintenance)</option>
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

      <div className="pt-4 border-t">
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-slate-900 text-white px-6 py-2.5 rounded-md hover:bg-slate-800 disabled:opacity-50 transition font-medium cursor-pointer"
        >
          {isPending ? "প্রসেসিং হচ্ছে..." : "খরচ এন্ট্রি সেভ করুন"}
        </button>
      </div>
    </form>
  );
}
