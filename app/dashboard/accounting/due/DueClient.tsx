"use client";

import { useState } from "react";
import { AcademicSession } from "@/lib/sessions";
import { formatBanglaCurrency, toBanglaNumber } from "@/lib/numberToBangla";
import {
  AlertTriangle,
  Clock,
  Search,
  Filter,
  CreditCard,
  User,
  Phone,
  Printer,
  Download,
  Calendar,
  Layers,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface DueClientProps {
  initialData: any;
  sessions: AcademicSession[];
  classes: any[];
}

export default function DueClient({
  initialData,
  sessions,
  classes,
}: DueClientProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string>("ALL");
  const [selectedClassId, setSelectedClassId] = useState<string>("ALL");
  const [agingFilter, setAgingFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const studentDueList = initialData?.studentDueList || [];
  const aging = initialData?.aging || {
    aging_0_30: 0,
    aging_31_60: 0,
    aging_61_90: 0,
    aging_90_plus: 0,
  };

  // Client-side filtering for fast interactive search & filter
  const filteredList = studentDueList.filter((item: any) => {
    // Session filter
    if (selectedSessionId !== "ALL") {
      const matchSession = item.feeItems?.some((f: any) => f.session_id === selectedSessionId);
      if (!matchSession) return false;
    }

    // Class filter
    if (selectedClassId !== "ALL") {
      const studentClass = item.student?.classes?.id || item.student?.class_name;
      if (studentClass !== selectedClassId && item.student?.class_name !== selectedClassId) {
        return false;
      }
    }

    // Aging filter
    if (agingFilter !== "ALL") {
      if (agingFilter === "0_30" && item.maxOverdueDays > 30) return false;
      if (agingFilter === "31_60" && (item.maxOverdueDays <= 30 || item.maxOverdueDays > 60)) return false;
      if (agingFilter === "61_90" && (item.maxOverdueDays <= 60 || item.maxOverdueDays > 90)) return false;
      if (agingFilter === "90_PLUS" && item.maxOverdueDays <= 90) return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = `${item.student?.first_name || ""} ${item.student?.last_name || ""}`.toLowerCase();
      const roll = String(item.student?.roll_number || "");
      const phone = String(item.student?.parent_phone || item.student?.phone || "");
      if (!name.includes(q) && !roll.includes(q) && !phone.includes(q)) {
        return false;
      }
    }

    return true;
  });

  const totalFilteredDue = filteredList.reduce((sum: number, i: any) => sum + i.totalDue, 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Due Aging Analysis KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* 0-30 Days */}
        <button
          type="button"
          onClick={() => setAgingFilter(agingFilter === "0_30" ? "ALL" : "0_30")}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer shadow-xs ${
            agingFilter === "0_30"
              ? "bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-400"
              : "bg-white border-slate-200 hover:border-amber-300"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${agingFilter === "0_30" ? "text-amber-100" : "text-slate-400"}`}>
              ০–৩০ দিন (চলতি)
            </span>
            <Clock className={`w-4 h-4 ${agingFilter === "0_30" ? "text-white" : "text-amber-500"}`} />
          </div>
          <div className={`text-xl sm:text-2xl font-black font-mono ${agingFilter === "0_30" ? "text-white" : "text-slate-900"}`}>
            ৳ {formatBanglaCurrency(aging.aging_0_30)}
          </div>
          <span className={`text-[10px] font-medium block mt-1 ${agingFilter === "0_30" ? "text-amber-100" : "text-slate-500"}`}>
            চলতি মাসের বকেয়া
          </span>
        </button>

        {/* 31-60 Days */}
        <button
          type="button"
          onClick={() => setAgingFilter(agingFilter === "31_60" ? "ALL" : "31_60")}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer shadow-xs ${
            agingFilter === "31_60"
              ? "bg-orange-500 text-white border-orange-600 shadow-md ring-2 ring-orange-400"
              : "bg-white border-slate-200 hover:border-orange-300"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${agingFilter === "31_60" ? "text-orange-100" : "text-slate-400"}`}>
              ৩১–৬০ দিন
            </span>
            <AlertTriangle className={`w-4 h-4 ${agingFilter === "31_60" ? "text-white" : "text-orange-500"}`} />
          </div>
          <div className={`text-xl sm:text-2xl font-black font-mono ${agingFilter === "31_60" ? "text-white" : "text-slate-900"}`}>
            ৳ {formatBanglaCurrency(aging.aging_31_60)}
          </div>
          <span className={`text-[10px] font-medium block mt-1 ${agingFilter === "31_60" ? "text-orange-100" : "text-slate-500"}`}>
            ১–২ মাসের বকেয়া
          </span>
        </button>

        {/* 61-90 Days */}
        <button
          type="button"
          onClick={() => setAgingFilter(agingFilter === "61_90" ? "ALL" : "61_90")}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer shadow-xs ${
            agingFilter === "61_90"
              ? "bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-400"
              : "bg-white border-slate-200 hover:border-rose-300"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${agingFilter === "61_90" ? "text-rose-100" : "text-slate-400"}`}>
              ৬১–৯০ দিন
            </span>
            <AlertTriangle className={`w-4 h-4 ${agingFilter === "61_90" ? "text-white" : "text-rose-500"}`} />
          </div>
          <div className={`text-xl sm:text-2xl font-black font-mono ${agingFilter === "61_90" ? "text-white" : "text-slate-900"}`}>
            ৳ {formatBanglaCurrency(aging.aging_61_90)}
          </div>
          <span className={`text-[10px] font-medium block mt-1 ${agingFilter === "61_90" ? "text-rose-100" : "text-slate-500"}`}>
            ২–৩ মাসের বকেয়া
          </span>
        </button>

        {/* 90+ Days */}
        <button
          type="button"
          onClick={() => setAgingFilter(agingFilter === "90_PLUS" ? "ALL" : "90_PLUS")}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer shadow-xs ${
            agingFilter === "90_PLUS"
              ? "bg-red-700 text-white border-red-800 shadow-md ring-2 ring-red-400"
              : "bg-white border-slate-200 hover:border-red-300"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${agingFilter === "90_PLUS" ? "text-red-100" : "text-slate-400"}`}>
              ৯০+ দিন (দীর্ঘমেয়াদী)
            </span>
            <AlertTriangle className={`w-4 h-4 ${agingFilter === "90_PLUS" ? "text-white" : "text-red-600"}`} />
          </div>
          <div className={`text-xl sm:text-2xl font-black font-mono ${agingFilter === "90_PLUS" ? "text-white" : "text-slate-900"}`}>
            ৳ {formatBanglaCurrency(aging.aging_90_plus)}
          </div>
          <span className={`text-[10px] font-medium block mt-1 ${agingFilter === "90_PLUS" ? "text-red-100" : "text-slate-500"}`}>
            জরুরি তাগিদ আবশ্যক
          </span>
        </button>
      </div>

      {/* Filter and Action Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="শিক্ষার্থীর নাম, রোল বা মোবাইল..."
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Session filter */}
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="ALL">সকল শিক্ষাবর্ষ</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Class filter */}
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="ALL">সকল জামাত</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>প্রিন্ট বকেয়া তালিকা</span>
          </button>
        </div>
      </div>

      {/* Main Dues Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden print:border-none print:shadow-none">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              বকেয়া ফি তালিকা ({filteredList.length} জন শিক্ষার্থী)
            </h3>
            <p className="text-xs text-slate-500">
              নির্বাচিত ফিল্টারের মোট বকেয়া: <strong className="text-red-700 font-mono text-sm">৳ {formatBanglaCurrency(totalFilteredDue)}</strong>
            </p>
          </div>

          {agingFilter !== "ALL" && (
            <button
              type="button"
              onClick={() => setAgingFilter("ALL")}
              className="text-xs font-bold text-slate-600 bg-slate-200 px-3 py-1 rounded-lg hover:bg-slate-300 transition cursor-pointer"
            >
              ফিল্টার রিসেট (সকল বকেয়া দেখুন)
            </button>
          )}
        </div>

        {filteredList.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h4 className="text-base font-bold text-slate-700">কোন বকেয়া পাওয়া যায়নি!</h4>
            <p className="text-xs text-slate-500">
              সকল শিক্ষার্থীর ফি পরিশোধিত রয়েছে অথবা নির্বাচিত ফিল্টারে কোনো রেকর্ড নেই।
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">শিক্ষার্থীর নাম ও তথ্য</th>
                  <th className="py-3 px-4">জামাত / শ্রেণি</th>
                  <th className="py-3 px-4">অভিভাবকের মোবাইল</th>
                  <th className="py-3 px-4">বকেয়া ইনভয়েসসমূহ</th>
                  <th className="py-3 px-4 text-center">সর্বোচ্চ ওভারডিউ</th>
                  <th className="py-3 px-4 text-right">মোট বকেয়া (৳)</th>
                  <th className="py-3 px-4 text-right print:hidden">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((item: any, idx: number) => {
                  const student = item.student;
                  const isSevere = item.maxOverdueDays > 60;
                  const isModerate = item.maxOverdueDays > 30;

                  return (
                    <tr key={student.id || idx} className="hover:bg-slate-50/60 transition">
                      {/* Student Info */}
                      <td className="py-3 px-4">
                        <Link
                          href={`/dashboard/students/${student.id}`}
                          className="font-bold text-slate-900 hover:text-emerald-700 transition block"
                        >
                          {student.first_name} {student.last_name}
                        </Link>
                        <span className="text-[11px] text-slate-500">
                          রোল: <strong className="font-mono">{toBanglaNumber(student.roll_number || "-")}</strong>
                        </span>
                      </td>

                      {/* Class */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {student.class_name || student.classes?.name || "সাধারণ"}
                        </span>
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4 text-slate-600 font-mono text-xs">
                        {student.parent_phone || student.phone ? (
                          <a
                            href={`tel:${student.parent_phone || student.phone}`}
                            className="hover:underline flex items-center gap-1 text-slate-700 font-semibold"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{student.parent_phone || student.phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Invoices */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {item.feeItems.slice(0, 2).map((fee: any, fIdx: number) => (
                            <div key={fIdx} className="text-xs text-slate-700 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              <span className="font-medium">{fee.fee_type_name}</span>
                              <span className="text-slate-400">({fee.billing_period}):</span>
                              <strong className="text-slate-900 font-mono">৳{formatBanglaCurrency(fee.due_amount)}</strong>
                            </div>
                          ))}
                          {item.feeItems.length > 2 && (
                            <span className="text-[11px] text-slate-400 font-medium">
                              + আরও {item.feeItems.length - 2} টি বকেয়া খাত
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Overdue Days Badge */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isSevere
                              ? "bg-red-100 text-red-800"
                              : isModerate
                              ? "bg-orange-100 text-orange-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>{toBanglaNumber(item.maxOverdueDays)} দিন</span>
                        </span>
                      </td>

                      {/* Total Due */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono font-black text-sm text-red-700 bg-red-50 px-2.5 py-1 rounded-lg border border-red-200 inline-block">
                          ৳ {formatBanglaCurrency(item.totalDue)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right print:hidden">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/accounting/fees/new?student_id=${student.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-2xs"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>ফি আদায়</span>
                          </Link>
                          <Link
                            href={`/dashboard/students/${student.id}`}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                            title="প্রোফাইল দেখুন"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
                <tr>
                  <td colSpan={5} className="py-3 px-4 text-slate-900">
                    সর্বমোট বকেয়া ফি:
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-base text-red-900">
                    ৳ {formatBanglaCurrency(totalFilteredDue)}
                  </td>
                  <td className="print:hidden"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
