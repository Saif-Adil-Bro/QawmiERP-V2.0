"use client";

import React, { useState, useTransition, useMemo } from "react";
import {
  ShieldCheck,
  Search,
  Filter,
  Calendar,
  Clock,
  ExternalLink,
  History,
  AlertTriangle,
  Award,
  IdCard,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  X,
  FileText,
  UserCheck,
  ArrowUpDown,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { toBanglaNumber } from "@/lib/numberToBangla";
import {
  VerificationAuditSummary,
  DocumentVerificationStats,
  VerificationHistoryEntry,
  getVerificationAuditData,
} from "@/app/actions/verification-logs";

interface VerificationAuditHubClientProps {
  initialAuditData: VerificationAuditSummary;
}

export default function VerificationAuditHubClient({
  initialAuditData,
}: VerificationAuditHubClientProps) {
  const [data, setData] = useState<VerificationAuditSummary>(initialAuditData);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [docTypeFilter, setDocTypeFilter] = useState<"ALL" | "ID_CARD" | "CERTIFICATE">("ALL");
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"MOST_VERIFIED" | "RECENT" | "STUDENT_NAME">("MOST_VERIFIED");

  // Selected document for full history modal
  const [selectedDocHistory, setSelectedDocHistory] = useState<DocumentVerificationStats | null>(null);

  // Refresh handler
  const handleRefresh = () => {
    startTransition(async () => {
      const fresh = await getVerificationAuditData({
        doc_type: docTypeFilter,
        search: searchQuery,
        only_verified: onlyVerified,
      });
      setData(fresh);
    });
  };

  // Filtered and sorted documents list
  const filteredDocuments = useMemo(() => {
    let list = [...data.documents];

    // Filter by type
    if (docTypeFilter !== "ALL") {
      list = list.filter((d) => d.doc_type === docTypeFilter);
    }

    // Filter by only verified
    if (onlyVerified) {
      list = list.filter((d) => d.total_verifications > 0);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (d) =>
          d.doc_number.toLowerCase().includes(q) ||
          d.student_name.toLowerCase().includes(q) ||
          (d.student_id_code && d.student_id_code.toLowerCase().includes(q)) ||
          (d.roll_number && d.roll_number.toLowerCase().includes(q)) ||
          (d.class_name && d.class_name.toLowerCase().includes(q))
      );
    }

    // Sort order
    list.sort((a, b) => {
      if (sortOrder === "MOST_VERIFIED") {
        if (b.total_verifications !== a.total_verifications) {
          return b.total_verifications - a.total_verifications;
        }
        if (b.last_verified_at && a.last_verified_at) {
          return new Date(b.last_verified_at).getTime() - new Date(a.last_verified_at).getTime();
        }
        return b.last_verified_at ? 1 : -1;
      }
      if (sortOrder === "RECENT") {
        if (!a.last_verified_at) return 1;
        if (!b.last_verified_at) return -1;
        return new Date(b.last_verified_at).getTime() - new Date(a.last_verified_at).getTime();
      }
      return a.student_name.localeCompare(b.student_name, "bn");
    });

    return list;
  }, [data.documents, docTypeFilter, onlyVerified, searchQuery, sortOrder]);

  return (
    <div className="space-y-6">
      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              সর্বমোট যাচাইকরণ স্ক্যান
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
            {toBanglaNumber(data.totalVerifications)}
          </span>
          <p className="text-[11px] text-slate-400">অনলাইন কিউআর বা লিংক যাচাইয়ের মোট সংখ্যা</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-emerald-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              যাচাইকৃত স্বতন্ত্র নথি
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono">
            {toBanglaNumber(data.totalVerifiedDocuments)}
          </span>
          <p className="text-[11px] text-emerald-600 font-medium">কমপক্ষে ১ বার যাচাইকৃত ডকুমেন্ট</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-blue-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
              যাচাইকৃত আইডি কার্ড
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <IdCard className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl sm:text-3xl font-black text-blue-700 font-mono">
            {toBanglaNumber(data.totalCardsVerified)}
          </span>
          <p className="text-[11px] text-slate-400">শিক্ষার্থী পরিচয়পত্র যাচাই সংখ্যা</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-purple-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">
              যাচাইকৃত সনদপত্র
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl sm:text-3xl font-black text-purple-700 font-mono">
            {toBanglaNumber(data.totalCertsVerified)}
          </span>
          <p className="text-[11px] text-slate-400">অফিশিয়াল সার্টিফিকেট ও প্রত্যয়ন</p>
        </div>
      </div>

      {/* Security Alert: If any document is verified frequently (potential security concern) */}
      {data.mostVerifiedDoc && data.mostVerifiedDoc.total_verifications >= 5 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-200 text-amber-900 rounded-xl shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <p className="font-bold text-sm text-amber-950">
                নিরাপত্তা নোটিশ: উচ্চমাত্রার যাচাই সক্রিয়তা পরিলক্ষিত
              </p>
              <p className="text-amber-800">
                <strong>{data.mostVerifiedDoc.student_name}</strong> এর {data.mostVerifiedDoc.doc_title} (নং:{" "}
                <span className="font-mono font-bold">{data.mostVerifiedDoc.doc_number}</span>) মোট{" "}
                <span className="font-bold text-amber-950">
                  {toBanglaNumber(data.mostVerifiedDoc.total_verifications)} বার
                </span>{" "}
                যাচাই করা হয়েছে। কোনো অসংগতি বা জালিয়াতির চেষ্টা থাকলে তা পর্যবেক্ষণে রাখুন।
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDocHistory(data.mostVerifiedDoc)}
            className="px-3.5 py-1.5 bg-amber-800 hover:bg-amber-900 text-white font-bold rounded-xl transition cursor-pointer shrink-0"
          >
            সময়সূচি ও লগ দেখুন
          </button>
        </div>
      )}

      {/* Filter and Control Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="সনদ বা কার্ড নম্বর, শিক্ষার্থীর নাম, আইডি বা রোল দিয়ে খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Doc Type Selector */}
            <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setDocTypeFilter("ALL")}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                  docTypeFilter === "ALL"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                সকল নথি
              </button>
              <button
                type="button"
                onClick={() => setDocTypeFilter("ID_CARD")}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                  docTypeFilter === "ID_CARD"
                    ? "bg-white text-blue-700 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                আইডি কার্ড
              </button>
              <button
                type="button"
                onClick={() => setDocTypeFilter("CERTIFICATE")}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                  docTypeFilter === "CERTIFICATE"
                    ? "bg-white text-purple-700 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                সনদপত্র
              </button>
            </div>

            {/* Only Verified Checkbox Button */}
            <button
              type="button"
              onClick={() => setOnlyVerified(!onlyVerified)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                onlyVerified
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>শুধু যাচাইকৃত নথি</span>
            </button>

            {/* Sort Order Selector */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 cursor-pointer focus:outline-none"
            >
              <option value="MOST_VERIFIED">সর্বোচ্চ যাচাইকৃত আগে</option>
              <option value="RECENT">সর্বশেষ যাচাইকৃত আগে</option>
              <option value="STUDENT_NAME">শিক্ষার্থীর নাম অনুযায়ী</option>
            </select>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isPending}
              title="তথ্য রিফ্রেশ করুন"
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Verification Log Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-600" />
              <span>যাচাইকরণ লগ ও নিরাপত্তা নিরীক্ষা তালিকা</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              মোট প্রদর্শিত নথি: <strong>{toBanglaNumber(filteredDocuments.length)}</strong> টি
            </p>
          </div>
        </div>

        {filteredDocuments.length === 0 ? (
          <div className="py-16 text-center space-y-3 px-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-700">কোনো যাচাইকরণ রেকর্ড পাওয়া যায়নি</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              ফিল্টার পরিবর্তন করুন বা কোনো শিক্ষার্থী আইডি কার্ড বা সনদপত্রের কিউআর কোড স্ক্যান করে যাচাই করুন।
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200/70">
                <tr>
                  <th className="py-3 px-4">নথির বিবরণ ও নম্বর</th>
                  <th className="py-3 px-4">শিক্ষার্থীর তথ্য</th>
                  <th className="py-3 px-4 text-center">যাচাইয়ের সংখ্যা</th>
                  <th className="py-3 px-4">সর্বশেষ যাচাইকরণের সময়</th>
                  <th className="py-3 px-4">বর্তমান স্ট্যাটাস</th>
                  <th className="py-3 px-4 text-right">লগ ও লিংক</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredDocuments.map((doc) => {
                  const isIdCard = doc.doc_type === "ID_CARD";
                  const hasHistory = doc.total_verifications > 0;

                  return (
                    <tr
                      key={`${doc.doc_type}_${doc.id}`}
                      className="hover:bg-slate-50/70 transition"
                    >
                      {/* Document Details */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isIdCard
                                ? "bg-blue-50 text-blue-600 border border-blue-200/80"
                                : "bg-purple-50 text-purple-600 border border-purple-200/80"
                            }`}
                          >
                            {isIdCard ? <IdCard className="w-4 h-4" /> : <Award className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-[10px] font-black px-1.5 py-0.2 rounded font-mono ${
                                  isIdCard
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-purple-100 text-purple-800"
                                }`}
                              >
                                {isIdCard ? "আইডি কার্ড" : "সনদপত্র"}
                              </span>
                              <span className="font-mono font-bold text-slate-900 text-xs">
                                {doc.doc_number}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">{doc.doc_title}</p>
                          </div>
                        </div>
                      </td>

                      {/* Student Info */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-900 text-xs sm:text-sm">
                            {doc.student_name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {doc.class_name ? `জামাত: ${doc.class_name}` : ""}
                            {doc.roll_number ? ` • রোল: ${doc.roll_number}` : ""}
                          </p>
                        </div>
                      </td>

                      {/* Total Verifications Count */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`font-mono font-black text-xs px-2.5 py-1 rounded-full border ${
                              doc.total_verifications >= 5
                                ? "bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-100"
                                : doc.total_verifications > 0
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                : "bg-slate-100 text-slate-500 border-slate-200"
                            }`}
                          >
                            {toBanglaNumber(doc.total_verifications)} বার
                          </span>
                          {doc.total_verifications >= 5 && (
                            <span className="text-[9px] font-bold text-rose-600 mt-0.5">উচ্চ হার</span>
                          )}
                        </div>
                      </td>

                      {/* Last Verified At */}
                      <td className="py-3.5 px-4">
                        {doc.last_verified_at ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-slate-900 font-semibold text-xs">
                              <Clock className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{new Date(doc.last_verified_at).toLocaleTimeString("bn-BD")}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-mono">
                              {new Date(doc.last_verified_at).toLocaleDateString("bn-BD")}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">এখনো যাচাই হয়নি</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                            doc.status === "ACTIVE" || doc.status === "ISSUED"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : doc.status === "REVOKED" || doc.status === "BLOCKED" || doc.status === "LOST"
                              ? "bg-rose-50 text-rose-800 border-rose-300"
                              : "bg-amber-50 text-amber-800 border-amber-300"
                          }`}
                        >
                          {doc.status === "ACTIVE"
                            ? "সচল"
                            : doc.status === "ISSUED"
                            ? "ইস্যুকৃত"
                            : doc.status === "REVOKED"
                            ? "বাতিল"
                            : doc.status === "BLOCKED"
                            ? "ব্লকড"
                            : doc.status === "REISSUED"
                            ? "রি-ইস্যুকৃত"
                            : doc.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {hasHistory && (
                            <button
                              type="button"
                              onClick={() => setSelectedDocHistory(doc)}
                              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                              title="সবগুলো যাচাইকরণের সময়সূচি দেখুন"
                            >
                              <History className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="hidden sm:inline">লগ দেখুন</span>
                            </button>
                          )}

                          <Link
                            href={doc.verify_url}
                            target="_blank"
                            title="পাবলিক যাচাইকরণ লিংক খুলুন"
                            className="p-1.5 text-slate-500 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 rounded-xl transition cursor-pointer"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Full Verification History Drilldown */}
      {selectedDocHistory && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    যাচাইকরণ সময়সূচি ও সিকিউরিটি লগ
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedDocHistory.doc_title} • নং: {selectedDocHistory.doc_number}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDocHistory(null)}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Snapshot Card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">শিক্ষার্থীর নাম:</span>
                <span className="font-bold text-slate-900">{selectedDocHistory.student_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">আইডি কোড / জামাত:</span>
                <span className="font-bold text-slate-900">
                  {selectedDocHistory.student_id_code || "—"} ({selectedDocHistory.class_name || "—"})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">সর্বমোট যাচাইকৃত সংখ্যা:</span>
                <span className="font-mono font-black text-emerald-700 text-sm">
                  {toBanglaNumber(selectedDocHistory.total_verifications)} বার
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">সর্বশেষ যাচাইকরণ:</span>
                <span className="font-semibold text-slate-800">
                  {selectedDocHistory.last_verified_at
                    ? new Date(selectedDocHistory.last_verified_at).toLocaleString("bn-BD")
                    : "—"}
                </span>
              </div>
            </div>

            {/* Verification Timestamps Timeline */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span>যাচাই করার সময়সূচি তালিকা (Timeline)</span>
              </h4>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {selectedDocHistory.verification_history.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
                    ইতিহাসে আলাদা টাইমস্ট্যাম্প নেই। মোট যাচাই সংখ্যা:{" "}
                    <strong>{toBanglaNumber(selectedDocHistory.total_verifications)}</strong> বার।
                  </div>
                ) : (
                  selectedDocHistory.verification_history.map((entry, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50/80 hover:bg-emerald-50/50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold font-mono text-[11px] flex items-center justify-center shrink-0">
                          {toBanglaNumber(selectedDocHistory.verification_history.length - idx)}
                        </span>
                        <div>
                          <p className="font-bold text-slate-900">
                            {new Date(entry.verified_at).toLocaleTimeString("bn-BD")}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {new Date(entry.verified_at).toLocaleDateString("bn-BD")}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          যাচাইকৃত (VERIFIED)
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Link
                href={selectedDocHistory.verify_url}
                target="_blank"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>সরাসরি যাচাই পেজ দেখুন</span>
              </Link>
              <button
                type="button"
                onClick={() => setSelectedDocHistory(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
