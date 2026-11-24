"use client";

import React, { useState, useTransition } from "react";
import {
  GitBranch,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Save,
  Sliders,
} from "lucide-react";
import {
  cancelApprovalRequest,
  decideApprovalStep,
  deleteApprovalWorkflow,
  getApprovalRequests,
  getApprovalWorkflows,
  saveApprovalWorkflow,
} from "@/app/actions/approvals";
import type {
  ApprovalRequestRecord,
  ApprovalWorkflowWithSteps,
} from "@/lib/approval-workflow";
import { formatBanglaCurrency, toBanglaNumber } from "@/lib/numberToBangla";
import StepUpVerificationModal from "@/components/security/StepUpVerificationModal";

interface Props {
  initialWorkflows: ApprovalWorkflowWithSteps[];
  initialRequests: ApprovalRequestRecord[];
  currentUserId?: string | null;
}

const REQUEST_TYPE_OPTIONS = [
  { value: "LARGE_EXPENSE", label: "বড় অঙ্কের খরচ (LARGE_EXPENSE)" },
  { value: "FEE_DISCOUNT", label: "ফি ছাড় (FEE_DISCOUNT)" },
  { value: "FEE_WAIVER", label: "ফি মওকুফ (FEE_WAIVER)" },
  { value: "SALARY_CHANGE", label: "বেতন পরিবর্তন (SALARY_CHANGE)" },
  { value: "RESULT_PUBLISH", label: "ফলাফল প্রকাশ (RESULT_PUBLISH)" },
  { value: "CERTIFICATE_ISSUE", label: "সনদপত্র ইস্যু (CERTIFICATE_ISSUE)" },
  { value: "CERTIFICATE_REVOKE", label: "সনদপত্র বাতিল (CERTIFICATE_REVOKE)" },
  { value: "STUDENT_ARCHIVE", label: "শিক্ষার্থী আর্কাইভ (STUDENT_ARCHIVE)" },
  { value: "STAFF_TERMINATION", label: "স্টাফ অব্যাহতি (STAFF_TERMINATION)" },
];

const ROLE_OPTIONS = [
  { value: "accountant", label: "হিসাবরক্ষক (Accountant)" },
  { value: "naib_muhtamim", label: "নায়েবে মুহতামিম (Naib Muhtamim)" },
  { value: "muhtamim", label: "মুহতামিম (Muhtamim)" },
  { value: "exam_manager", label: "পরীক্ষা নিয়ন্ত্রক (Exam Manager)" },
  { value: "admin", label: "অ্যাডমিন (Admin)" },
  { value: "super_admin", label: "সুপার অ্যাডমিন (Super Admin)" },
];

