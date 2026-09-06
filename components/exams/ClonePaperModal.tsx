"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cloneExamPaper } from "@/app/actions/questions";
import { 
  X, Copy, Check, Loader2, ArrowRight, BookOpen, Layers, 
  Sparkles, Calendar, Clock, Award, CheckSquare, Square, FileSignature 
} from "lucide-react";
import SpecializedQuestionView from "./SpecializedQuestionView";

interface ClonePaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourcePaper: any;
  exams: any[];
  classes: any[];
  subjects: any[];
  onSuccess?: () => void;
}

export default function ClonePaperModal({
  isOpen,
  onClose,
  sourcePaper,
  exams,
  classes,
  subjects,
  onSuccess,
}: ClonePaperModalProps) {
  const router = useRouter();

  const [targetExamId, setTargetExamId] = useState<string>(
    exams.find(e => e.id !== sourcePaper?.exam_id)?.id || exams[0]?.id || ""
  );
  const [targetClassId, setTargetClassId] = useState<string>(sourcePaper?.class_id || "");
  const [targetSubjectId, setTargetSubjectId] = useState<string>(sourcePaper?.subject_id || "");
  
  const selectedTargetExam = exams.find(e => e.id === targetExamId);

  const [customTitle, setCustomTitle] = useState<string>(
    selectedTargetExam ? `${selectedTargetExam.title} - ${selectedTargetExam.year}` : sourcePaper?.title || ""
  );
  const [customExamName, setCustomExamName] = useState<string>(
    selectedTargetExam?.title || sourcePaper?.exam_name || ""
  );
  const [customExamTime, setCustomExamTime] = useState<string>(sourcePaper?.exam_time || "২ ঘণ্টা ৩০ মিনিট");
  const [customTotalMarks, setCustomTotalMarks] = useState<number>(sourcePaper?.total_marks || 100);
  const [syncToQuestionBank, setSyncToQuestionBank] = useState<boolean>(true);

  // Extract all questions with IDs for selective picking
  const allSourceQuestions: Array<{ id: string; sectionName?: string; question: any }> = [];
  const qData = sourcePaper?.questions;
  if (qData?.is_sectioned && Array.isArray(qData?.sections)) {
    qData.sections.forEach((sec: any) => {
      (sec.questions || []).forEach((q: any) => {
        allSourceQuestions.push({
          id: String(q.id),
          sectionName: sec.name,
          question: q
        });
      });
    });
  } else if (Array.isArray(qData)) {
    qData.forEach((q: any) => {
      allSourceQuestions.push({ id: String(q.id), question: q });
    });
  }

  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>(
    allSourceQuestions.map(q => q.id)
  );

  const [cloning, setCloning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !sourcePaper) return null;

  const handleToggleQuestion = (id: string) => {
    setSelectedQuestionIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedQuestionIds(allSourceQuestions.map(q => q.id));
  };

  const handleDeselectAll = () => {
    setSelectedQuestionIds([]);
  };

  const handleExamChange = (newExamId: string) => {
    setTargetExamId(newExamId);
    const ex = exams.find(e => e.id === newExamId);
    if (ex) {
      setCustomTitle(`${ex.title} - ${ex.year}`);
      setCustomExamName(ex.title);
    }
  };

  const handleExecuteClone = async () => {
    if (!targetExamId) {
      setErrorMsg("অনুগ্রহ করে টার্গেট পরীক্ষা নির্বাচন করুন।");
      return;
    }
    if (!targetClassId || !targetSubjectId) {
      setErrorMsg("অনুগ্রহ করে শ্রেণি ও বিষয় নির্বাচন করুন।");
      return;
    }
    if (selectedQuestionIds.length === 0) {
      setErrorMsg("অন্তত একটি প্রশ্ন নির্বাচন করুন।");
      return;
    }

    setCloning(true);
    setErrorMsg(null);

    try {
      const res = await cloneExamPaper({
        sourcePaperId: sourcePaper.id,
        targetExamId,
        targetClassId,
        targetSubjectId,
        newTitle: customTitle,
        newExamName: customExamName,
        newExamTime: customExamTime,
        totalMarks: Number(customTotalMarks),
        syncToQuestionBank,
        selectedQuestionIds,
      });

      if (res?.error) {
        setErrorMsg(res.error);
        setCloning(false);
        return;
      }

      onClose();
      if (onSuccess) onSuccess();

      // Redirect directly to the paper builder for immediate review & editing
      router.push(`/dashboard/exams/${targetExamId}/paper`);
    } catch (err: any) {
      console.error("Clone error:", err);
      setErrorMsg(err.message || "ক্লোন করতে সমস্যা হয়েছে।");
      setCloning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-800 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-300">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">প্রশ্নপত্র ক্লোন / ডুপ্লিকেট (Clone Paper)</h2>
              <p className="text-xs text-indigo-200 mt-0.5">
                বিগত পরীক্ষার প্রশ্নপত্র হুবহু কপি করে নতুন পরীক্ষার জন্য সামান্য পরিবর্তনে তৈরি করুন
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source Paper Banner */}
        <div className="bg-indigo-50/70 border-b border-indigo-100 p-4 px-6 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200">
              মূল সোর্স
            </span>
            <span className="font-semibold text-slate-800 text-sm">
              {sourcePaper?.title || sourcePaper?.exam?.title} ({sourcePaper?.academic_year || sourcePaper?.exam?.year})
            </span>
          </div>
          <div className="flex items-center gap-3 text-slate-600">
            <span>শ্রেণি: <b className="text-slate-900">{sourcePaper?.class?.name}</b></span>
            <span>•</span>
            <span>বিষয়: <b className="text-slate-900">{sourcePaper?.subject?.name}</b></span>
            <span>•</span>
            <span>মোট প্রশ্ন: <b className="text-indigo-700">{allSourceQuestions.length} টি</b></span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl text-sm font-medium">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Target Exam & Destination Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>টার্গেট পরীক্ষা নির্বাচন করুন (Target Exam) *</span>
              </label>
              <select
                value={targetExamId}
                onChange={(e) => handleExamChange(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-semibold text-sm outline-none"
              >
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title} — {ex.year} ({ex.status === "Ongoing" ? "চলমান" : ex.status === "Upcoming" ? "আসন্ন" : "সম্পন্ন"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">টার্গেট জামাত / শ্রেণি</label>
              <select
                value={targetClassId}
                onChange={(e) => setTargetClassId(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium outline-none"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">টার্গেট বিষয়</label>
              <select
                value={targetSubjectId}
                onChange={(e) => setTargetSubjectId(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium outline-none"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code || "N/A"})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-slate-500" />
                <span>মোট পূর্ণমান</span>
              </label>
              <input
                type="number"
                value={customTotalMarks}
                onChange={(e) => setCustomTotalMarks(Number(e.target.value))}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold outline-none"
              />
            </div>
          </div>

          {/* Paper Title & Timing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">প্রশ্নপত্রের প্রধান শিরোনাম (Title)</label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm font-medium outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>পরীক্ষার সময় (Duration)</span>
              </label>
              <input
                type="text"
                value={customExamTime}
                onChange={(e) => setCustomExamTime(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm font-medium outline-none"
              />
            </div>
          </div>

          {/* Question Selection List */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>ক্লোন করার জন্য প্রশ্নসমূহ ({selectedQuestionIds.length}/{allSourceQuestions.length} টি নির্বাচিত)</span>
              </label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                >
                  সবগুলো নির্বাচন
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                >
                  সব বাতিল
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              {allSourceQuestions.map((item, idx) => {
                const isSelected = selectedQuestionIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleToggleQuestion(item.id)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition flex items-start gap-3 ${
                      isSelected
                        ? "bg-white border-indigo-300 shadow-2xs ring-1 ring-indigo-500/20"
                        : "bg-slate-100/70 border-slate-200 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <div className="mt-0.5 text-indigo-600 shrink-0">
                      {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      {item.sectionName && (
                        <span className="inline-block text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 mb-1">
                          {item.sectionName}
                        </span>
                      )}
                      <p className="font-medium text-slate-800 line-clamp-2">
                        {item.question.question_text}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                        <span>নম্বর: <b>{item.question.marks || 10}</b></span>
                        <span>•</span>
                        <span>ধরণ: <b>{item.question.question_type}</b></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sync to Question Bank Option */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="sync-bank-check"
                checked={syncToQuestionBank}
                onChange={(e) => setSyncToQuestionBank(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="sync-bank-check" className="text-xs font-semibold text-slate-700 cursor-pointer">
                প্রশ্নগুলো মূল প্রশ্নব্যাংক (Question Bank)-এও যুক্ত ও আপডেট রাখুন
              </label>
            </div>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 p-4 px-6 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition text-sm font-medium cursor-pointer"
          >
            বাতিল
          </button>
          <button
            type="button"
            disabled={cloning || selectedQuestionIds.length === 0}
            onClick={handleExecuteClone}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-700 transition flex items-center space-x-2 text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
          >
            {cloning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>ক্লোন হচ্ছে...</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>ক্লোন সম্পন্ন করে এডিটরে যান</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
