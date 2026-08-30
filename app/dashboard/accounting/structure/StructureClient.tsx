"use client";

import { useState } from "react";
import {
  FeeStructure,
  FeeType,
  FeeFrequency,
  FeeCategory,
  FeeStructureItem,
} from "@/lib/fee-management";
import { AcademicSession } from "@/lib/sessions";
import { saveFeeStructure, deleteFeeStructure, saveFeeType } from "@/app/actions/fee-management";
import { toBanglaNumber, formatBanglaCurrency } from "@/lib/numberToBangla";
import {
  Plus,
  Edit2,
  Trash2,
  Settings2,
  CheckCircle2,
  BookOpen,
  Calendar,
  Layers,
  Sparkles,
  X,
  AlertTriangle,
} from "lucide-react";

interface StructureClientProps {
  initialStructures: FeeStructure[];
  initialFeeTypes: FeeType[];
  sessions: AcademicSession[];
  classes: any[];
}

export default function StructureClient({
  initialStructures,
  initialFeeTypes,
  sessions,
  classes,
}: StructureClientProps) {
  const [structures, setStructures] = useState<FeeStructure[]>(initialStructures);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>(initialFeeTypes);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"structures" | "types">("structures");

  // Structure Modal State
  const [isStructModalOpen, setIsStructModalOpen] = useState(false);
  const [editingStruct, setEditingStruct] = useState<FeeStructure | null>(null);
  const [structForm, setStructForm] = useState<{
    id?: string;
    session_id: string;
    class_id: string;
    class_name: string;
    student_category: "ALL" | "RESIDENTIAL" | "NON_RESIDENTIAL" | "ORPHAN" | "DAY_CARE";
    name: string;
    items: FeeStructureItem[];
  }>({
    session_id: sessions.find((s) => s.is_current)?.id || sessions[0]?.id || "default",
    class_id: "ALL",
    class_name: "সকল জামাত",
    student_category: "ALL",
    name: "",
    items: [],
  });

  // Type Modal State
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [typeForm, setTypeForm] = useState<Partial<FeeType>>({
    name: "",
    code: "CUSTOM",
    category: "ACADEMIC",
    frequency: "MONTHLY",
    default_amount: 1000,
    is_active: true,
  });

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filteredStructures =
    selectedSessionId === "ALL"
      ? structures
      : structures.filter((s) => s.session_id === selectedSessionId);

  // Open Create Structure
  const handleOpenCreateStruct = () => {
    setEditingStruct(null);
    setStructForm({
      session_id: sessions.find((s) => s.is_current)?.id || sessions[0]?.id || "default",
      class_id: "ALL",
      class_name: "সকল জামাত",
      student_category: "ALL",
      name: "",
      items: feeTypes
        .filter((ft) => ft.is_active)
        .map((ft) => ({
          fee_type_id: ft.id,
          fee_type_name: ft.name,
          amount: ft.default_amount || 0,
          frequency: ft.frequency,
        })),
    });
    setIsStructModalOpen(true);
  };

  // Open Edit Structure
  const handleOpenEditStruct = (struct: FeeStructure) => {
    setEditingStruct(struct);
    setStructForm({
      id: struct.id,
      session_id: struct.session_id,
      class_id: struct.class_id,
      class_name: struct.class_name,
      student_category: struct.student_category,
      name: struct.name,
      items: struct.items || [],
    });
    setIsStructModalOpen(true);
  };

  // Save Structure Submit
  const handleSaveStruct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    const targetClass = classes.find((c) => c.id === structForm.class_id);
    const resolvedClassName = structForm.class_id === "ALL" ? "সকল জামাত" : (targetClass?.name || "সাধারণ");

    const payload = {
      ...structForm,
      class_name: resolvedClassName,
      name:
        structForm.name.trim() ||
        `${resolvedClassName} - ফি কাঠামো`,
    };

    const res = await saveFeeStructure(payload);
    setLoading(false);

    if (res.success) {
      setFeedback({ type: "success", text: res.message || "ফি কাঠামো সংরক্ষিত হয়েছে।" });
      setIsStructModalOpen(false);
      window.location.reload();
    } else {
      setFeedback({ type: "error", text: res.error || "সংরক্ষণ ব্যর্থ হয়েছে।" });
    }
  };

  // Delete Structure
  const handleDeleteStruct = async (id: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই ফি কাঠামো মুছে ফেলতে চান?")) return;
    setLoading(true);
    const res = await deleteFeeStructure(id);
    setLoading(false);
    if (res.success) {
      setStructures((prev) => prev.filter((s) => s.id !== id));
      setFeedback({ type: "success", text: "ফি কাঠামো মুছে ফেলা হয়েছে।" });
    } else {
      setFeedback({ type: "error", text: res.error || "মুছে ফেলা ব্যর্থ হয়েছে।" });
    }
  };

  // Save Fee Type
  const handleSaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await saveFeeType(typeForm);
    setLoading(false);
    if (res.success) {
      setFeedback({ type: "success", text: res.message || "ফি টাইপ সংরক্ষিত হয়েছে।" });
      setIsTypeModalOpen(false);
      window.location.reload();
    } else {
      setFeedback({ type: "error", text: res.error || "ফি টাইপ সংরক্ষণ ব্যর্থ হয়েছে।" });
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between shadow-2xs ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <span>{feedback.text}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs & Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("structures")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "structures"
                ? "bg-slate-900 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>ফি কাঠামো (Fee Structures)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("types")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "types"
                ? "bg-slate-900 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span>ফি'র খাতসমূহ (Fee Types)</span>
          </button>
        </div>

        {activeTab === "structures" ? (
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm font-medium border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="ALL">সকল শিক্ষাবর্ষ (All Sessions)</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.academic_year}) {s.is_current ? "⭐" : ""}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleOpenCreateStruct}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ নতুন ফি কাঠামো তৈরি</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setTypeForm({
                name: "",
                code: "CUSTOM",
                category: "ACADEMIC",
                frequency: "MONTHLY",
                default_amount: 500,
                is_active: true,
              });
              setIsTypeModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ নতুন ফি টাইপ যোগ করুন</span>
          </button>
        )}
      </div>

      {/* TAB 1: Fee Structures List */}
      {activeTab === "structures" && (
        <div className="space-y-6">
          {filteredStructures.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                <Layers className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">কোনো ফি কাঠামো পাওয়া যায়নি</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                জামাত অনুযায়ী শিক্ষার্থীদের মাসিক বেতন, ভর্তি ফি এবং অন্যান্য খরচের তালিকা তৈরি করে সহজে পরিচালনা করুন।
              </p>
              <button
                type="button"
                onClick={handleOpenCreateStruct}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                + প্রথম ফি কাঠামো তৈরি করুন
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredStructures.map((struct) => {
                const sessionObj = sessions.find((s) => s.id === struct.session_id);

                return (
                  <div
                    key={struct.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition p-5 flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      {/* Structure Header */}
                      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {struct.class_name || "সকল জামাত"}
                          </span>
                          <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
                            {struct.name}
                          </h3>
                          <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>সেশন: {sessionObj?.name || "সার্বজনীন"}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditStruct(struct)}
                            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="সম্পাদনা করুন"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStruct(struct.id)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Items Table */}
                      <div className="border border-slate-100 rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                            <tr>
                              <th className="py-2 px-3">ফি'র খাত</th>
                              <th className="py-2 px-3">ধরণ</th>
                              <th className="py-2 px-3 text-right">পরিমাণ (৳)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(struct.items || []).map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="py-2 px-3 font-semibold text-slate-800">
                                  {item.fee_type_name}
                                </td>
                                <td className="py-2 px-3 text-slate-500">
                                  {item.frequency === "MONTHLY" ? "মাসিক" : item.frequency === "ONETIME" ? "এককালীন" : "মেয়াদী"}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                  ৳ {formatBanglaCurrency(item.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Summary Totals */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between bg-slate-50 p-3 rounded-xl">
                      <div>
                        <span className="text-[11px] text-slate-500 block">মাসিক ফি যোগফল:</span>
                        <span className="text-sm font-bold text-emerald-800 font-mono">
                          ৳ {formatBanglaCurrency(struct.total_monthly_amount || 0)} / মাস
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-slate-500 block">এককালীন ফি:</span>
                        <span className="text-sm font-bold text-slate-800 font-mono">
                          ৳ {formatBanglaCurrency(struct.total_onetime_amount || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Standard Fee Types */}
      {activeTab === "types" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              মানসম্মত ফি টাইপ ও ক্যাটাগরি তালিকা ({feeTypes.length} টি)
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">ফি'র নাম</th>
                  <th className="py-3 px-4">কোড</th>
                  <th className="py-3 px-4">ক্যাটাগরি</th>
                  <th className="py-3 px-4">চার্জ ফ্রিকোয়েন্সি</th>
                  <th className="py-3 px-4 text-right">ডিফল্ট পরিমাণ (৳)</th>
                  <th className="py-3 px-4 text-center">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {feeTypes.map((ft) => (
                  <tr key={ft.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">{ft.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{ft.code}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {ft.category === "ACADEMIC" ? "একাডেমিক" : ft.category === "BOARDING" ? "বোর্ডিং/আবাসিক" : "প্রশাসনিক"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {ft.frequency === "MONTHLY" ? "মাসিক (Recurring)" : ft.frequency === "ONETIME" ? "এককালীন" : "মেয়াদী"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800">
                      ৳ {formatBanglaCurrency(ft.default_amount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        সক্রিয়
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Structure Modal */}
      {isStructModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {editingStruct ? "ফি কাঠামো সম্পাদনা করুন" : "নতুন ফি কাঠামো তৈরি"}
              </h3>
              <button
                type="button"
                onClick={() => setIsStructModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStruct} className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">শিক্ষাবর্ষ (Academic Session)</label>
                  <select
                    value={structForm.session_id}
                    onChange={(e) => setStructForm({ ...structForm, session_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                  >
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.academic_year})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">জামাত / শ্রেণি (Class)</label>
                  <select
                    value={structForm.class_id}
                    onChange={(e) => setStructForm({ ...structForm, class_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                  >
                    <option value="ALL">সকল জামাত (Universal Structure)</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="font-semibold text-slate-700">কাঠামোর শিরোনাম / নাম</label>
                  <input
                    type="text"
                    value={structForm.name}
                    onChange={(e) => setStructForm({ ...structForm, name: e.target.value })}
                    placeholder="যেমন: হেদায়াতুন নাহু - সাধারণ ফি কাঠামো"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Items in structure */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-slate-900 text-sm">ফি এর খাতসমূহ ও টাকার পরিমাণ:</h4>
                <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50/50">
                  {structForm.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="flex-1 font-semibold text-slate-800 text-xs">
                        {item.fee_type_name}
                      </span>
                      <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        {item.frequency === "MONTHLY" ? "মাসিক" : "এককালীন"}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500 font-mono">৳</span>
                        <input
                          type="number"
                          min="0"
                          value={item.amount}
                          onChange={(e) => {
                            const newItems = [...structForm.items];
                            newItems[idx].amount = Number(e.target.value);
                            setStructForm({ ...structForm, items: newItems });
                          }}
                          className="w-24 px-2 py-1 border border-slate-300 rounded-md font-mono font-bold text-right text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsStructModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-xs cursor-pointer transition disabled:opacity-50"
                >
                  {loading ? "সংরক্ষণ হচ্ছে..." : "ফি কাঠামো সংরক্ষণ করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Type Modal */}
      {isTypeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">নতুন ফি টাইপ যোগ করুন</h3>
              <button
                type="button"
                onClick={() => setIsTypeModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveType} className="space-y-4 text-xs sm:text-sm">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">ফি'র নাম <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={typeForm.name}
                  onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                  placeholder="যেমন: কম্পিউটার ল্যাব ফি"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">চার্জের ধরন</label>
                  <select
                    value={typeForm.frequency}
                    onChange={(e) => setTypeForm({ ...typeForm, frequency: e.target.value as FeeFrequency })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                  >
                    <option value="MONTHLY">মাসিক (Monthly)</option>
                    <option value="ONETIME">এককালীন (One-Time)</option>
                    <option value="TERM">মেয়াদী / সেমিস্টার</option>
                    <option value="YEARLY">বাৎসরিক (Yearly)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">ডিফল্ট পরিমাণ (৳)</label>
                  <input
                    type="number"
                    min="0"
                    value={typeForm.default_amount}
                    onChange={(e) => setTypeForm({ ...typeForm, default_amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTypeModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                >
                  {loading ? "সেভ হচ্ছে..." : "ফি টাইপ সেভ করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