export default function ApprovalsClient({
  initialWorkflows,
  initialRequests,
  currentUserId = null,
}: Props) {
  const [activeTab, setActiveTab] = useState<"queue" | "workflows">("queue");
  const [workflows, setWorkflows] = useState<ApprovalWorkflowWithSteps[]>(initialWorkflows);
  const [requests, setRequests] = useState<ApprovalRequestRecord[]>(initialRequests);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [notesByReq, setNotesByReq] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const [stepUpModal, setStepUpModal] = useState<{
    open: boolean;
    requestId: string;
    decision: "APPROVED" | "REJECTED";
    actionScope?: string;
  }>({ open: false, requestId: "", decision: "APPROVED" });

  // Workflow builder state
  const [wfName, setWfName] = useState("");
  const [wfType, setWfType] = useState("LARGE_EXPENSE");
  const [wfMinAmount, setWfMinAmount] = useState("10000");
  const [wfMaxAmount, setWfMaxAmount] = useState("");
  const [wfPriority, setWfPriority] = useState("10");
  const [wfTwoPerson, setWfTwoPerson] = useState(true);
  const [wfSteps, setWfSteps] = useState<
    Array<{
      step_name: string;
      approver_role: string;
      required_permission: string;
      sla_hours: number;
      require_step_up: boolean;
    }>
  >([
    {
      step_name: "হিসাব যাচাই",
      approver_role: "accountant",
      required_permission: "finance.approve",
      sla_hours: 24,
      require_step_up: false,
    },
    {
      step_name: "মুহতামিম চূড়ান্ত অনুমোদন",
      approver_role: "muhtamim",
      required_permission: "approval.approve",
      sla_hours: 48,
      require_step_up: true,
    },
  ]);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const refreshData = () => {
    startTransition(async () => {
      const [wfRes, reqList] = await Promise.all([
        getApprovalWorkflows(),
        getApprovalRequests(),
      ]);
      setWorkflows(wfRes.workflows);
      setRequests(reqList);
    });
  };

  const handleDecision = (
    requestId: string,
    decision: "APPROVED" | "REJECTED",
    stepUpToken?: string
  ) => {
    startTransition(async () => {
      const res: any = await decideApprovalStep(
        requestId,
        decision,
        notesByReq[requestId] || "",
        stepUpToken
      );

      if (res?.stepUpRequired) {
        setStepUpModal({
          open: true,
          requestId,
          decision,
          actionScope: res.actionScope,
        });
        return;
      }

      if (res?.error) {
        showToast("error", res.error);
      } else {
        showToast(res?.executionResult?.executed===false?"error":"success", res?.message || "সিদ্ধান্ত সংরক্ষিত হয়েছে।");
        refreshData();
      }
    });
  };

  const handleCancel = (requestId: string) => {
    startTransition(async () => {
      const res = await cancelApprovalRequest(requestId);
      if (res?.error) showToast("error", res.error);
      else {
        setRequests(prev=>prev.map(r=>r.id===requestId?{...r,status:"CANCELLED"}:r));
        showToast("success", res.message || "বাতিল করা হয়েছে।");
        refreshData();
      }
    });
  };

  const handleSaveWorkflow = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveApprovalWorkflow({
        name: wfName,
        request_type: wfType,
        min_amount: Number(wfMinAmount || 0),
        max_amount: wfMaxAmount ? Number(wfMaxAmount) : null,
        priority: Number(wfPriority || 0),
        require_two_person: wfTwoPerson,
        is_active: true,
        steps: wfSteps.map((s, idx) => ({
          step_order: idx + 1,
          ...s,
        })),
      });

      if (res?.error) {
        showToast("error", res.error);
      } else {
        showToast("success", res.message || "ওয়ার্কফ্লো সংরক্ষিত হয়েছে!");
        setWfName("");
        refreshData();
      }
    });
  };

  const handleDeleteWorkflow = (id: string) => {
    startTransition(async () => {
      const res = await deleteApprovalWorkflow(id);
      if (res?.error) showToast("error", res.error);
      else {
        showToast("success", res.message || "মুছে ফেলা হয়েছে।");
        refreshData();
      }
    });
  };

  const filteredRequests = requests.filter((r) => {
    if (statusFilter === "ALL") return true;
    if (statusFilter === "MY_REQUESTS") {
      if (!currentUserId) return false;
      return r.requested_by === currentUserId || r.requester_id === currentUserId;
    }
    return r.status === statusFilter || (statusFilter==="PENDING" && r.status==="IN_REVIEW");
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {toast && (
        <div
          role={toast.type === "error" ? "alert" : "status"}
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
            toast.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100"
              : "bg-rose-50 dark:bg-rose-950 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100"
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              বহু-স্তরীয় অনুমোদন ওয়ার্কফ্লো ইঞ্জিন
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ধাপে ধাপে অনুমোদন কিউ, SLA টাইমার এবং থ্রেশহোল্ড ভিত্তিক ওয়ার্কফ্লো কনফিগারেশন
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab("queue")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "queue"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            অনুমোদন কিউ ({toBanglaNumber(requests.filter((r) => r.status === "PENDING").length)})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("workflows")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "workflows"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            ওয়ার্কফ্লো বিল্ডার ({toBanglaNumber(workflows.length)})
          </button>
        </div>
      </div>

      {activeTab === "queue" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(["PENDING", "MY_REQUESTS", "APPROVED", "REJECTED", "CANCELLED", "ALL"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  statusFilter === st
                    ? "bg-slate-900 dark:bg-emerald-600 text-white border-transparent"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                }`}
              >
                {st === "PENDING"
                  ? "অপেক্ষমান"
                  : st === "MY_REQUESTS"
                  ? "আমার পাঠানো আবেদন (My Requests)"
                  : st === "APPROVED"
                  ? "অনুমোদিত"
                  : st === "REJECTED"
                  ? "প্রত্যাখ্যাত"
                  : st === "CANCELLED"
                  ? "বাতিল"
                  : "সকল"}
              </button>
            ))}
          </div>

          {filteredRequests.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
              <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                এই অবস্থায় কোন আবেদন পাওয়া যায়নি
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((req) => (
                <div
                  key={req.id} data-approval-id={req.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                          {req.request_type}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          ধাপ {toBanglaNumber(req.current_step_order)}/{toBanglaNumber(req.total_steps)}
                        </span>
                        {req.amount > 0 && (
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            {formatBanglaCurrency(req.amount)}
                          </span>
                        )}
                        {req.sla_breached && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            SLA অতিক্রান্ত
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {req.title}
                      </h3>
                      {req.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {req.description}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        আবেদনকারী: {req.requested_by_name || "অফিসার"} ({req.requested_by_role || "staff"})
                      </p>
                    </div>

                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full self-start ${
                        req.status === "APPROVED"
                          ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300"
                          : req.status === "REJECTED" || req.status === "CANCELLED"
                          ? "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300"
                          : "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>

                  {/* Step Timeline */}
                  {req.steps && req.steps.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {req.steps.map((s, idx) => {
                        const dec = req.decisions?.find((d) => d.step_order === s.step_order);
                        return (
                          <React.Fragment key={s.id || idx}>
                            <div
                              className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                                dec?.decision === "APPROVED"
                                  ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                                  : dec?.decision === "REJECTED"
                                  ? "bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                                  : req.current_step_order === s.step_order &&
                                    req.status === "PENDING"
                                  ? "bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300"
                                  : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              <span>{toBanglaNumber(s.step_order)}.</span>
                              <span className="font-semibold">{s.step_name}</span>
                              {s.require_step_up && (
                                <span className="text-[10px] px-1 rounded bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                                  2FA
                                </span>
                              )}
                            </div>
                            {idx < req.steps!.length - 1 && (
                              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}

                  {req.status==='APPROVED' && ['create_expense','collect_fee_payment','update_staff_salary','promote_staff'].includes(req.payload?.action) && <p className="text-sm font-semibold" role="status">
                    {req.executed_at && req.execution_result?.executed?'মূল খাতায় পোস্ট হয়েছে।':'অনুমোদিত, কিন্তু পোস্ট নিশ্চিত নয়। মূল রসিদ বা ভাউচার যাচাই করুন।'}
                  </p>}
                  {['PENDING','IN_REVIEW'].includes(req.status) && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <input
                        type="text"
                        value={notesByReq[req.id] || ""}
                        onChange={(e) =>
                          setNotesByReq((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        placeholder="মন্তব্য লিখুন (ঐচ্ছিক)..."
                        className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDecision(req.id, "APPROVED")}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          অনুমোদন
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDecision(req.id, "REJECTED")}
                          className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          প্রত্যাখ্যান
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          aria-label="আবেদন বাতিল" onClick={() => handleCancel(req.id)}
                          className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer disabled:opacity-50"
                        >
                          বাতিল
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Workflow Builder Form */}
          <form
            onSubmit={handleSaveWorkflow}
            className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
          >
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Sliders className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                নতুন অনুমোদন ওয়ার্কফ্লো তৈরি করুন
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ওয়ার্কফ্লোর নাম *
                </label>
                <input
                  required
                  value={wfName}
                  onChange={(e) => setWfName(e.target.value)}
                  placeholder="যেমন: ১০,০০০+ টাকার খরচ অনুমোদন"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  আবেদনের ধরন (Request Type)
                </label>
                <select
                  value={wfType}
                  onChange={(e) => setWfType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                >
                  {REQUEST_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ন্যূনতম পরিমাণ (Min Threshold ৳)
                </label>
                <input
                  type="number"
                  min={0}
                  value={wfMinAmount}
                  onChange={(e) => setWfMinAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  সর্বোচ্চ পরিমাণ (ঐচ্ছিক ৳)
                </label>
                <input
                  type="number"
                  min={0}
                  value={wfMaxAmount}
                  onChange={(e) => setWfMaxAmount(e.target.value)}
                  placeholder="সীমাহীন"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wfTwoPerson}
                  onChange={(e) => setWfTwoPerson(e.target.checked)}
                />
                দ্বি-ব্যক্তি নীতি (আবেদনকারী নিজে অনুমোদন করতে পারবেন না)
              </label>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 dark:text-slate-400">Priority:</span>
                <input
                  type="number"
                  value={wfPriority}
                  onChange={(e) => setWfPriority(e.target.value)}
                  className="w-20 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  অনুমোদনের ধাপসমূহ
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setWfSteps((prev) => [
                      ...prev,
                      {
                        step_name: `ধাপ ${prev.length + 1}`,
                        approver_role: "muhtamim",
                        required_permission: "approval.approve",
                        sla_hours: 24,
                        require_step_up: false,
                      },
                    ])
                  }
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  ধাপ যোগ করুন
                </button>
              </div>

              {wfSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      ধাপ {toBanglaNumber(idx + 1)}
                    </span>
                    {wfSteps.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setWfSteps((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-rose-500 hover:text-rose-700 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      value={step.step_name}
                      onChange={(e) =>
                        setWfSteps((prev) =>
                          prev.map((s, i) =>
                            i === idx ? { ...s, step_name: e.target.value } : s
                          )
                        )
                      }
                      placeholder="ধাপের নাম"
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                    <select
                      value={step.approver_role}
                      onChange={(e) =>
                        setWfSteps((prev) =>
                          prev.map((s, i) =>
                            i === idx ? { ...s, approver_role: e.target.value } : s
                          )
                        )
                      }
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={step.sla_hours}
                      onChange={(e) =>
                        setWfSteps((prev) =>
                          prev.map((s, i) =>
                            i === idx ? { ...s, sla_hours: Number(e.target.value || 24) } : s
                          )
                        )
                      }
                      placeholder="SLA (ঘণ্টা)"
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={step.require_step_up}
                      onChange={(e) =>
                        setWfSteps((prev) =>
                          prev.map((s, i) =>
                            i === idx ? { ...s, require_step_up: e.target.checked } : s
                          )
                        )
                      }
                    />
                    সংবেদনশীল ধাপ (Step-Up 2FA OTP বাধ্যতামূলক)
                  </label>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isPending ? "সংরক্ষণ হচ্ছে..." : "ওয়ার্কফ্লো সংরক্ষণ করুন"}
            </button>
          </form>

          {/* Existing Workflows List */}
          <div className="lg:col-span-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              সক্রিয় ওয়ার্কফ্লোসমূহ
            </h3>
            {workflows.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
                এখনো কোন কাস্টম ওয়ার্কফ্লো কনফিগার করা হয়নি।
              </div>
            ) : (
              workflows.map((wf) => (
                <div
                  key={wf.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                        {wf.request_type}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {wf.name}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        ন্যূনতম: {formatBanglaCurrency(wf.min_amount)}
                        {wf.max_amount ? ` — সর্বোচ্চ: ${formatBanglaCurrency(wf.max_amount)}` : "+"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteWorkflow(wf.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {wf.steps.map((s, idx) => (
                      <React.Fragment key={s.id || idx}>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {s.step_name} ({s.approver_role || s.required_permission})
                        </span>
                        {idx < wf.steps.length - 1 && (
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <StepUpVerificationModal
        open={stepUpModal.open}
        onClose={() => setStepUpModal((p) => ({ ...p, open: false }))}
        actionScope={stepUpModal.actionScope}
        actionLabel="সংবেদনশীল অনুমোদন ধাপ সম্পন্নকরণ"
        onVerified={(token) => {
          const { requestId, decision } = stepUpModal;
          setStepUpModal((p) => ({ ...p, open: false }));
          handleDecision(requestId, decision, token);
        }}
      />
    </div>
  );
}
