"use client";

import React, { useState, useTransition } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  User,
  AlertTriangle,
  Search,
  Check,
  X,
  FileText,
  AlertCircle,
  HelpCircle,
  Calendar,
} from "lucide-react";
import { ApprovalRequest, ApprovalRequestType } from "@/lib/permissions";
import { reviewApprovalRequest } from "@/app/actions/permissions";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface Props {
  requests: ApprovalRequest[];
  onRefresh?: () => void;
}

const TYPE_LABELS: Record<ApprovalRequestType, { title: string; bg: string; text: string }> = {
  FEE_DISCOUNT: { title: "ফি ছাড় / বিশেষ ছাড়", bg: "bg-amber-100", text: "text-amber-800" },
  FEE_WAIVER: { title: "ফি সম্পূর্ণ মওকুফ", bg: "bg-amber-100", text: "text-amber-800" },
  SALARY_CHANGE: { title: "বেতন / বোনাস পরিবর্তন", bg: "bg-emerald-100", text: "text-emerald-800" },
  RESULT_PUBLISH: { title: "পরীক্ষার চূড়ান্ত ফলাফল প্রকাশ", bg: "bg-blue-100", text: "text-blue-800" },
  CERTIFICATE_ISSUE: { title: "সনদপত্র প্রদান", bg: "bg-purple-100", text: "text-purple-800" },
  CERTIFICATE_REVOKE: { title: "সনদপত্র বাতিলকরণ", bg: "bg-rose-100", text: "text-rose-800" },
  STUDENT_ARCHIVE: { title: "শিক্ষার্থী স্থানান্তর / নিষ্ক্রিয়", bg: "bg-rose-100", text: "text-rose-800" },
  STAFF_TERMINATION: { title: "স্টাফ অব্যাহতি / ছাড়পত্র", bg: "bg-rose-100", text: "text-rose-800" },
};

export default function ApprovalsCenterView({ requests = [], onRefresh }: Props) {
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  const filteredRequests = requests.filter((r) => {
    if (filterStatus === "ALL") return true;
    return r.status === filterStatus;
  });

  const handleReview = (decision: "APPROVED" | "REJECTED") => {
    if (!selectedRequest) return;

    startTransition(async () => {
      const res = await reviewApprovalRequest(selectedRequest.id, decision, reviewNotes);
      if (res.error) {
        showToast("error", res.error);
      } else {
        showToast("success", res.message || "সিদ্ধান্ত সফলভাবে সংরক্ষিত হয়েছে!");
        setSelectedRequest(null);
        setReviewNotes("");
        if (onRefresh) onRefresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 p-4 rounded-xl shadow-lg border flex items-center gap-3 transition-all duration-300 ${
            notification.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="text-sm font-medium">{notification.text}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="p-1 hover:bg-black/5 rounded-md text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">অনুমোদন কেন্দ্র (Two-Person Approvals)</h2>
              <p className="text-xs text-slate-500">
                ফি ছাড়, ফলাফল প্রকাশ, সনদ প্রদান ও আর্থিক বিশেষ সিদ্ধান্তের দ্বি-স্তরীয় যাচাই
              </p>
            </div>
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterStatus === s
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {s === "PENDING"
                ? "অপেক্ষমান"
                : s === "APPROVED"
                ? "অনুমোদিত"
                : s === "REJECTED"
                ? "প্রত্যাখ্যাত"
                : "সকল"}
            </button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {filteredRequests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-700">কোন অনুমোদনের আবেদন নেই</h4>
            <p className="text-xs text-slate-500 mt-1">
              বর্তমানে এই ফিল্টারে কোন অপেক্ষমান বা সংরক্ষিত আবেদন পাওয়া যায়নি।
            </p>
          </div>
        ) : (
          filteredRequests.map((req) => {
            const typeDef = TYPE_LABELS[req.type] || {
              title: req.type,
              bg: "bg-slate-100",
              text: "text-slate-800",
            };

            return (
              <div
                key={req.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:border-slate-300 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-lg ${typeDef.bg} ${typeDef.text}`}
                    >
                      {typeDef.title}
                    </span>

                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        req.status === "PENDING"
                          ? "bg-amber-100 text-amber-800"
                          : req.status === "APPROVED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {req.status === "PENDING"
                        ? "অপেক্ষমান"
                        : req.status === "APPROVED"
                        ? "অনুমোদিত"
                        : "বাতিল"}
                    </span>

                    <span className="text-xs text-slate-400 font-mono">#{req.id}</span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">{req.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{req.description}</p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      আবেদনকারী: <strong className="text-slate-700">{req.requested_by.name}</strong> ({req.requested_by.role})
                    </span>

                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(req.requested_at).toLocaleString("bn-BD")}
                    </span>

                    {req.reviewed_by && (
                      <span className="flex items-center gap-1 text-emerald-700 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        অনুমোদনকারী: {req.reviewed_by.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {req.status === "PENDING" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRequest(req);
                        setReviewNotes("");
                      }}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
                    >
                      পর্যালোচনা ও সিদ্ধান্ত
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedRequest(req)}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                      বিবরণ দেখুন
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Review Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-6">
            <div className="p-5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">অনুমোদন আবেদন পর্যালোচনা</h3>
                <p className="text-xs text-slate-500">#{selectedRequest.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase">বিষয়</span>
                <h4 className="text-sm font-bold text-slate-900">{selectedRequest.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {selectedRequest.description}
                </p>
              </div>

              {/* Payload details if any */}
              {selectedRequest.payload && Object.keys(selectedRequest.payload).length > 0 && (
                <div className="border border-slate-200 rounded-xl p-3 bg-white text-xs space-y-1">
                  <span className="font-bold text-slate-700 block mb-1">প্রদত্ত তথ্য:</span>
                  {Object.entries(selectedRequest.payload).map(([k, v]) => (
                    <div key={k} className="flex justify-between py-1 border-b border-slate-100 last:border-none">
                      <span className="text-slate-500">{k}:</span>
                      <span className="font-semibold text-slate-800">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}

              {selectedRequest.status === "PENDING" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    পর্যালোচনা মন্তব্য (ঐচ্ছিক)
                  </label>
                  <textarea
                    rows={3}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="অনুমোদন বা প্রত্যাখ্যানের কারণ বা দিকনির্দেশনা লিখুন..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              )}

              {selectedRequest.status !== "PENDING" && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                  <span className="font-bold text-slate-700">পর্যালোচনা নোট:</span>
                  <p className="text-slate-600 italic">
                    {selectedRequest.review_notes || "কোন মন্তব্য উল্লেখ করা হয়নি"}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                বন্ধ করুন
              </button>

              {selectedRequest.status === "PENDING" && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleReview("REJECTED")}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                  >
                    প্রত্যাখ্যান করুন
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleReview("APPROVED")}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isPending ? "প্রক্রিয়া চলছে..." : "অনুমোদন করুন"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
