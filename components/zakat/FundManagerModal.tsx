"use client";

import React, { useState } from "react";
import { X, PlusCircle, Edit, Layers, CheckCircle2, AlertCircle } from "lucide-react";
import { createFund, updateFund } from "@/app/actions/zakat";
import { FundItem } from "@/lib/fund-utils";

interface FundManagerModalProps {
  fund?: FundItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function FundManagerModal({
  fund,
  isOpen,
  onClose,
  onSuccess,
}: FundManagerModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isEdit = Boolean(fund && !fund.is_default);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      if (isEdit && fund) {
        await updateFund(fund.id, formData);
      } else {
        await createFund(formData);
      }
      setLoading(false);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setLoading(false);
      setError(err.message || "ফান্ড সংরক্ষণ করতে সমস্যা হয়েছে");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {isEdit ? "ফান্ড সম্পাদনা করুন" : "নতুন ফান্ড ক্যাটাগরি তৈরি করুন"}
              </h3>
              <p className="text-xs text-slate-500">
                সাধারণ, লিল্লাহ, যাকাত ছাড়াও যেকোনো কাস্টম ফান্ড তৈরি করুন
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-center gap-2 border border-red-100 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              ফান্ডের নাম <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              required
              defaultValue={fund?.name || ""}
              placeholder="যেমন: হিফজুল কুরআন স্কলারশিপ ফান্ড / ভবন নির্মাণ ফান্ড"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition text-sm font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                মূল ক্যাটাগরি গ্রুপ
              </label>
              <select
                name="category"
                defaultValue={fund?.category || "General"}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition text-sm bg-white"
              >
                <option value="General">সাধারণ ফান্ড (General)</option>
                <option value="Lillah">লিল্লাহ বোর্ডিং (Lillah)</option>
                <option value="Zakat">যাকাত ফান্ড (Zakat)</option>
                <option value="Fitra">ফিতরা ও সদকা (Fitra)</option>
                <option value="Development">উন্নয়ন ও নির্মাণ (Development)</option>
                <option value="Education">শিক্ষা ও এতিম (Education)</option>
                <option value="Other">অন্যান্য (Other)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                ফান্ড কোড (সংক্ষিপ্ত)
              </label>
              <input
                type="text"
                name="code"
                defaultValue={fund?.code || ""}
                placeholder="যেমন: BLD, HIFZ"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition text-sm uppercase font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                লক্ষ্যমাত্রা / বাজেট ৳ (ঐচ্ছিক)
              </label>
              <input
                type="number"
                name="target_amount"
                defaultValue={fund?.target_amount || ""}
                placeholder="যেমন: 500000"
                min="0"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition text-sm font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                ব্যাজ কালার
              </label>
              <select
                name="color"
                defaultValue={fund?.color || "emerald"}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition text-sm bg-white"
              >
                <option value="emerald">সবুজ (Emerald)</option>
                <option value="indigo">নীল (Indigo)</option>
                <option value="amber">হলুদ (Amber)</option>
                <option value="rose">লাল / গোলাপী (Rose)</option>
                <option value="sky">আকাশি (Sky)</option>
                <option value="purple">বেগুনি (Purple)</option>
                <option value="teal">টিল (Teal)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              ফান্ডের উদ্দেশ্য ও বিবরণ
            </label>
            <textarea
              name="description"
              rows={2}
              defaultValue={fund?.description || ""}
              placeholder="এই ফান্ডের টাকা কোন খাতে ব্যয় হবে তার সংক্ষিপ্ত বিবরণ..."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition text-sm resize-none"
            ></textarea>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition disabled:opacity-50 shadow-xs cursor-pointer"
            >
              {loading ? "সংরক্ষণ হচ্ছে..." : isEdit ? "আপডেট করুন" : "ফান্ড তৈরি করুন"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
