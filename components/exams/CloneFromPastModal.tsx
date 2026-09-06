"use client";

import { useState, useEffect } from "react";
import { getArchivedExamPapers } from "@/app/actions/questions";
import { 
  X, Copy, Loader2, ArrowRight, BookOpen, Layers, 
  Calendar, Award, Clock, Search, Filter, CheckCircle2, History 
} from "lucide-react";
import SpecializedQuestionView from "./SpecializedQuestionView";

interface CloneFromPastModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentExamId: string;
  currentClassId: string;
  currentSubjectId: string;
  classes: any[];
  subjects: any[];
  onApplyPastPaper: (paperData: any) => void;
}

function toBengaliNumerals(num: number): string {
  const digits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return num.toString().split("").map(d => digits[parseInt(d)] || d).join("");
}

export default function CloneFromPastModal({
  isOpen,
  onClose,
  currentExamId,
  currentClassId,
  currentSubjectId,
  classes,
  subjects,
  onApplyPastPaper,
}: CloneFromPastModalProps) {
  const [loading, setLoading] = useState(true);
  const [pastPapers, setPastPapers] = useState<any[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<any | null>(null);
  const [filterClassId, setFilterClassId] = useState(currentClassId || "");
  const [filterSubjectId, setFilterSubjectId] = useState(currentSubjectId || "");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchPastPapers();
    }
  }, [isOpen, filterClassId, filterSubjectId]);

  const fetchPastPapers = async () => {
    setLoading(true);
    try {
      const papers = await getArchivedExamPapers({
        classId: filterClassId || undefined,
        subjectId: filterSubjectId || undefined,
        search: searchQuery || undefined,
      });
      // Filter out papers from the exact same exam if desired, but allow viewing all
      const filtered = (papers || []).filter(p => p.exam_id !== currentExamId || (p.class_id !== currentClassId || p.subject_id !== currentSubjectId));
      setPastPapers(filtered.length > 0 ? filtered : (papers || []));
      if (filtered.length > 0) {
        setSelectedPaper(filtered[0]);
      } else if (papers && papers.length > 0) {
        setSelectedPaper(papers[0]);
      } else {
        setSelectedPaper(null);
      }
    } catch (err) {
      console.error("Error fetching past papers:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleApply = () => {
    if (!selectedPaper) return;
    onApplyPastPaper(selectedPaper);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-300">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">বিগত বছরের প্রশ্নপত্র থেকে ক্লোন (Clone from Past Paper)</h2>
              <p className="text-xs text-indigo-200 mt-0.5">
                পূর্ববর্তী সেমিস্টার বা শিক্ষাবর্ষের তৈরিকৃত প্রশ্নপত্র সরাসরি বর্তমান পরীক্ষার ফর্মে লোড করুন
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

        {/* Filters Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">শ্রেণি / জামাত</label>
            <select
              value={filterClassId}
              onChange={(e) => setFilterClassId(e.target.value)}
              className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-medium outline-none"
            >
              <option value="">সকল শ্রেণি (All Classes)</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">বিষয় (Subject)</label>
            <select
              value={filterSubjectId}
              onChange={(e) => setFilterSubjectId(e.target.value)}
              className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-medium outline-none"
            >
              <option value="">সকল বিষয় (All Subjects)</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">অনুসন্ধান (Search)</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchPastPapers()}
                placeholder="শিরোনাম বা পরীক্ষার নাম..."
                className="w-full p-2 pl-7 bg-white border border-slate-300 rounded-lg text-xs outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2.5" />
            </div>
          </div>
        </div>

        {/* Main Content Area (Left: List, Right: Preview) */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
          {/* Left Column: List of Past Papers */}
          <div className="md:col-span-5 border-r border-slate-200 overflow-y-auto p-4 space-y-2.5 bg-slate-50/50">
            {loading ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                <p className="text-xs">আর্কাইভ থেকে প্রশ্নপত্র খোঁজা হচ্ছে...</p>
              </div>
            ) : pastPapers.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold">কোনো পূর্ববর্তী প্রশ্নপত্র পাওয়া যায়নি।</p>
                <p className="text-[11px] text-slate-400 mt-1">অন্যান্য শ্রেণি বা বিষয়ের ফিল্টার নির্বাচন করে দেখুন।</p>
              </div>
            ) : (
              pastPapers.map((paper) => {
                const isSelected = selectedPaper?.id === paper.id;
                return (
                  <div
                    key={paper.id}
                    onClick={() => setSelectedPaper(paper)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? "bg-white border-indigo-500 shadow-md ring-2 ring-indigo-500/20"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-100/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 mb-1">
                          {paper.academic_year || paper.exam?.year || "পূর্ববর্তী বর্ষ"}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 line-clamp-1">
                          {paper.title || paper.exam?.title}
                        </h4>
                      </div>
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                        {toBengaliNumerals(paper.total_marks || 100)} নম্বর
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">{paper.class?.name}</span>
                      <span>•</span>
                      <span className="font-semibold text-slate-800">{paper.subject?.name}</span>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{paper.total_questions_count || 0} টি প্রশ্ন</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{paper.exam_time || "২:৩০ ঘণ্টা"}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Active Paper Preview */}
          <div className="md:col-span-7 overflow-y-auto p-5 bg-white space-y-4">
            {selectedPaper ? (
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-base text-slate-900">
                      {selectedPaper.title || selectedPaper.exam?.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedPaper.class?.name} • {selectedPaper.subject?.name} • শিক্ষাবর্ষ: {selectedPaper.academic_year || selectedPaper.exam?.year}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleApply}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>এই প্রশ্নপত্র লোড করুন</span>
                  </button>
                </div>

                {/* Question breakdown & details */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    প্রশ্নপত্রের উপাদানসমূহ
                  </h4>

                  {selectedPaper.questions?.is_sectioned && Array.isArray(selectedPaper.questions?.sections) ? (
                    selectedPaper.questions.sections.map((sec: any, sIdx: number) => (
                      <div key={sIdx} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                          <span className="font-bold text-xs text-indigo-900">{sec.name}</span>
                          <span className="text-[11px] text-slate-600 font-semibold">
                            মান: {toBengaliNumerals(sec.targetMarks || 50)}
                          </span>
                        </div>
                        <div className="space-y-2 pl-2">
                          {(sec.questions || []).map((q: any, qIdx: number) => (
                            <div key={qIdx} className="text-xs text-slate-800 border-b border-slate-100 pb-1.5 last:border-0">
                              <p className="font-medium line-clamp-2">{q.question_text}</p>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                                <span>নম্বর: {q.marks}</span>
                                <span>•</span>
                                <span>ধরণ: {q.question_type}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-2 border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                      {(selectedPaper.questions || []).map((q: any, qIdx: number) => (
                        <div key={qIdx} className="text-xs text-slate-800 border-b border-slate-100 pb-1.5 last:border-0">
                          <p className="font-medium line-clamp-2">{q.question_text}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                            <span>নম্বর: {q.marks}</span>
                            <span>•</span>
                            <span>ধরণ: {q.question_type}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-slate-400">
                <BookOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium">বামপাশের তালিকা থেকে একটি প্রশ্নপত্র নির্বাচন করুন।</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 px-6 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-medium cursor-pointer"
          >
            বন্ধ করুন
          </button>
          {selectedPaper && (
            <button
              type="button"
              onClick={handleApply}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md transition cursor-pointer"
            >
              <Copy className="w-4 h-4" />
              <span>নির্বাচিত প্রশ্নপত্র বর্তমান জেনারেটরে লোড করুন</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
