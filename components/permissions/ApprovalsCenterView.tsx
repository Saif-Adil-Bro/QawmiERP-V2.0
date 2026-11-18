"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  User,
  AlertTriangle,
  X,
  AlertCircle,
  Calendar,
  ArrowRight,
  GitBranch,
} from "lucide-react";
import { ApprovalRequest, ApprovalRequestType } from "@/lib/permissions";
import { reviewApprovalRequest } from "@/app/actions/permissions";
import { decideApprovalStep } from "@/app/actions/approvals";
import type { ApprovalRequestRecord } from "@/lib/approval-workflow";
import { toBanglaNumber, formatBanglaCurrency } from "@/lib/numberToBangla";
import StepUpVerificationModal from "@/components/security/StepUpVerificationModal";

interface Props {
  requests: ApprovalRequest[];
  multiStepRequests?: ApprovalRequestRecord[];
  onRefresh?: () => void;
}

const TYPE_LABELS: Record<ApprovalRequestType, { title: string; bg: string; text: string }> = {
  FEE_DISCOUNT: {
    title: "ফি ছাড় / বিশেষ ছাড়",
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-800 dark:text-amber-300",
  },
  FEE_WAIVER: {
    title: "ফি সম্পূর্ণ মওকুফ",
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-800 dark:text-amber-300",
  },
  LARGE_EXPENSE: {
    title: "বড় অঙ্কের ব্যয় অনুমোদন",
    bg: "bg-orange-100 dark:bg-orange-900/40",
    text: "text-orange-800 dark:text-orange-300",
  },
  SALARY_CHANGE: {
    title: "বেতন / বোনাস পরিবর্তন",
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
    text: "text-emerald-800 dark:text-emerald-300",
  },
  RESULT_PUBLISH: {
    title: "পরীক্ষার চূড়ান্ত ফলাফল প্রকাশ",
    bg: "bg-blue-100 dark:bg-blue-900/40",
    text: "text-blue-800 dark:text-blue-300",
  },
  CERTIFICATE_ISSUE: {
    title: "সনদপত্র প্রদান",
    bg: "bg-purple-100 dark:bg-purple-900/40",
    text: "text-purple-800 dark:text-purple-300",
  },
  CERTIFICATE_REVOKE: {
    title: "সনদপত্র বাতিলকরণ",
    bg: "bg-rose-100 dark:bg-rose-900/40",
    text: "text-rose-800 dark:text-rose-300",
  },
  STUDENT_ARCHIVE: {
    title: "শিক্ষার্থী স্থানান্তর / নিষ্ক্রিয়",
    bg: "bg-rose-100 dark:bg-rose-900/40",
    text: "text-rose-800 dark:text-rose-300",
  },
  STAFF_TERMINATION: {
    title: "স্টাফ অব্যাহতি / ছাড়পত্র",
    bg: "bg-rose-100 dark:bg-rose-900/40",
    text: "text-rose-800 dark:text-rose-300",
  },
};

