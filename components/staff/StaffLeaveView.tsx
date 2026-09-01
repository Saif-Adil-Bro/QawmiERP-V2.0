"use client";

import React, { useState } from "react";
import {
  StaffLeaveRequest,
  StaffMember,
  LEAVE_TYPE_LABELS,
} from "@/lib/staff-management";
import {
  submitStaffLeaveRequest,
  reviewStaffLeaveRequest,
} from "@/app/actions/staff";
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Filter,
  User,
  X,
  Search,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface StaffLeaveViewProps {
  leaveRequests: StaffLeaveRequest[];
  staffList: StaffMember[];
  onRefresh: () => void;
}

export default function StaffLeaveView({
  leaveRequests,
  staffList,
  onRefresh,
}: StaffLeaveViewProps) {
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Review Modal
  const [reviewReq, setReviewReq] = useState<StaffLeaveRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);

  // New Request Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState(staffList[0]?.id || "");
  const [leaveType, setLeaveType] = useState<any>("CASUAL");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [totalDays, setTotalDays] = useState(1);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter requests
  const filteredRequests = leaveRequests.filter((req) => {
    if (filterStatus !== "ALL" && req.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        req.staff_name.toLowerCase().includes(q) ||
        req.reason.toLowerCase().includes(q) ||
        (req.leave_type_name_bn || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingRequests = leaveRequests.filter((r) => r.status === "PENDING");

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewReq) return;
    setIsReviewing(true);

    const res = await reviewStaffLeaveRequest({
      requestId: reviewReq.id,
      status: reviewAction,
      reviewReason: reviewAction === "REJECTED" ? rejectionReason : undefined,
    });
    setIsReviewing(false);

    if (res.success) {
      setReviewReq(null);
      setRejectionReason("");
      onRefresh();
    } else {
      alert(res.error);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) {
      alert("কর্মী নির্বাচন করুন");
      return;
    }
    setIsSubmitting(true);

    const res = await submitStaffLeaveRequest({
      staffId: selectedStaffId,
      leaveType,
      leaveTypeNameBn: LEAVE_TYPE_LABELS[leaveType] || "ছুটি",
      startDate,
      endDate,
      totalDays: Number(totalDays),
      reason,
    });
    setIsSubmitting(false);

    if (res.success) {
      setShowAddModal(false);
      setReason("");
      onRefresh();
    } else {
      alert(res.error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">ছুটি ব্যবস্থাপনা ও আবেদন অনুমোদন</h3>
          <p className="text-xs text-slate-500">
            স্টাফদের ছুটির আবেদন যাচাই, অনুমোদন/বাতিল ও ব্যালেন্স হিসাব
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ নতুন ছুটির আবেদন দাখিল করুন</span>
        </button>
      </div>

      {/* Pending Queue Highlight */}
      {pendingRequests.length > 0 && (
        <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
            <Clock className="w-4 h-4 text-amber-700" />
            <span>অপেক্ষমাণ ছুটির আবেদন ({toBanglaNumber(pendingRequests.length)}টি অনুমোদন বাকি)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs space-y-2 text-xs flex flex-col justify-between"
              >
                <div className="space-y-1">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-slate-900">{req.staff_name}</h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                      {req.leave_type_name_bn || LEAVE_TYPE_LABELS[req.leave_type]}
                    </span>
                  </div>

                  <p className="text-slate-600 text-[11px]">
                    তারিখ: {toBanglaNumber(req.start_date)} হতে {toBanglaNumber(req.end_date)} ({toBanglaNumber(req.total_days)} দিন)
                  </p>

                  <p className="text-slate-700 italic bg-slate-50 p-2 rounded-lg text-[11px]">
                    "{req.reason}"
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setReviewReq(req);
                      setReviewAction("APPROVED");
                    }}
                    className="flex-1 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold text-xs transition cursor-pointer"
                  >
                    অনুমোদন করুন
                  </button>
                  <button
                    onClick={() => {
                      setReviewReq(req);
                      setReviewAction("REJECTED");
                    }}
                    className="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-semibold text-xs transition cursor-pointer"
                  >
                    বাতিল করুন
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="নাম বা ছুটির কারণ দিয়ে খুঁজুন..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="ALL">সকল স্ট্যাটাস</option>
            <option value="PENDING">অপেক্ষমাণ (Pending)</option>
            <option value="APPROVED">অনুমোদিত (Approved)</option>
            <option value="REJECTED">বাতিল (Rejected)</option>
          </select>
        </div>
      </div>

      {/* All Requests Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-bold">কর্মী</th>
                <th className="py-3 px-4 font-bold">ছুটির ধরন</th>
                <th className="py-3 px-4 font-bold">সময়সীমা</th>
                <th className="py-3 px-4 font-bold">মোট দিন</th>
                <th className="py-3 px-4 font-bold">কারণ</th>
                <th className="py-3 px-4 font-bold">স্ট্যাটাস</th>
                <th className="py-3 px-4 font-bold text-right">যাচাইকারী</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    কোনো ছুটির আবেদন রেকর্ড নেই
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">{req.staff_name}</td>
                    <td className="py-3 px-4">{req.leave_type_name_bn || LEAVE_TYPE_LABELS[req.leave_type]}</td>
                    <td className="py-3 px-4">
                      {toBanglaNumber(req.start_date)} - {toBanglaNumber(req.end_date)}
                    </td>
                    <td className="py-3 px-4 font-bold">{toBanglaNumber(req.total_days)} দিন</td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{req.reason}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          req.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : req.status === "REJECTED"
                            ? "bg-rose-50 text-rose-800 border-rose-200"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}
                      >
                        {req.status === "APPROVED" && "অনুমোদিত"}
                        {req.status === "REJECTED" && "বাতিল"}
                        {req.status === "PENDING" && "অপেক্ষমাণ"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400 text-[11px]">
                      {req.reviewed_by || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {reviewReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-800">
                ছুটি আবেদন {reviewAction === "APPROVED" ? "অনুমোদন" : "বাতিল"}
              </h3>
              <button onClick={() => setReviewReq(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <span className="text-slate-600 block">কর্মী: <strong>{reviewReq.staff_name}</strong></span>
              <span className="text-slate-600 block">ছুটির ধরন: <strong>{reviewReq.leave_type_name_bn}</strong></span>
              <span className="text-slate-600 block">দিন: <strong>{toBanglaNumber(reviewReq.total_days)} দিন</strong></span>
              <span className="text-slate-600 block">কারণ: <em>"{reviewReq.reason}"</em></span>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-3 text-xs">
              {reviewAction === "REJECTED" && (
                <div>
                  <label className="font-semibold block mb-1">বাতিলের কারণ</label>
                  <textarea
                    rows={2}
                    required
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="বাতিলের কারণ লিখুন..."
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReviewReq(null)}
                  className="px-4 py-2 bg-slate-100 rounded-xl font-semibold text-slate-700"
                >
                  ফিরে যান
                </button>
                <button
                  type="submit"
                  disabled={isReviewing}
                  className={`px-4 py-2 text-white rounded-xl font-semibold shadow-xs ${
                    reviewAction === "APPROVED"
                      ? "bg-emerald-700 hover:bg-emerald-800"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {isReviewing ? "প্রক্রিয়াকরণ হচ্ছে..." : reviewAction === "APPROVED" ? "অনুমোদন নিশ্চিত করুন" : "আবেদন বাতিল করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Leave Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-800">নতুন ছুটির আবেদন দাখিল</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">কর্মী নির্বাচন করুন</label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.personal.full_name_bn || `${s.personal.first_name} ${s.personal.last_name}`} ({s.staff_id_code}) - {s.employment.designation}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">ছুটির ধরন</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">শুরুর তারিখ</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">শেষের তারিখ</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">মোট ছুটির দিন</label>
                <input
                  type="number"
                  min={1}
                  value={totalDays}
                  onChange={(e) => setTotalDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">ছুটির কারণ ও বিবরণ</label>
                <textarea
                  rows={2}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="ছুটির স্পষ্ট কারণ উল্লেখ করুন..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 rounded-xl font-semibold text-slate-700"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-semibold shadow-xs"
                >
                  {isSubmitting ? "দাখিল হচ্ছে..." : "আবেদন দাখিল করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
