"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  GraduationCap,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Users,
  Search,
  Filter,
  Check,
  X,
  Loader2,
  Sparkles,
  ArrowUpDown,
  BookOpen,
  Calendar,
  RotateCcw,
} from "lucide-react";
import { AcademicSession, StudentEnrollment } from "@/lib/sessions";
import { executeStudentPromotion } from "@/app/actions/sessions";
import { convertToBanglaNumber } from "@/lib/student-utils";

interface ClassItem {
  id: string;
  name: string;
}

interface PromotionClientProps {
  sessions: AcademicSession[];
  classes: ClassItem[];
  allEnrollments: StudentEnrollment[];
  initialFromSessionId?: string;
  initialToSessionId?: string;
}

export default function PromotionClient({
  sessions,
  classes,
  allEnrollments,
  initialFromSessionId,
  initialToSessionId,
}: PromotionClientProps) {
  const router = useRouter();

  // Pick default From and To sessions
  const currentSession = sessions.find((s) => s.is_current) || sessions[0];
  const archivedSession = sessions.find((s) => s.status === "ARCHIVED" || s.id !== currentSession?.id);

  const [fromSessionId, setFromSessionId] = useState<string>(
    initialFromSessionId || archivedSession?.id || sessions[0]?.id || ""
  );
  const [toSessionId, setToSessionId] = useState<string>(
    initialToSessionId || currentSession?.id || sessions[0]?.id || ""
  );

  const [fromClassId, setFromClassId] = useState<string>("ALL");
  const [defaultTargetClassId, setDefaultTargetClassId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Student selection state: studentId -> boolean
  const [selectedStudentIds, setSelectedStudentIds] = useState<Record<string, boolean>>({});

  // Custom student row overrides: studentId -> { targetClassId, targetRoll, actionStatus, remarks }
  const [studentOverrides, setStudentOverrides] = useState<
    Record<
      string,
      {
        targetClassId?: string;
        targetRoll?: string;
        actionStatus: "PROMOTE" | "REPEAT" | "TRANSFER" | "GRADUATE" | "WITHDRAW";
        remarks?: string;
      }
    >
  >({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filter students from the source session
  const sourceEnrollments = useMemo(() => {
    return allEnrollments.filter((e) => {
      if (e.session_id !== fromSessionId) return false;
      if (fromClassId !== "ALL" && e.class_id !== fromClassId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = `${e.student?.first_name || ""} ${e.student?.last_name || ""}`.toLowerCase();
        const roll = (e.roll_number || "").toLowerCase();
        const phone = (e.student?.parent_phone || "").toLowerCase();
        if (!name.includes(q) && !roll.includes(q) && !phone.includes(q)) return false;
      }
      return true;
    });
  }, [allEnrollments, fromSessionId, fromClassId, searchQuery]);

  // Handle select all
  const isAllSelected =
    sourceEnrollments.length > 0 &&
    sourceEnrollments.every((e) => selectedStudentIds[e.student_id]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedStudentIds({});
    } else {
      const next: Record<string, boolean> = {};
      sourceEnrollments.forEach((e) => {
        next[e.student_id] = true;
      });
      setSelectedStudentIds(next);
    }
  };

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  };

  // Update a student row state
  const handleUpdateStudentState = (
    studentId: string,
    updates: Partial<{
      targetClassId: string;
      targetRoll: string;
      actionStatus: "PROMOTE" | "REPEAT" | "TRANSFER" | "GRADUATE" | "WITHDRAW";
      remarks: string;
    }>
  ) => {
    setStudentOverrides((prev) => {
      const existing = prev[studentId] || { actionStatus: "PROMOTE" as const };
      return {
        ...prev,
        [studentId]: {
          ...existing,
          ...updates,
        },
      };
    });
  };

  // Bulk Apply Default Target Class
  const handleApplyDefaultTargetClass = () => {
    if (!defaultTargetClassId) return;
    setStudentOverrides((prev) => {
      const next = { ...prev };
      sourceEnrollments.forEach((e) => {
        if (selectedStudentIds[e.student_id]) {
          next[e.student_id] = {
            ...(next[e.student_id] || { actionStatus: "PROMOTE" }),
            targetClassId: defaultTargetClassId,
          };
        }
      });
      return next;
    });
  };

  // Auto assign sequential rolls (1, 2, 3...)
  const handleAutoAssignRolls = () => {
    let rollCounter = 1;
    setStudentOverrides((prev) => {
      const next = { ...prev };
      sourceEnrollments.forEach((e) => {
        if (selectedStudentIds[e.student_id]) {
          next[e.student_id] = {
            ...(next[e.student_id] || { actionStatus: "PROMOTE" }),
            targetRoll: String(rollCounter++),
          };
        }
      });
      return next;
    });
  };

  // Calculate summary counts
  const selectedCount = Object.values(selectedStudentIds).filter(Boolean).length;
  const promotedCount = sourceEnrollments.filter(
    (e) => selectedStudentIds[e.student_id] && (studentOverrides[e.student_id]?.actionStatus || "PROMOTE") === "PROMOTE"
  ).length;
  const repeatCount = sourceEnrollments.filter(
    (e) => selectedStudentIds[e.student_id] && studentOverrides[e.student_id]?.actionStatus === "REPEAT"
  ).length;
  const otherCount = selectedCount - promotedCount - repeatCount;

  // Submit Promotion
  const handleExecutePromotion = async () => {
    setIsSubmitting(true);
    setConfirmModalOpen(false);

    const items = sourceEnrollments
      .filter((e) => selectedStudentIds[e.student_id])
      .map((e) => {
        const override = studentOverrides[e.student_id] || { actionStatus: "PROMOTE" };
        return {
          studentId: e.student_id,
          targetClassId: override.targetClassId || defaultTargetClassId || e.class_id || null,
          targetRoll: override.targetRoll || e.roll_number || "",
          actionStatus: override.actionStatus || "PROMOTE",
          remarks: override.remarks || "",
        };
      });

    const res = await executeStudentPromotion({
      fromSessionId,
      toSessionId,
      fromClassId,
      items,
    });

    setIsSubmitting(false);

    if (res.error) {
      setFeedback({ type: "error", text: res.error });
    } else {
      setFeedback({
        type: "success",
        text: res.message || "প্রমোশন সফলভাবে সম্পন্ন হয়েছে!",
      });
      setSelectedStudentIds({});
      router.refresh();
    }
  };

  const fromSessionObj = sessions.find((s) => s.id === fromSessionId);
  const toSessionObj = sessions.find((s) => s.id === toSessionId);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-3 ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : "bg-rose-50 text-rose-900 border border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="text-sm font-semibold">{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">শিক্ষার্থী প্রমোশন</h1>
              <p className="text-xs sm:text-sm text-slate-500">
                এক শিক্ষাবর্ষ থেকে পরবর্তী শিক্ষাবর্ষে শ্রেণি উন্নয়ন ও রোল নির্ধারণ
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/academic/sessions"
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl transition flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            <span>শিক্ষাবর্ষ তালিকা</span>
          </Link>

          <Link
            href="/dashboard/students"
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl transition flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            <span>শিক্ষার্থীদের তালিকা</span>
          </Link>
        </div>
      </div>

      {/* Step 1 & Step 2: Session & Class Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source Session Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
              ১
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">যে শিক্ষাবর্ষ থেকে (From Session)</h3>
              <p className="text-[11px] text-slate-500">শিক্ষার্থীদের পূর্বের শিক্ষাবর্ষ ও জামাত নির্বাচন করুন</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">শিক্ষাবর্ষ (Session)</label>
              <select
                value={fromSessionId}
                onChange={(e) => {
                  setFromSessionId(e.target.value);
                  setSelectedStudentIds({});
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                {sessions.map((sess) => (
                  <option key={sess.id} value={sess.id}>
                    {sess.name} ({sess.academic_year}) {sess.is_current ? "● বর্তমান" : sess.status === "ARCHIVED" ? "📁 সংরক্ষিত" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">পূর্বের জামাত / শ্রেণি (Class)</label>
              <select
                value={fromClassId}
                onChange={(e) => {
                  setFromClassId(e.target.value);
                  setSelectedStudentIds({});
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                <option value="ALL">সকল জামাত (All Classes)</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Destination Session Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
              ২
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">যে শিক্ষাবর্ষে প্রমোশন হবে (To Session)</h3>
              <p className="text-[11px] text-slate-500">টার্গেট শিক্ষাবর্ষ ও নতুন জামাত নির্বাচন করুন</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">নতুন শিক্ষাবর্ষ (Destination)</label>
              <select
                value={toSessionId}
                onChange={(e) => setToSessionId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                {sessions.map((sess) => (
                  <option key={sess.id} value={sess.id}>
                    {sess.name} ({sess.academic_year}) {sess.is_current ? "● বর্তমান" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                পরবর্তী ডিফল্ট জামাত (Default Next Class)
              </label>
              <div className="flex gap-2">
                <select
                  value={defaultTargetClassId}
                  onChange={(e) => setDefaultTargetClassId(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="">-- জামাত বেছে নিন --</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleApplyDefaultTargetClass}
                  disabled={!defaultTargetClassId || selectedCount === 0}
                  className="px-3.5 py-2.5 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-40"
                  title="সিলেক্টেড সকল শিক্ষার্থীর জন্য এই জামাত সেট করুন"
                >
                  প্রয়োগ
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Tools & Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="শিক্ষার্থীর নাম, রোল বা ফোন নম্বর দিয়ে খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAutoAssignRolls}
              disabled={selectedCount === 0}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
              title="নির্বাচিত শিক্ষার্থীদের রোল ১, ২, ৩ হিসেবে স্বয়ংক্রিয়ভাবে সাজান"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>অটো রোল দিন (১, ২, ৩..)</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmModalOpen(true)}
              disabled={selectedCount === 0 || fromSessionId === toSessionId || isSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer disabled:opacity-40 flex items-center gap-2 shadow-2xs"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>প্রমোশন নিশ্চিত করুন ({selectedCount})</span>
            </button>
          </div>
        </div>

        {/* Selected Breakdown Ribbon */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
          <div className="flex items-center gap-3">
            <span>
              মোট শিক্ষার্থী: <strong>{sourceEnrollments.length}</strong>
            </span>
            <span>•</span>
            <span className="text-emerald-700 font-semibold">
              নির্বাচিত: <strong>{selectedCount}</strong> জন
            </span>
            {selectedCount > 0 && (
              <>
                <span>(উত্তীর্ণ: {promotedCount}, পুনরাবৃত্তি: {repeatCount})</span>
              </>
            )}
          </div>

          {fromSessionId === toSessionId && (
            <span className="text-rose-600 font-bold">
              সতর্কতা: উৎস ও গন্তব্য শিক্ষাবর্ষ একই হতে পারে না।
            </span>
          )}
        </div>
      </div>

      {/* Student List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3.5">শিক্ষার্থী</th>
                <th className="px-4 py-3.5">বর্তমান জামাত ও রোল</th>
                <th className="px-4 py-3.5">প্রমোশন স্ট্যাটাস</th>
                <th className="px-4 py-3.5">নতুন জামাত</th>
                <th className="px-4 py-3.5">নতুন রোল</th>
                <th className="px-4 py-3.5">নোট</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {sourceEnrollments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">কোনো শিক্ষার্থী পাওয়া যায়নি</p>
                    <p className="text-xs text-slate-400 mt-1">
                      অন্য শিক্ষাবর্ষ বা জামাত নির্বাচন করুন।
                    </p>
                  </td>
                </tr>
              ) : (
                sourceEnrollments.map((enr) => {
                  const isSelected = !!selectedStudentIds[enr.student_id];
                  const override = studentOverrides[enr.student_id] || {
                    actionStatus: "PROMOTE",
                    targetClassId: defaultTargetClassId || enr.class_id,
                    targetRoll: enr.roll_number || "",
                  };

                  return (
                    <tr
                      key={enr.student_id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isSelected ? "bg-emerald-50/40" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleStudent(enr.student_id)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>

                      {/* Student Info */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">
                          {enr.student?.first_name} {enr.student?.last_name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          পিতা: {enr.student?.father_name || "-"} • ফোন: {enr.student?.parent_phone || "-"}
                        </div>
                      </td>

                      {/* Current Class & Roll */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-800">
                          {enr.class_name || "অনির্ধারিত"}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          রোল: <strong>{enr.roll_number ? convertToBanglaNumber(enr.roll_number) : "-"}</strong>
                        </div>
                      </td>

                      {/* Action Status */}
                      <td className="px-4 py-3">
                        <select
                          value={override.actionStatus}
                          onChange={(e) =>
                            handleUpdateStudentState(enr.student_id, {
                              actionStatus: e.target.value as any,
                            })
                          }
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 bg-white"
                        >
                          <option value="PROMOTE">🟢 উত্তীর্ণ / প্রমোশন</option>
                          <option value="REPEAT">🔄 একই জামাতে পুনরাবৃত্তি</option>
                          <option value="TRANSFER">➡️ অন্য মাদরাসায় স্থানান্তর</option>
                          <option value="GRADUATE">🎓 তাকমিল/সমাপ্ত</option>
                          <option value="WITHDRAW">⏸️ সাময়িক প্রত্যাহার</option>
                        </select>
                      </td>

                      {/* Target Class */}
                      <td className="px-4 py-3">
                        {override.actionStatus === "PROMOTE" ? (
                          <select
                            value={override.targetClassId || defaultTargetClassId || enr.class_id || ""}
                            onChange={(e) =>
                              handleUpdateStudentState(enr.student_id, {
                                targetClassId: e.target.value,
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500 bg-white"
                          >
                            <option value="">-- জামাত বেছে নিন --</option>
                            {classes.map((cls) => (
                              <option key={cls.id} value={cls.id}>
                                {cls.name}
                              </option>
                            ))}
                          </select>
                        ) : override.actionStatus === "REPEAT" ? (
                          <span className="text-xs text-slate-500 font-medium">পূর্বের জামাতেই থাকবে</span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>

                      {/* Target Roll */}
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={override.targetRoll ?? enr.roll_number ?? ""}
                          onChange={(e) =>
                            handleUpdateStudentState(enr.student_id, {
                              targetRoll: e.target.value,
                            })
                          }
                          placeholder="রোল"
                          className="w-16 px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 text-center"
                        />
                      </td>

                      {/* Remarks */}
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          placeholder="মন্তব্য..."
                          value={override.remarks || ""}
                          onChange={(e) =>
                            handleUpdateStudentState(enr.student_id, {
                              remarks: e.target.value,
                            })
                          }
                          className="w-28 px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <GraduationCap className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900">শিক্ষার্থী প্রমোশন নিশ্চিতকরণ</h3>
              <p className="text-xs text-slate-500 mt-1">
                নিচে নির্বাচিত শিক্ষার্থীদের তথ্য নতুন শিক্ষাবর্ষে স্থানান্তরিত হবে
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">উৎস শিক্ষাবর্ষ:</span>
                <span className="font-bold text-slate-800">{fromSessionObj?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">গন্তব্য শিক্ষাবর্ষ:</span>
                <span className="font-bold text-emerald-800">{toSessionObj?.name}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="text-slate-500">মোট নির্বাচিত শিক্ষার্থী:</span>
                <span className="font-bold text-slate-900">{selectedCount} জন</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">উত্তীর্ণ / প্রমোশন:</span>
                <span className="font-bold text-emerald-600">{promotedCount} জন</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">পুনরাবৃত্তি:</span>
                <span className="font-bold text-amber-600">{repeatCount} জন</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              💡 <strong>ডাটা সুরক্ষার নিশ্চয়তা:</strong> পূর্ববর্তী সেশনের সকল তথ্য সংরক্ষিত থাকবে এবং নতুন সেশনের জন্য নতুন এনরোলমেন্ট রেকর্ড তৈরি হবে।
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleExecutePromotion}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>হ্যাঁ, প্রমোশন কার্যকর করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
