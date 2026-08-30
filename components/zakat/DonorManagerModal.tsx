"use client";

import React, { useState } from "react";
import { X, UserPlus, Edit, HeartHandshake, AlertCircle, Phone, MapPin, DollarSign } from "lucide-react";
import { addDonor, updateDonor } from "@/app/actions/zakat";
import { DonorItem, DonorFrequency } from "@/lib/fund-utils";

interface DonorManagerModalProps {
  donor?: DonorItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function DonorManagerModal({
  donor,
  isOpen,
  onClose,
  onSuccess,
}: DonorManagerModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<DonorFrequency>(
    donor?.donor_type || "OneTime"
  );

  if (!isOpen) return null;

  const isEdit = Boolean(donor && donor.id);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("donor_type", frequency);

    try {
      if (isEdit && donor) {
        const res = await updateDonor(donor.id, formData);
        if (res?.error) {
          setError(res.error);
          return;
        }
      } else {
        const res = await addDonor(formData);
        if (res?.error) {
          setError(res.error);
          return;
        }
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error("DonorManagerModal save failed:", err);
      setError("একটি অপ্রত্যাশিত সমস্যা হয়েছে। সম্ভবত নতুন আপডেট ডিপ্লয় হয়েছে — অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-100 text-purple-800 rounded-xl">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {isEdit ? "দাতার তথ্য সম্পাদনা করুন" : "নতুন দাতা নিবন্ধন করুন"}
              </h3>
              <p className="text-xs text-slate-500">
                বার্ষিক, মাসিক বা এককালীন দাতার বিস্তারিত তথ্য যুক্ত করুন
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

          {/* Frequency Type Selector (User Requirement: বার্ষিক, মাসিক, এককালীন) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              দাতার ধরন / অনুদানের ফ্রিকোয়েন্সি <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFrequency("Monthly")}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 ${
                  frequency === "Monthly"
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span>মাসিক দাতা</span>
                <span className={`text-[10px] font-normal ${frequency === "Monthly" ? "text-blue-100" : "text-slate-500"}`}>
                  (Monthly)
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFrequency("Annual")}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 ${
                  frequency === "Annual"
                    ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span>বার্ষিক দাতা</span>
                <span className={`text-[10px] font-normal ${frequency === "Annual" ? "text-purple-100" : "text-slate-500"}`}>
                  (Annual / Yearly)
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFrequency("OneTime")}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 ${
                  frequency === "OneTime"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span>এককালীন দাতা</span>
                <span className={`text-[10px] font-normal ${frequency === "OneTime" ? "text-emerald-100" : "text-slate-500"}`}>
                  (One-time)
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              দাতার পূর্ণ নাম <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              required
              defaultValue={donor?.name || ""}
              placeholder="যেমন: আলহাজ্ব মোঃ রফিকুল ইসলাম"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition text-sm font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                মোবাইল নম্বর
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="phone"
                  defaultValue={donor?.phone || ""}
                  placeholder="01XXXXXXXXX"
                  className="w-full pl-8 pr-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition text-sm font-mono"
                />
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3.5" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                {frequency === "Monthly" ? "মাসিক প্রতিশ্রুত অনুদান ৳" : frequency === "Annual" ? "বাৎসরিক প্রতিশ্রুত অনুদান ৳" : "অনুদানের পরিমাণ ৳ (ঐচ্ছিক)"}
              </label>
              <div className="relative">
                <input
                  type="number"
                  name="pledge_amount"
                  defaultValue={donor?.pledge_amount || ""}
                  placeholder="যেমন: 5000"
                  min="0"
                  className="w-full pl-8 pr-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition text-sm font-mono"
                />
                <DollarSign className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3.5" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              ঠিকানা / এলাকা
            </label>
            <div className="relative">
              <input
                type="text"
                name="address"
                defaultValue={donor?.address || ""}
                placeholder="যেমন: বাড়ি #১২, রোড #০৪, ধানমন্ডি, ঢাকা"
                className="w-full pl-8 pr-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition text-sm"
              />
              <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3.5" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              মন্তব্য / পেশা / রেফারেন্স
            </label>
            <textarea
              name="notes"
              rows={2}
              defaultValue={donor?.notes || ""}
              placeholder="পেশা বা অন্যান্য বিশেষ তথ্য..."
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
              {loading ? "সংরক্ষণ হচ্ছে..." : isEdit ? "আপডেট করুন" : "দাতা সংরক্ষণ করুন"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
