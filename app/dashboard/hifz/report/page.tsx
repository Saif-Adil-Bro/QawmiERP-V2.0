"use client";

import { useState, useEffect } from "react";
import { getMonthlyHifzSummary } from "@/app/actions/hifz";
import { getClasses } from "@/app/actions/students";
import Link from "next/link";
import { ArrowLeft, BookOpen, Printer, Calendar, Award, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

export default function HifzReportPage() {
  const [classId, setClassId] = useState<string>("All");
  const [month, setMonth] = useState<string>(() => (new Date().getMonth() + 1).toString().padStart(2, "0"));
  const [year, setYear] = useState<string>(() => new Date().getFullYear().toString());
  const [classes, setClasses] = useState<any[]>([]);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClasses() {
      try {
        const cls = await getClasses();
        setClasses(cls || []);
      } catch (e) {
        console.error("Failed to load classes:", e);
      }
    }
    fetchClasses();
  }, []);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      try {
        const res = await getMonthlyHifzSummary(classId, month, year);
        setSummaryData(res);
      } catch (err) {
        console.error("Failed to load monthly hifz summary:", err);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [classId, month, year]);

  const handlePrint = () => {
    window.print();
  };

  const monthNames: Record<string, string> = {
    "01": "জানুয়ারি",
    "02": "ফেব্রুয়ারি",
    "03": "মার্চ",
    "04": "এপ্রিল",
    "05": "মে",
    "06": "জুন",
    "07": "জুলাই",
    "08": "আগস্ট",
    "09": "সেপ্টেম্বর",
    "10": "অক্টোবর",
    "11": "নভেম্বর",
    "12": "ডিসেম্বর",
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header (Hidden when printing) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div className="flex items-center space-x-3">
          <Link
            href="/dashboard/hifz"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">কওমি হিফজ প্রোগ্রেস ও মূল্যায়ন রিপোর্ট</h1>
            <p className="text-slate-500 text-xs mt-0.5">মাসিক সবক, সবকী, আমুখতা ও বেফাক/তাহফিজ স্ট্যান্ডার্ড মান নিয়ন্ত্রণ</p>
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-xs transition"
        >
          <Printer className="w-4 h-4" />
          <span>প্রিন্ট / পিডিএফ ডাউনলোড</span>
        </button>
      </div>

      {/* Filter Bar (Hidden when printing) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-4 print:hidden">
        <div className="flex items-center space-x-2">
          <label className="text-xs font-bold text-slate-600">জামাত:</label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
          >
            <option value="All">সকল জামাত</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-xs font-bold text-slate-600">মাস:</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
          >
            {Object.entries(monthNames).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-xs font-bold text-slate-600">বছর:</label>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
          >
            <option value="2025">২০২৫</option>
            <option value="2026">২০২৬</option>
            <option value="2027">২০২৭</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500">
          রিপোর্ট ডাটা প্রসেস হচ্ছে...
        </div>
      ) : !summaryData || !summaryData.reports || summaryData.reports.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500">
          <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="font-bold text-slate-700">এই সময়ের জন্য কোনো হিফজ রেকর্ড পাওয়া যায়নি।</p>
        </div>
      ) : (
        <div className="space-y-8">
          {summaryData.reports.map((rep: any) => (
            <div
              key={rep.student.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 print:p-4 print:border-slate-300 print:shadow-none space-y-6 page-break-inside-avoid"
            >
              {/* Student Header Info */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 gap-2">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-800">
                    {rep.student.name}{" "}
                    <span className="text-xs font-semibold text-slate-500 font-mono">
                      (রোল: {rep.student.roll_number})
                    </span>
                  </h2>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">
                    জামাত: {rep.student.class_name} | স্তর: <span className="font-bold text-emerald-700">{rep.student.hifz_stage}</span>
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-emerald-600" />
                    <span>মান: {rep.qawmi_grade}</span>
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    {monthNames[rep.month]} {rep.year}
                  </span>
                </div>
              </div>

              {/* Monthly Stats Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="text-xs font-semibold text-slate-500">মোট সক্রিয় সবক দিন</div>
                  <div className="text-lg font-bold text-slate-800">{rep.active_sabak_days} দিন</div>
                  {rep.paused_sabak_days > 0 && (
                    <div className="text-[10px] text-amber-600 font-medium">কাঁচা থাকার কারণে বন্ধ: {rep.paused_sabak_days} দিন</div>
                  )}
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="text-xs font-semibold text-slate-500">হিফজকৃত পৃষ্ঠা (এই মাসে)</div>
                  <div className="text-lg font-bold text-emerald-700">{rep.total_pages_memorized} পৃষ্ঠা</div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="text-xs font-semibold text-slate-500">আমুখতা শোনানো হয়েছে</div>
                  <div className="text-lg font-bold text-indigo-700">{rep.total_amukhta_paras} পারা</div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="text-xs font-semibold text-slate-500">গড় ভুল / লোকমা</div>
                  <div className={`text-lg font-bold ${rep.avg_mistakes > 3 ? "text-rose-600" : "text-slate-800"}`}>
                    {rep.avg_mistakes} টি/দিন
                  </div>
                </div>
              </div>

              {/* 30-Para Completion Grid */}
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>৩০ পারা হিফজ অগ্রগতির ম্যাপ ({rep.completed_paras_count} পারা সম্পূর্ণ - {rep.completion_percentage}%)</span>
                  </div>
                  
                  <div className="flex items-center space-x-2 text-[11px] font-semibold">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                      🟢 সম্পন্ন: {rep.completed_paras_count}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                      🟡 চলমান: {rep.running_paras_count || 0}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                      ⚪️ বাকি: {rep.remaining_paras_count}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  {rep.para_grid.map((p: any) => (
                    <div
                      key={p.para}
                      className={`p-2 rounded-lg text-center text-xs font-bold border transition ${
                        p.status === "COMPLETED"
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                          : p.status === "RUNNING"
                          ? "bg-amber-100 text-amber-900 border-amber-300 shadow-2xs"
                          : "bg-white text-slate-400 border-slate-200"
                      }`}
                      title={p.progress_text}
                    >
                      <div className="text-[10px] opacity-80">পারা {p.para}</div>
                      <div className="text-[11px] truncate mt-0.5">
                        {p.status === "COMPLETED"
                          ? "সম্পূর্ণ"
                          : p.status === "RUNNING"
                          ? `${p.current_page}/${p.total_pages}পৃ.`
                          : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
