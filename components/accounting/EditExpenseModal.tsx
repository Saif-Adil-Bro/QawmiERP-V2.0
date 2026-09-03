"use client";

import React, { useState, useTransition } from "react";
import { X, Landmark, Save, Loader2 } from "lucide-react";
import { FundItem } from "@/lib/fund-utils";
import { updateExpense } from "@/app/actions/accounting";
import { ExpenseItem } from "./ExpenseVoucher";

interface EditExpenseModalProps {
  expense: ExpenseItem | null;
  funds: FundItem[];
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (updatedExpense: ExpenseItem) => void;
}

export default function EditExpenseModal({
  expense,
  funds,
  isOpen,
  onClose,
  onUpdated,
}: EditExpenseModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !expense) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    
    // Attach fund name from selected fund
    const selectedFundId = formData.get("fund_id") as string;
    const matchedFund = funds.find(f => f.id === selectedFundId);
    if (matchedFund) {
      formData.set("fund_name", matchedFund.name);
    }

    startTransition(async () => {
      try {
        const res = await updateExpense(formData);
        if (res?.error) {
          setError(res.error);
        } else if (res?.success && res.expense) {
          onUpdated({
            ...expense,
            ...res.expense,
          });
          onClose();
        }
      } catch (err: any) {
        console.error("Update expense failed:", err);
        setError("খরচ আপডেট করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
      }
    });
  };

  const initialFundId = expense.fund_id || "fund-general";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">খরচের রেকর্ড সম্পাদনা (Edit Expense)</h2>
            <p className="text-xs text-slate-500 mt-0.5">ভাউচার নং: {expense.voucher_no || `#EXP-${expense.id.slice(0, 6)}`}</p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-left">
          <input type="hidden" name="id" value={expense.id} />

          {/* Fund Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-emerald-600" />
              <span>কোন ফান্ড থেকে খরচ? (Fund Selection) *</span>
            </label>
            <select
              name="fund_id"
              defaultValue={initialFundId}
              required
              className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm font-semibold bg-emerald-50/40 text-slate-900"
            >
              {funds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} {f.code ? `(${f.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">খরচের খাত (Category) *</label>
            <select
              name="category"
              defaultValue={expense.category}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm bg-white"
            >
              <option value="Salary">শিক্ষক/স্টাফ বেতন (Salary)</option>
              <option value="Food">খাবার ও মেস (Food/Lillah)</option>
              <option value="Utility">বিদ্যুৎ/গ্যাস/পানি বিল (Utility)</option>
              <option value="Maintenance">রক্ষণাবেক্ষণ ও মেরামত</option>
              <option value="Other">অন্যান্য (Other)</option>
            </select>
          </div>

          {/* Amount & Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">পরিমাণ (৳) *</label>
              <input
                type="number"
                name="amount"
                defaultValue={expense.amount}
                required
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">তারিখ *</label>
              <input
                type="date"
                name="expense_date"
                defaultValue={expense.expense_date ? new Date(expense.expense_date).toISOString().split('T')[0] : ""}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm font-medium"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">খরচের বিস্তারিত বিবরণ</label>
            <textarea
              name="description"
              defaultValue={expense.description || ""}
              rows={3}
              placeholder="খরচের বিবরণ..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm resize-none"
            ></textarea>
          </div>

          {/* Submit Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>আপডেট হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>পরিবর্তন সংরক্ষণ করুন</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
