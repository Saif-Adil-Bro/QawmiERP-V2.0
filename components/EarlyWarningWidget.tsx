"use client";

import { useState } from "react";
import {
  AlertTriangle,
  TrendingDown,
  UserX,
  PhoneCall,
  Calendar,
  Sparkles,
  ChevronRight,
  ShieldAlert,
  MessageSquare,
  ArrowDownRight,
  CheckCircle2,
} from "lucide-react";
import { EarlyWarningSummary, AttendanceDropAlert, ExamScoreDropAlert } from "@/lib/early-warning";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface EarlyWarningWidgetProps {
  initialData: EarlyWarningSummary;
  isTeacherView?: boolean;
}

export default function EarlyWarningWidget({ initialData, isTeacherView = false }: EarlyWarningWidgetProps) {
  const [activeTab, setActiveTab] = useState<"ALL" | "ATTENDANCE" | "EXAM">("ALL");
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const { attendance_alerts = [], exam_drop_alerts = [] } = initialData || {};
  const totalAlerts = (attendance_alerts?.length || 0) + (exam_drop_alerts?.length || 0);

  if (totalAlerts === 0) {
    return (
      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-emerald-950 text-sm">আলহামদুলিল্লাহ! কোনো শিক্ষার্থী ঝুঁকিপূর্ণ তালিকায় নেই</h4>
            <p className="text-xs text-emerald-700 mt-0.5">সব শিক্ষার্থীর হাজিরা ও পরীক্ষার ফলাফল সন্তোষজনক গতিতে চলছে।</p>
          </div>
        </div>
      </div>
    );
  }

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2500);
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-rose-200/80 shadow-md shadow-rose-950/5 overflow-hidden">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-rose-100 text-[11px] font-bold mb-1">
              <Sparkles className="w-3 h-3" />
              <span>স্মার্ট অ্যানালিটিক্স ও সতর্কতা (Early Warning)</span>
            </div>
            <h3 className="font-bold text-base sm:text-lg tracking-tight">
              {isTeacherView ? "আপনার ক্লাসের দুর্বল ও ড্রপআউট ঝুঁকিপূর্ণ শিক্ষার্থী" : "দুর্বল শিক্ষার্থী লাল সতর্কবার্তা (Early Warning System)"}
            </h3>
            <p className="text-xs text-rose-100/90 mt-0.5">
              পরপর ৩+ দিন অনুপস্থিত কিংবা পূর্ববর্তী পরীক্ষার চেয়ে ১৫%-২০% নম্বর হ্রাস পাওয়া শিক্ষার্থীদের তালিকা
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <span className="px-3 py-1 bg-white text-rose-700 rounded-full text-xs font-black shadow-xs">
            {toBanglaNumber(totalAlerts)} জন শিক্ষার্থী নজরে রাখা প্রয়োজন
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-rose-50/50 border-b border-rose-100 px-4 py-2.5 flex items-center justify-between gap-2 overflow-x-auto text-xs">
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              activeTab === "ALL"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-white text-slate-600 hover:bg-rose-100/60 border border-rose-200/60"
            }`}
          >
            সব সতর্কবার্তা ({toBanglaNumber(totalAlerts)})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ATTENDANCE")}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === "ATTENDANCE"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-white text-slate-600 hover:bg-rose-100/60 border border-rose-200/60"
            }`}
          >
            <UserX className="w-3.5 h-3.5 text-rose-500" />
            <span>হাজিরা ড্রপ ({toBanglaNumber(attendance_alerts.length)})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("EXAM")}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === "EXAM"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-white text-slate-600 hover:bg-rose-100/60 border border-rose-200/60"
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
            <span>পরীক্ষার নম্বর হ্রাস ({toBanglaNumber(exam_drop_alerts.length)})</span>
          </button>
        </div>

        <span className="text-[11px] text-slate-500 hidden md:inline">
          দৈনিক স্বয়ংক্রিয়ভাবে বিশ্লেষিত
        </span>
      </div>

      {/* Alert Cards List */}
      <div className="p-4 space-y-3">
        {/* Attendance Alerts */}
        {(activeTab === "ALL" || activeTab === "ATTENDANCE") &&
          attendance_alerts.map((alert, idx) => (
            <div
              key={`att_${alert.student_id}_${idx}`}
              className="bg-white rounded-xl border border-rose-200 p-3.5 sm:p-4 hover:border-rose-400 transition shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-slate-900">{alert.student_name}</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
                      রোল: {toBanglaNumber(alert.roll_number || "---")}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold">
                      {alert.class_name}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black tracking-wide">
                      পরপর {toBanglaNumber(alert.consecutive_absent_days)} দিন অনুপস্থিত
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">
                    {alert.remarks || `সর্বশেষ অনুপস্থিতির তারিখ: ${alert.last_absent_dates.join(", ")}`}
                  </p>
                  {alert.last_present_date && (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      সর্বশেষ উপস্থিত ছিলেন: {alert.last_present_date}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 shrink-0">
                {alert.parent_phone ? (
                  <>
                    <a
                      href={`tel:${alert.parent_phone}`}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>অভিভাবককে কল ({alert.parent_phone})</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopyPhone(alert.parent_phone!)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition"
                      title="নম্বর কপি করুন"
                    >
                      {copiedPhone === alert.parent_phone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <MessageSquare className="w-4 h-4" />
                      )}
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-slate-400 italic">অভিভাবকের ফোন নম্বর নেই</span>
                )}
              </div>
            </div>
          ))}

        {/* Exam Drops */}
        {(activeTab === "ALL" || activeTab === "EXAM") &&
          exam_drop_alerts.map((alert, idx) => (
            <div
              key={`exam_${alert.student_id}_${idx}`}
              className="bg-white rounded-xl border border-amber-300 p-3.5 sm:p-4 hover:border-amber-500 transition shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-slate-900">{alert.student_name}</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
                      রোল: {toBanglaNumber(alert.roll_number || "---")}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold">
                      {alert.class_name}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black tracking-wide flex items-center gap-1">
                      <ArrowDownRight className="w-3 h-3" />
                      <span>{toBanglaNumber(alert.drop_percentage)}% নম্বর ড্রপ করেছে!</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-1">
                    <span>
                      {alert.previous_exam_title}: <strong className="text-emerald-700 font-bold">{toBanglaNumber(alert.previous_percentage)}%</strong>
                    </span>
                    <span>➔</span>
                    <span>
                      {alert.current_exam_title}: <strong className="text-rose-700 font-bold">{toBanglaNumber(alert.current_percentage)}%</strong>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    শ্রেণি শিক্ষক কর্তৃক বিশেষ পাঠদান ও তাকরার তদারকি প্রয়োজন।
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 shrink-0">
                {alert.parent_phone ? (
                  <a
                    href={`tel:${alert.parent_phone}`}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>অভিভাবককে কল ({alert.parent_phone})</span>
                  </a>
                ) : (
                  <span className="text-xs text-slate-400 italic">অভিভাবকের ফোন নম্বর নেই</span>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
