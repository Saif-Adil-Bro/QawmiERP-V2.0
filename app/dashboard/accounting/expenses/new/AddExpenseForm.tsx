"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createExpense, ExpenseActionState } from "@/app/actions/accounting";
import { getFunds } from "@/app/actions/zakat";
import { FundItem, DEFAULT_FUNDS } from "@/lib/fund-utils";
import { Landmark, FileText, CheckCircle2, ArrowRight, List, Plus, Trash2, Layers, AlignLeft } from "lucide-react";
import Link from "next/link";
import ExpenseVoucher, { ExpenseItem, MadrasaInfo } from "@/components/accounting/ExpenseVoucher";
import { toBanglaNumber, formatBanglaCurrency } from "@/lib/numberToBangla";

const initialState: ExpenseActionState = {};

interface ItemRow {
  id: string;
  name: string;
  amount: string;
}

export default function AddExpenseForm() {
  const [state, formAction, isPending] = useActionState(createExpense, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [funds, setFunds] = useState<FundItem[]>(DEFAULT_FUNDS);
  const [selectedFundId, setSelectedFundId] = useState<string>("fund-general");
  const [createdVoucher, setCreatedVoucher] = useState<ExpenseItem | null>(null);
  const [madrasaInfo, setMadrasaInfo] = useState<MadrasaInfo | undefined>(undefined);

  // Entry Mode: "itemized" (স্মার্ট আইটেম তালিকা) vs "simple" (একক বা সাধারণ বিবরণ)
  const [entryMode, setEntryMode] = useState<"itemized" | "simple">("itemized");
  const [itemRows, setItemRows] = useState<ItemRow[]>([
    { id: "item-1", name: "", amount: "" },
  ]);
  const [simpleAmount, setSimpleAmount] = useState<string>("");
  const [simpleDescription, setSimpleDescription] = useState<string>("");

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
      setItemRows([{ id: "item-1", name: "", amount: "" }]);
      setSimpleAmount("");
      setSimpleDescription("");
      const dateInput = formRef.current?.elements.namedItem('expense_date') as HTMLInputElement;
      if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
      }
    }
  }, [state]);

  const selectedFund = funds.find(f => f.id === selectedFundId) || funds[0];

  // Calculate sum of itemized rows
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
      setItemRows([{ id: "item-1", name: "", amount: "" }]);
      return;
    }
    setItemRows(prev => prev.filter(r => r.id !== id));
  };

  const updateItemRow = (id: string, field: "name" | "amount", value: string) => {
    setItemRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  };

  // Compile final description & amount for form submission
  const finalAmount = entryMode === "itemized" 
    ? (itemizedTotal > 0 ? itemizedTotal.toFixed(2) : "")
    : simpleAmount;

  const finalDescription = entryMode === "itemized"
    ? itemRows
        .filter(r => r.name.trim() || r.amount.trim())
        .map(r => `${r.name.trim()}${r.amount.trim() ? ` ${r.amount.trim()} টাকা` : ""}`)
        .join("\n")
    : simpleDescription;

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

        {/* Hidden inputs to pass computed data */}
        <input type="hidden" name="fund_id" value={selectedFundId} />
        <input type="hidden" name="fund_name" value={selectedFund?.name || "সাধারণ ফান্ড"} />
        <input type="hidden" name="amount" value={finalAmount} />
        <input type="hidden" name="description" value={finalDescription} />

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

          {/* Category & Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="category" className="text-sm font-medium text-slate-700">
                খরচের খাত (Category) <span className="text-red-500">*</span>
              </label>
              <select
                id="category"
                name="category"
                required
                className="w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white text-sm"
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
              <label htmlFor="expense_date" className="text-sm font-medium text-slate-700">
                তারিখ <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="expense_date"
                name="expense_date"
                defaultValue={new Date().toISOString().split('T')[0]}
                required
                className="w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition font-medium text-sm"
              />
            </div>
          </div>

          {/* Mode Switcher: Itemized breakdown vs Simple text */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>পণ্যের তালিকা ও খরচের বিবরণ</span>
              </span>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setEntryMode("itemized")}
                  className={`px-3 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1 ${
                    entryMode === "itemized" 
                      ? "bg-white text-slate-900 shadow-xs font-bold" 
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <List className="w-3.5 h-3.5 text-emerald-600" />
                  <span>আইটেম অনুযায়ী (স্মার্ট ভাউচার)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode("simple")}
                  className={`px-3 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1 ${
                    entryMode === "simple" 
                      ? "bg-white text-slate-900 shadow-xs font-bold" 
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <AlignLeft className="w-3.5 h-3.5 text-slate-600" />
                  <span>একক বিবরণ</span>
                </button>
              </div>
            </div>

            {/* Itemized Rows Builder */}
            {entryMode === "itemized" ? (
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-600">
                  প্রতিটি পণ্যের নাম এবং তার আলাদা দাম লিখুন। ভাউচারে প্রতিটি পণ্যের জন্য আলাদা ক্রমিক নম্বর ও দাম টেবিল আকারে দৃশ্যমান হবে।
                </p>

                <div className="space-y-2.5">
                  {itemRows.map((row, index) => (
                    <div key={row.id} className="flex items-center gap-2">
                      <span className="w-8 text-center text-xs font-bold font-mono text-slate-500 bg-white py-2 rounded border border-slate-200">
                        {toBanglaNumber(String(index + 1).padStart(2, "0"))}
                      </span>
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateItemRow(row.id, "name", e.target.value)}
                        placeholder="পণ্যের নাম / খরচের বিবরণ (যেমন: মেহমানদারী, কেরোসিন তেল...)"
                        className="flex-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                      <div className="relative w-32 sm:w-36">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">৳</span>
                        <input
                          type="number"
                          value={row.amount}
                          onChange={(e) => updateItemRow(row.id, "amount", e.target.value)}
                          placeholder="দাম"
                          min="0"
                          step="0.01"
                          className="w-full pl-6 pr-2.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-bold text-right"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItemRow(row.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition cursor-pointer self-start"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>আরেকটি পণ্য/আইটেম যোগ করুন</span>
                  </button>

                  {/* Auto-sum Display */}
                  <div className="flex items-center gap-2 justify-end text-sm">
                    <span className="text-slate-600 font-medium">সর্বমোট খরচ:</span>
                    <span className="font-mono font-black text-slate-900 bg-emerald-100/70 border border-emerald-300 px-3 py-1 rounded-lg text-base">
                      ৳ {formatBanglaCurrency(itemizedTotal)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Simple Mode */
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="simple_amount" className="text-sm font-medium text-slate-700">
                    পরিমাণ (৳) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="simple_amount"
                    value={simpleAmount}
                    onChange={(e) => setSimpleAmount(e.target.value)}
                    required={entryMode === "simple"}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="simple_description" className="text-sm font-medium text-slate-700">
                    বিস্তারিত বিবরণ (প্রতি লাইনে আলাদা পণ্যের নাম ও দাম লিখলে ভাউচারে স্বয়ংক্রিয়ভাবে আলাদা সারি তৈরি হবে)
                  </label>
                  <textarea
                    id="simple_description"
                    value={simpleDescription}
                    onChange={(e) => setSimpleDescription(e.target.value)}
                    rows={4}
                    placeholder="উদাহরণ:&#10;মেহমানদারী ২০ টাকা&#10;ব্যাটারি পানি ৫টি ২৫০ টাকা&#10;কেরোসিন তেল ৫০ টাকা"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition font-sans text-sm"
                  ></textarea>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t flex flex-col sm:flex-row items-center gap-3">
          <button
            type="submit"
            disabled={isPending || (entryMode === "itemized" && itemizedTotal <= 0 && itemRows.every(r => !r.name.trim()))}
            className="w-full sm:flex-1 bg-slate-900 text-white px-6 py-2.5 rounded-md hover:bg-slate-800 disabled:opacity-50 transition font-medium cursor-pointer shadow-xs flex items-center justify-center gap-2"
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
                  <span>খরচ এন্ট্রি সফল হয়েছে এবং স্মার্ট ভাউচার প্রস্তুত!</span>
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
