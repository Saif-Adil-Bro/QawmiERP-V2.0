"use client";

import React, { useState, useTransition, useEffect } from "react";
import { X, Landmark, Save, Loader2, Plus, Trash2, Layers, AlignLeft, List } from "lucide-react";
import { FundItem } from "@/lib/fund-utils";
import { updateExpense } from "@/app/actions/accounting";
import { ExpenseItem } from "./ExpenseVoucher";
import { parseExpenseItems } from "@/lib/expense-parser";
import { toBanglaNumber, formatBanglaCurrency } from "@/lib/numberToBangla";

interface EditExpenseModalProps {
  expense: ExpenseItem | null;
  funds: FundItem[];
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (updatedExpense: ExpenseItem) => void;
}

interface ItemRow {
  id: string;
  name: string;
  amount: string;
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

  const [entryMode, setEntryMode] = useState<"itemized" | "simple">("itemized");
  const [itemRows, setItemRows] = useState<ItemRow[]>([]);
  const [simpleAmount, setSimpleAmount] = useState<string>("");
  const [simpleDescription, setSimpleDescription] = useState<string>("");

  useEffect(() => {
    if (expense) {
      const parsed = parseExpenseItems(expense.description, expense.amount);
      if (parsed.length > 1 || (parsed.length === 1 && parsed[0].amount !== null && parsed[0].name !== "মাদরাসার প্রাতিষ্ঠানিক প্রয়োজনে ব্যয় নির্বাহ করা হয়েছে।")) {
        setEntryMode("itemized");
        setItemRows(
          parsed.map((p, idx) => ({
            id: `edit-item-${idx}-${Date.now()}`,
            name: p.name,
            amount: p.amount ? String(p.amount) : "",
          }))
        );
      } else {
        setEntryMode("simple");
        setItemRows([{ id: "edit-item-1", name: "", amount: "" }]);
      }
      setSimpleAmount(String(expense.amount || ""));
      setSimpleDescription(expense.description || "");
    }
  }, [expense]);

  if (!isOpen || !expense) return null;

  const itemizedTotal = itemRows.reduce((sum, row) => {
    const val = parseFloat(row.amount);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const addItemRow = () => {
    setItemRows(prev => [
      ...prev,
      { id: `item-${Date.now()}-${Math.random()}`, name: "", amount: "" }
    ]);
  };

  const removeItemRow = (id: string) => {
    if (itemRows.length <= 1) {
      setItemRows([{ id: `item-${Date.now()}`, name: "", amount: "" }]);
      return;
    }
    setItemRows(prev => prev.filter(r => r.id !== id));
  };

  const updateItemRow = (id: string, field: "name" | "amount", value: string) => {
    setItemRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const finalAmount = entryMode === "itemized"
    ? (itemizedTotal > 0 ? itemizedTotal.toFixed(2) : (simpleAmount || "0"))
    : simpleAmount;

  const finalDescription = entryMode === "itemized"
    ? itemRows
        .filter(r => r.name.trim() || r.amount.trim())
        .map(r => `${r.name.trim()}${r.amount.trim() ? ` ${r.amount.trim()} টাকা` : ""}`)
        .join("\n")
    : simpleDescription;

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

    // Set computed amount and description
    formData.set("amount", finalAmount);
    formData.set("description", finalDescription);

    startTransition(async () => {
      try {
        const res = await updateExpense(formData);
        if (res?.error) {
          setError(res.error);
        } else if (res?.success && res.expense) {
          onUpdated({
            ...expense,
            ...res.expense,
            amount: parseFloat(finalAmount),
            description: finalDescription,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 relative my-auto">
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

          {/* Category & Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <option value="Other">অন্যান্য / বিবিধ (Other)</option>
              </select>
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

          {/* Mode Switcher */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                <span>পণ্যের বিবরণ ও দাম</span>
              </span>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setEntryMode("itemized")}
                  className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1 ${
                    entryMode === "itemized" 
                      ? "bg-white text-slate-900 shadow-xs font-bold" 
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <List className="w-3 h-3 text-emerald-600" />
                  <span>আইটেম অনুযায়ী</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode("simple")}
                  className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1 ${
                    entryMode === "simple" 
                      ? "bg-white text-slate-900 shadow-xs font-bold" 
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <AlignLeft className="w-3 h-3 text-slate-600" />
                  <span>একক টেক্সট</span>
                </button>
              </div>
            </div>

            {/* Itemized Builder */}
            {entryMode === "itemized" ? (
              <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {itemRows.map((row, index) => (
                    <div key={row.id} className="flex items-center gap-1.5">
                      <span className="w-7 text-center text-xs font-bold font-mono text-slate-500 bg-white py-1.5 rounded border border-slate-200">
                        {toBanglaNumber(String(index + 1).padStart(2, "0"))}
                      </span>
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateItemRow(row.id, "name", e.target.value)}
                        placeholder="পণ্যের নাম (যেমন: মেহমানদারী, কেরোসিন তেল)"
                        className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                      <div className="relative w-28">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">৳</span>
                        <input
                          type="number"
                          value={row.amount}
                          onChange={(e) => updateItemRow(row.id, "amount", e.target.value)}
                          placeholder="দাম"
                          min="0"
                          step="0.01"
                          className="w-full pl-5 pr-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-bold text-right"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItemRow(row.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition cursor-pointer"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md text-xs font-bold transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>আইটেম যোগ করুন</span>
                  </button>

                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-600 font-medium">মোট:</span>
                    <span className="font-mono font-black text-slate-900 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded text-sm">
                      ৳ {formatBanglaCurrency(itemizedTotal)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Simple Mode */
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">পরিমাণ (৳) *</label>
                  <input
                    type="number"
                    value={simpleAmount}
                    onChange={(e) => setSimpleAmount(e.target.value)}
                    required={entryMode === "simple"}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">বিবরণ</label>
                  <textarea
                    value={simpleDescription}
                    onChange={(e) => setSimpleDescription(e.target.value)}
                    rows={3}
                    placeholder="খরচের বিবরণ..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-xs resize-none"
                  ></textarea>
                </div>
              </div>
            )}
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
