"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Search, Filter, BookOpen, Copy, Printer, Trash2, Eye, 
  Calendar, Layers, Clock, Award, Building2, ArrowRight, 
  LayoutGrid, LayoutList, Sparkles, FileText, CheckCircle2,
  RefreshCw, Loader2, Plus, Tag
} from "lucide-react";
import { deleteExamPaper } from "@/app/actions/questions";
import ClonePaperModal from "@/components/exams/ClonePaperModal";
import ArchivedPaperPreviewModal from "@/components/exams/ArchivedPaperPreviewModal";

interface ExamArchivesClientProps {
  initialPapers: any[];
  exams: any[];
  classes: any[];
  subjects: any[];
  madrasa: any;
}

function toBengaliNumerals(num: number): string {
  const digits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return num.toString().split("").map(d => digits[parseInt(d)] || d).join("");
}

export default function ExamArchivesClient({
  initialPapers,
  exams,
  classes,
  subjects,
  madrasa,
}: ExamArchivesClientProps) {
  const router = useRouter();
  const [papers, setPapers] = useState<any[]>(initialPapers);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [examFilter, setExamFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Modals state
  const [previewPaper, setPreviewPaper] = useState<any | null>(null);
  const [clonePaper, setClonePaper] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Extract distinct years from papers
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    papers.forEach(p => {
      if (p.academic_year) set.add(p.academic_year);
      if (p.exam?.year) set.add(p.exam.year);
    });
    exams.forEach(e => {
      if (e.year) set.add(e.year);
    });
    return Array.from(set).sort().reverse();
  }, [papers, exams]);

  // Filtered papers
  const filteredPapers = useMemo(() => {
    return papers.filter(p => {
      if (yearFilter && p.academic_year !== yearFilter && p.exam?.year !== yearFilter) {
        return false;
      }
      if (examFilter && p.exam_id !== examFilter) {
        return false;
      }
      if (classFilter && p.class_id !== classFilter) {
        return false;
      }
      if (subjectFilter && p.subject_id !== subjectFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const titleMatch = p.title && p.title.toLowerCase().includes(q);
        const examMatch = p.exam?.title && p.exam.title.toLowerCase().includes(q);
        const classMatch = p.class?.name && p.class.name.toLowerCase().includes(q);
        const subjectMatch = p.subject?.name && p.subject.name.toLowerCase().includes(q);
        const yearMatch = p.academic_year && p.academic_year.includes(q);
        if (!titleMatch && !examMatch && !classMatch && !subjectMatch && !yearMatch) {
          return false;
        }
      }
      return true;
    });
  }, [papers, yearFilter, examFilter, classFilter, subjectFilter, search]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalPapers = papers.length;
    const coveredClasses = new Set(papers.map(p => p.class_id)).size;
    const totalQuestions = papers.reduce((sum, p) => sum + (p.total_questions_count || 0), 0);
    const totalExams = new Set(papers.map(p => p.exam_id)).size;
    return { totalPapers, coveredClasses, totalQuestions, totalExams };
  }, [papers]);

  const handleDeletePaper = async (paperId: string, title: string) => {
    if (!window.confirm(`আপনি কি নিশ্চিত যে "${title}" প্রশ্নপত্রটি আর্কাইভ থেকে মুছে ফেলতে চান?`)) {
      return;
    }
    setDeletingId(paperId);
    try {
      const res = await deleteExamPaper(paperId);
      if (res?.success) {
        setPapers(prev => prev.filter(p => p.id !== paperId));
      } else {
        alert(res?.error || "মুছে ফেলা সম্ভব হয়নি।");
      }
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">সংরক্ষিত প্রশ্নপত্র</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {toBengaliNumerals(stats.totalPapers)} টি
          </div>
          <p className="text-xs text-slate-400 mt-1">সর্বমোট প্রস্তুতকৃত প্রশ্নপত্র</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">আওতাভুক্ত জামাত</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {toBengaliNumerals(stats.coveredClasses)} টি
          </div>
          <p className="text-xs text-slate-400 mt-1">জামাত ও মারহালা</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">মোট সংকলিত প্রশ্ন</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {toBengaliNumerals(stats.totalQuestions)} টি
          </div>
          <p className="text-xs text-slate-400 mt-1">সকল বিভাগের সর্বমোট প্রশ্ন</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">পরীক্ষার সেশন</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {toBengaliNumerals(stats.totalExams)} টি
          </div>
          <p className="text-xs text-slate-400 mt-1">আর্কাইভকৃত পরীক্ষার সংখ্যা</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="প্রশ্নপত্রের নাম, বিষয় বা জামাত খুঁজুন..."
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* View mode toggle & reset */}
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  viewMode === "grid" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
                title="গ্রিড ভিউ"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  viewMode === "table" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
                title="তালিকা ভিউ"
              >
                <LayoutList className="w-4 h-4" />
              </button>
            </div>

            {(yearFilter || examFilter || classFilter || subjectFilter || search) && (
              <button
                type="button"
                onClick={() => {
                  setYearFilter("");
                  setExamFilter("");
                  setClassFilter("");
                  setSubjectFilter("");
                  setSearch("");
                }}
                className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer"
              >
                রিসেট ফিল্টার
              </button>
            )}
          </div>
        </div>

        {/* Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">শিক্ষাবর্ষ / সাল</label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium outline-none"
            >
              <option value="">সকল শিক্ষাবর্ষ (All Years)</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">পরীক্ষা / সেমিস্টার</label>
            <select
              value={examFilter}
              onChange={(e) => setExamFilter(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium outline-none"
            >
              <option value="">সকল পরীক্ষা (All Exams)</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.title} ({ex.year})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">জামাত / শ্রেণি</label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium outline-none"
            >
              <option value="">সকল শ্রেণি (All Classes)</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">বিষয় (Subject)</label>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium outline-none"
            >
              <option value="">সকল বিষয় (All Subjects)</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content Rendering: Grid vs Table */}
      {filteredPapers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">কোনো আর্কাইভকৃত প্রশ্নপত্র পাওয়া যায়নি</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            পরীক্ষা চলাকালীন প্রশ্নপত্র তৈরি করলে তা স্বয়ংক্রিয়ভাবে এই সংগ্রহশালায় সংরক্ষিত হয়ে যাবে।
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPapers.map((paper) => {
            return (
              <div
                key={paper.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition duration-200 overflow-hidden flex flex-col justify-between group"
              >
                {/* Card Header */}
                <div className="p-5 border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-slate-50/40">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2.5 py-0.5 rounded-full mb-1.5">
                        {paper.academic_year || paper.exam?.year || "২০২৬"}
                      </span>
                      <h3 className="font-bold text-base text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition">
                        {paper.title || paper.exam?.title}
                      </h3>
                    </div>
                    <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 shrink-0">
                      {toBengaliNumerals(paper.total_marks || 100)} মান
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-3 text-xs text-slate-600">
                    <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {paper.class?.name || "সাধারণ"}
                    </span>
                    <span>•</span>
                    <span className="font-bold text-indigo-900">
                      {paper.subject?.name || "বিষয়"}
                    </span>
                  </div>
                </div>

                {/* Card Middle: Summary Chips */}
                <div className="p-5 space-y-3 flex-1">
                  <div className="flex flex-wrap gap-1.5">
                    {paper.section_names && paper.section_names.length > 0 ? (
                      paper.section_names.map((secName: string, idx: number) => (
                        <span key={idx} className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {secName}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        সাধারণ একক বিভাগ
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-500" />
                      <span>প্রশ্ন: <b>{toBengaliNumerals(paper.total_questions_count || 0)} টি</b></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>সময়: <b>{paper.exam_time || "২:৩০ ঘণ্টা"}</b></span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-1">
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => setPreviewPaper(paper)}
                      className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg transition cursor-pointer border border-transparent hover:border-slate-200"
                      title="পূর্ণাঙ্গ প্রিভিউ ও প্রিন্ট"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePaper(paper.id, paper.title)}
                      disabled={deletingId === paper.id}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition cursor-pointer border border-transparent hover:border-slate-200 disabled:opacity-50"
                      title="মুছে ফেলুন"
                    >
                      {deletingId === paper.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setClonePaper(paper)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>ক্লোন করুন (Clone)</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-4 font-bold">শিক্ষাবর্ষ ও শিরোনাম</th>
                  <th className="px-5 py-4 font-bold">জামাত ও বিষয়</th>
                  <th className="px-5 py-4 font-bold">পূর্ণমান ও সময়</th>
                  <th className="px-5 py-4 font-bold">প্রশ্নের বিবরণ</th>
                  <th className="px-5 py-4 font-bold text-right">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPapers.map((paper) => (
                  <tr key={paper.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-5 py-4">
                      <span className="inline-block text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-full mb-1">
                        {paper.academic_year || paper.exam?.year || "২০২৬"}
                      </span>
                      <div className="font-bold text-slate-900">{paper.title || paper.exam?.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{paper.exam_name || paper.exam?.title}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900">{paper.class?.name}</div>
                      <div className="text-xs text-indigo-600 font-medium">{paper.subject?.name}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-800">{toBengaliNumerals(paper.total_marks || 100)} নম্বর</div>
                      <div className="text-xs text-slate-400 mt-0.5">{paper.exam_time || "২:৩০ ঘণ্টা"}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{toBengaliNumerals(paper.total_questions_count || 0)} টি প্রশ্ন</span>
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => setPreviewPaper(paper)}
                        className="inline-flex items-center p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
                        title="প্রিভিউ ও প্রিন্ট"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setClonePaper(paper)}
                        className="inline-flex items-center bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold transition gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>ক্লোন</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePaper(paper.id, paper.title)}
                        disabled={deletingId === paper.id}
                        className="inline-flex items-center p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewPaper && (
        <ArchivedPaperPreviewModal
          isOpen={Boolean(previewPaper)}
          onClose={() => setPreviewPaper(null)}
          paper={previewPaper}
          madrasa={madrasa}
          onCloneClick={(p) => setClonePaper(p)}
        />
      )}

      {/* Clone Wizard Modal */}
      {clonePaper && (
        <ClonePaperModal
          isOpen={Boolean(clonePaper)}
          onClose={() => setClonePaper(null)}
          sourcePaper={clonePaper}
          exams={exams}
          classes={classes}
          subjects={subjects}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