export default function ApprovalsCenterView({
  requests = [],
  multiStepRequests = [],
  onRefresh,
}: Props) {
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">(
    "PENDING"
  );
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [stepUpState, setStepUpState] = useState<{
    open: boolean;
    decision: "APPROVED" | "REJECTED";
    actionScope?: string;
  }>({ open: false, decision: "APPROVED" });

  const multiMap = new Map(multiStepRequests.map((r) => [r.id, r]));

  const showToast = (type: "success" | "error", text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  const filteredRequests = requests.filter((r) => {
    if (filterStatus === "ALL") return true;
    return r.status === filterStatus;
  });

  const executeDecision = (
    decision: "APPROVED" | "REJECTED",
    stepUpToken?: string
  ) => {
    if (!selectedRequest) return;

    startTransition(async () => {
      const hasMulti = multiMap.has(selectedRequest.id);
      const res: any = hasMulti || stepUpToken
        ? await decideApprovalStep(selectedRequest.id, decision, reviewNotes, stepUpToken)
        : await reviewApprovalRequest(selectedRequest.id, decision, reviewNotes);

      if (res?.stepUpRequired) {
        setStepUpState({
          open: true,
          decision,
          actionScope: res.actionScope || "approval.decide",
        });
        return;
      }

      if (res?.error) {
        showToast("error", res.error);
      } else {
        showToast("success", res?.message || "সিদ্ধান্ত সফলভাবে সংরক্ষিত হয়েছে!");
        setSelectedRequest(null);
        setReviewNotes("");
        if (onRefresh) onRefresh();
      }
    });
  };

  const selectedMulti = selectedRequest ? multiMap.get(selectedRequest.id) : undefined;

  return (
    <div className="space-y-6">
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 p-4 rounded-xl shadow-lg border flex items-center gap-3 transition-all duration-300 ${
            notification.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100"
              : "bg-rose-50 dark:bg-rose-950/90 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span className="text-sm font-medium">{notification.text}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-md text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              বহু-স্তরীয় অনুমোদন কেন্দ্র (Approvals Center)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ফি ছাড়, বড় ব্যয়, বেতন পরিবর্তন, ফলাফল প্রকাশ ও সনদ প্রদানের ধাপে ধাপে অনুমোদন
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/approvals"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition flex items-center gap-1.5"
          >
            <GitBranch className="w-3.5 h-3.5" />
            ওয়ার্কফ্লো বিল্ডার
          </Link>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  filterStatus === s
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
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
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {filteredRequests.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-12 text-center">
            <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              কোন অনুমোদনের আবেদন নেই
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              বর্তমানে এই ফিল্টারে কোন অপেক্ষমান বা সংরক্ষিত আবেদন পাওয়া যায়নি।
            </p>
          </div>
        ) : (
          filteredRequests.map((req) => {
            const typeDef = TYPE_LABELS[req.type] || {
              title: req.type,
              bg: "bg-slate-100 dark:bg-slate-800",
              text: "text-slate-800 dark:text-slate-200",
            };
            const multi = multiMap.get(req.id);

            return (
              <div
                key={req.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
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
                          ? "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
                          : req.status === "APPROVED"
                          ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300"
                          : "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300"
                      }`}
                    >
                      {req.status === "PENDING"
                        ? "অপেক্ষমান"
                        : req.status === "APPROVED"
                        ? "অনুমোদিত"
                        : "বাতিল"}
                    </span>

                    {multi && multi.total_steps > 1 && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        ধাপ {toBanglaNumber(multi.current_step_order)}/{toBanglaNumber(multi.total_steps)}
                      </span>
                    )}

                    {multi?.sla_breached && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        SLA অতিক্রান্ত
                      </span>
                    )}

                    {multi && multi.amount > 0 && (
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {formatBanglaCurrency(multi.amount)}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {req.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {req.description}
                  </p>

                  {/* Multi-step mini timeline */}
                  {multi && multi.steps && multi.steps.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {multi.steps.map((step, idx) => {
                        const dec = multi.decisions?.find(
                          (d) => d.step_order === step.step_order
                        );
                        const isCurrent =
                          multi.status === "PENDING" &&
                          multi.current_step_order === step.step_order;
                        return (
                          <React.Fragment key={step.id || idx}>
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-md font-medium border ${
                                dec?.decision === "APPROVED"
                                  ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                                  : dec?.decision === "REJECTED"
                                  ? "bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                                  : isCurrent
                                  ? "bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300"
                                  : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              {step.step_name}
                            </span>
                            {idx < multi.steps!.length - 1 && (
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      আবেদনকারী:{" "}
                      <strong className="text-slate-700 dark:text-slate-200">
                        {req.requested_by.name}
                      </strong>{" "}
                      ({req.requested_by.role})
                    </span>

                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(req.requested_at).toLocaleString("bn-BD")}
                    </span>

                    {req.reviewed_by && (
                      <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
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
                      className="px-4 py-2 bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
                    >
                      পর্যালোচনা ও সিদ্ধান্ত
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedRequest(req)}
                      className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
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
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6">
            <div className="p-5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  অনুমোদন আবেদন পর্যালোচনা
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  #{selectedRequest.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-4 rounded-xl space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                  বিষয়
                </span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {selectedRequest.title}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {selectedRequest.description}
                </p>
              </div>

              {selectedMulti && selectedMulti.decisions && selectedMulti.decisions.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-900 text-xs space-y-2">
                  <span className="font-bold text-slate-700 dark:text-slate-200 block">
                    পূর্ববর্তী ধাপের সিদ্ধান্ত:
                  </span>
                  {selectedMulti.decisions.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800 last:border-none"
                    >
                      <span className="text-slate-600 dark:text-slate-300">
                        ধাপ {toBanglaNumber(d.step_order)} ({d.decided_by_name || d.decided_by_role})
                      </span>
                      <span
                        className={`font-bold ${
                          d.decision === "APPROVED"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {d.decision === "APPROVED" ? "অনুমোদিত" : "প্রত্যাখ্যাত"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {selectedRequest.status === "PENDING" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    পর্যালোচনা মন্তব্য (ঐচ্ছিক)
                  </label>
                  <textarea
                    rows={3}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="অনুমোদন বা প্রত্যাখ্যানের কারণ বা দিকনির্দেশনা লিখুন..."
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              )}

              {selectedRequest.status !== "PENDING" && (
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    পর্যালোচনা নোট:
                  </span>
                  <p className="text-slate-600 dark:text-slate-400 italic">
                    {selectedRequest.review_notes || "কোন মন্তব্য উল্লেখ করা হয়নি"}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                বন্ধ করুন
              </button>

              {selectedRequest.status === "PENDING" && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => executeDecision("REJECTED")}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                  >
                    প্রত্যাখ্যান করুন
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => executeDecision("APPROVED")}
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

      <StepUpVerificationModal
        open={stepUpState.open}
        onClose={() => setStepUpState((prev) => ({ ...prev, open: false }))}
        actionScope={stepUpState.actionScope}
        actionLabel="সংবেদনশীল অনুমোদন চূড়ান্তকরণ"
        onVerified={(token) => {
          const dec = stepUpState.decision;
          setStepUpState((prev) => ({ ...prev, open: false }));
          executeDecision(dec, token);
        }}
      />
    </div>
  );
}
