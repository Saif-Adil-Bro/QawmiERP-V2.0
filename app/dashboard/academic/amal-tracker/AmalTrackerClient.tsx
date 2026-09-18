"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  AmalTrackerTemplate,
  AmalStudentSnapshot,
  AmalEvaluationLog,
  WEEKLY_GENERAL_TEMPLATE,
  VACATION_15DAYS_TEMPLATE,
  RAMADAN_SPECIAL_TEMPLATE,
  HIFZ_HOME_TRACKER_TEMPLATE,
  KITAB_STUDY_TRACKER_TEMPLATE,
  buildAmalStudentSnapshot,
} from "@/lib/amal-tracker";
import { AmalSheetA4 } from "@/components/amal-tracker/AmalSheetA4";
import { toBanglaNumber } from "@/lib/numberToBangla";
import {
  Printer,
  FileText,
  Calendar,
  Users,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  Sparkles,
  Search,
  BookOpen,
  Filter,
  Download,
  Share2,
  Settings2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Moon,
  Heart,
  GraduationCap,
  Save,
  X,
  Layers,
  Award,
} from "lucide-react";
import {
  saveAmalTrackerTemplate,
  deleteAmalTrackerTemplate,
  saveAmalEvaluationLog,
  deleteAmalEvaluationLog,
} from "@/app/actions/amal-tracker";
import { useRouter } from "next/navigation";

interface AmalTrackerClientProps {
  initialTemplates: AmalTrackerTemplate[];
  initialLogs: AmalEvaluationLog[];
  classes: any[];
  students: any[];
  madrasaInfo: any;
}

export default function AmalTrackerClient({
  initialTemplates,
  initialLogs,
  classes,
  students,
  madrasaInfo,
}: AmalTrackerClientProps) {
  const router = useRouter();

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"studio" | "templates" | "evaluation">("studio");

  // Studio Settings & Filter State
  const [templates, setTemplates] = useState<AmalTrackerTemplate[]>(initialTemplates);
  const [evaluationLogs, setEvaluationLogs] = useState<AmalEvaluationLog[]>(initialLogs);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    initialTemplates[0]?.id || WEEKLY_GENERAL_TEMPLATE.id
  );
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [printMode, setPrintMode] = useState<"bulk" | "single" | "blank">("bulk");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [startDateStr, setStartDateStr] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [zoomLevel, setZoomLevel] = useState<number>(95);
  const [currentStudentIndex, setCurrentStudentIndex] = useState<number>(0);

  // Template Builder / Edit Modal State
  const [editingTemplate, setEditingTemplate] = useState<AmalTrackerTemplate | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Evaluation Form Modal State
  const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);
  const [evalForm, setEvalForm] = useState<Partial<AmalEvaluationLog>>({
    grade: "মুমতাজ",
    totalDays: 7,
    completedDays: 7,
    totalScorePercentage: 95,
    parentSignatureCollected: true,
  });
  const [isSavingEval, setIsSavingEval] = useState(false);
  const [evalSearchQuery, setEvalSearchQuery] = useState("");

  // Selected Active Template
  const activeTemplate = useMemo(() => {
    return (
      templates.find((t) => t.id === selectedTemplateId) ||
      templates[0] ||
      WEEKLY_GENERAL_TEMPLATE
    );
  }, [templates, selectedTemplateId]);

  // Filtered Students based on selected class
  const filteredStudents = useMemo(() => {
    if (selectedClassId === "all") return students;
    return students.filter((s: any) => {
      const clsRel = Array.isArray(s.classes) ? s.classes[0] : s.classes;
      const sClassId = s.class_id || s.classId || clsRel?.id;
      const sClassName = clsRel?.name_bn || clsRel?.name || s.class_name;
      const targetClass = classes.find((c: any) => String(c.id) === String(selectedClassId));

      return (
        String(sClassId) === String(selectedClassId) ||
        (targetClass && sClassName && (targetClass.name === sClassName || targetClass.name_bn === sClassName))
      );
    });
  }, [students, classes, selectedClassId]);

  // Prepared Student Snapshots for Generation
  const studentSnapshots: AmalStudentSnapshot[] = useMemo(() => {
    if (printMode === "blank") {
      return [{ studentId: "blank", studentName: "" }];
    }

    if (printMode === "single") {
      const found = students.find((s: any) => String(s.id) === String(selectedStudentId));
      if (found) {
        return [buildAmalStudentSnapshot(found, classes)];
      }
      return [{ studentId: "blank", studentName: "" }];
    }

    // Bulk Mode: all filtered students
    if (filteredStudents.length === 0) {
      return [{ studentId: "blank", studentName: "" }];
    }

    return filteredStudents.map((s: any) => buildAmalStudentSnapshot(s, classes));
  }, [printMode, selectedStudentId, filteredStudents, students, classes]);

  // Current Student for Preview
  const currentPreviewStudent = studentSnapshots[currentStudentIndex] || studentSnapshots[0];

  // Print Handler (Triggers Native High-Resolution A4 Browser Print)
  const handlePrint = () => {
    window.print();
  };

  // Open Template Modal for Editing or New
  const handleOpenTemplateModal = (templateToEdit?: AmalTrackerTemplate) => {
    if (templateToEdit) {
      setEditingTemplate(JSON.parse(JSON.stringify(templateToEdit)));
    } else {
      // Create new template starting with weekly base
      const newTpl: AmalTrackerTemplate = {
        ...JSON.parse(JSON.stringify(WEEKLY_GENERAL_TEMPLATE)),
        id: `custom_amal_${Date.now()}`,
        title: "নতুন কাস্টম আমল ট্র্যাকার",
        code: "custom",
        isDefault: false,
        createdAt: new Date().toISOString(),
      };
      setEditingTemplate(newTpl);
    }
    setIsTemplateModalOpen(true);
  };

  // Save Template Action
  const handleSaveTemplate = async () => {
    if (!editingTemplate || !editingTemplate.title.trim()) {
      alert("অনুগ্রহ করে টেমপ্লেটের নাম প্রদান করুন।");
      return;
    }

    try {
      setIsSavingTemplate(true);
      const res = await saveAmalTrackerTemplate(editingTemplate);
      if (res.success && res.template) {
        setTemplates((prev) => {
          const index = prev.findIndex((t) => t.id === res.template!.id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = res.template!;
            return next;
          }
          return [res.template!, ...prev];
        });
        setSelectedTemplateId(res.template.id);
        setIsTemplateModalOpen(false);
        router.refresh();
      } else {
        alert(res.message || "সংরক্ষণে সমস্যা হয়েছে।");
      }
    } catch (err: any) {
      alert("ত্রুটি: " + err.message);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Delete Template Action
  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই টেমপ্লেটটি মুছে ফেলতে চান?")) return;
    try {
      const res = await deleteAmalTrackerTemplate(id);
      if (res.success) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        if (selectedTemplateId === id) {
          setSelectedTemplateId(WEEKLY_GENERAL_TEMPLATE.id);
        }
        router.refresh();
      } else {
        alert(res.message || "মুছে ফেলা সম্ভব হয়নি।");
      }
    } catch (err: any) {
      alert("ত্রুটি: " + err.message);
    }
  };

  // Save Evaluation Log
  const handleSaveEvaluation = async () => {
    if (!evalForm.studentName && !evalForm.studentId) {
      alert("শিক্ষার্থী নির্বাচন করুন বা নাম লিখুন।");
      return;
    }

    try {
      setIsSavingEval(true);
      const res = await saveAmalEvaluationLog({
        ...evalForm,
        templateId: activeTemplate.id,
        templateTitle: activeTemplate.title,
      });

      if (res.success && res.log) {
        setEvaluationLogs((prev) => {
          const index = prev.findIndex((l) => l.id === res.log!.id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = res.log!;
            return next;
          }
          return [res.log!, ...prev];
        });
        setIsEvalModalOpen(false);
        router.refresh();
      } else {
        alert(res.message || "সংরক্ষণে সমস্যা হয়েছে।");
      }
    } catch (err: any) {
      alert("ত্রুটি: " + err.message);
    } finally {
      setIsSavingEval(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden print:hidden border border-slate-800">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-xs font-semibold text-indigo-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>ছাত্রদের বাড়ির কর্মসূচি ও আমল ট্র্যাকার সিস্টেম</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span>বাড়ির কর্মসূচি ও আমল ট্র্যাকার</span>
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              ছুটি ও ছুটির দিনগুলোতে শিক্ষার্থীদের ৫ ওয়াক্ত নামাজ জামাতে আদায়, কুরআন তিলাওয়াত, কিতাব মুতালাআ ও পারিবারিক আদব তদারকি করার জন্য স্বয়ংক্রিয় A4 প্রিন্ট ও মূল্যায়ন সিস্টেম।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenTemplateModal()}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ নতুন আমল টেমপ্লেট তৈরি</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>১-ক্লিকে A4 প্রিন্ট / PDF</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/60 rounded-2xl p-3">
            <span className="text-slate-400 text-xs block">মোট টেমপ্লেট</span>
            <span className="text-xl font-bold text-white mt-0.5 block">
              {toBanglaNumber(templates.length)} টি
            </span>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/60 rounded-2xl p-3">
            <span className="text-slate-400 text-xs block">মোট শিক্ষার্থী ডাটা</span>
            <span className="text-xl font-bold text-indigo-400 mt-0.5 block">
              {toBanglaNumber(students.length)} জন
            </span>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/60 rounded-2xl p-3">
            <span className="text-slate-400 text-xs block">বর্তমান জামাত/ক্লাস</span>
            <span className="text-xl font-bold text-emerald-400 mt-0.5 block">
              {toBanglaNumber(classes.length)} টি
            </span>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/60 rounded-2xl p-3">
            <span className="text-slate-400 text-xs block">ডিজিটাল মূল্যায়ন রেকর্ড</span>
            <span className="text-xl font-bold text-amber-400 mt-0.5 block">
              {toBanglaNumber(evaluationLogs.length)} টি
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl max-w-xl print:hidden">
        <button
          type="button"
          onClick={() => setActiveTab("studio")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeTab === "studio"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Printer className="w-4 h-4 text-indigo-600" />
          <span>প্রিন্ট ও জেনারেশন স্টুডিও</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("templates")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeTab === "templates"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Layers className="w-4 h-4 text-emerald-600" />
          <span>টেমপ্লেট ও আমল কাস্টমাইজার</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("evaluation")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeTab === "evaluation"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Award className="w-4 h-4 text-amber-600" />
          <span>আমল মূল্যায়ন ও রেকর্ড খাতা</span>
        </button>
      </div>

      {/* TAB 1: STUDIO (PREVIEW & BULK PRINT) */}
      {activeTab === "studio" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4 print:hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Template Select */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                  <span>১. আমল ট্র্যাকার টেমপ্লেট:</span>
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none bg-slate-50/50 cursor-pointer"
                >
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.title} ({toBanglaNumber(tpl.durationDays)} দিন)
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Class Select */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                  <span>২. জামাত / বিভাগ:</span>
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value);
                    setCurrentStudentIndex(0);
                  }}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none bg-slate-50/50 cursor-pointer"
                >
                  <option value="all">সকল জামাত ({toBanglaNumber(students.length)} জন)</option>
                  {classes.map((cls: any) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name_bn || cls.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Print Mode Select */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>৩. প্রিন্ট মোড:</span>
                </label>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setPrintMode("bulk");
                      setCurrentStudentIndex(0);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer text-center ${
                      printMode === "bulk"
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    সম্পূর্ণ জামাত
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrintMode("single");
                      if (filteredStudents[0]) setSelectedStudentId(String(filteredStudents[0].id));
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer text-center ${
                      printMode === "single"
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    একক ছাত্র
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrintMode("blank")}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer text-center ${
                      printMode === "blank"
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    ব্ল্যাংক শিট
                  </button>
                </div>
              </div>

              {/* 4. Start Date */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>৪. কর্মসূচি শুরুর তারিখ:</span>
                </label>
                <input
                  type="date"
                  value={startDateStr}
                  onChange={(e) => setStartDateStr(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none bg-slate-50/50"
                />
              </div>
            </div>

            {/* Quick Optional Signature & Layout Toggles */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>প্রিন্ট শিট অপশন (ঐচ্ছিক):</span>
              </span>

              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                {/* 5 Waqt Imam Jamat Daily Signature Row Toggle */}
                <label className="flex items-center gap-1.5 bg-amber-50 text-amber-950 px-2.5 py-1 rounded-lg border border-amber-200 cursor-pointer hover:bg-amber-100 transition">
                  <input
                    type="checkbox"
                    checked={activeTemplate.showImamDailySignRow !== false}
                    onChange={(e) => {
                      const updated = templates.map((t) =>
                        t.id === activeTemplate.id
                          ? { ...t, showImamDailySignRow: e.target.checked }
                          : t
                      );
                      setTemplates(updated);
                    }}
                    className="w-3.5 h-3.5 text-amber-600 rounded focus:ring-0 cursor-pointer"
                  />
                  <span className="font-bold">ইমাম সাহেবের জামাত সত্যায়ন রো (টেবিল)</span>
                </label>

                {/* Imam Footer Signature Block Toggle */}
                <label className="flex items-center gap-1.5 bg-amber-50 text-amber-950 px-2.5 py-1 rounded-lg border border-amber-200 cursor-pointer hover:bg-amber-100 transition">
                  <input
                    type="checkbox"
                    checked={activeTemplate.showImamSign !== false}
                    onChange={(e) => {
                      const updated = templates.map((t) =>
                        t.id === activeTemplate.id
                          ? { ...t, showImamSign: e.target.checked }
                          : t
                      );
                      setTemplates(updated);
                    }}
                    className="w-3.5 h-3.5 text-amber-600 rounded focus:ring-0 cursor-pointer"
                  />
                  <span className="font-bold">মসজিদের ইমামের স্বাক্ষর (ফুটার)</span>
                </label>
              </div>
            </div>

            {/* If Single Student mode, show student picker */}
            {printMode === "single" && (
              <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
                <span className="text-xs font-bold text-slate-700 shrink-0">
                  ছাত্র নির্বাচন করুন:
                </span>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="max-w-md px-3 py-1.5 text-xs border border-slate-300 rounded-lg font-medium bg-white"
                >
                  {filteredStudents.map((s: any) => {
                    const snap = buildAmalStudentSnapshot(s, classes);
                    return (
                      <option key={s.id} value={s.id}>
                        {snap.studentName || `শিক্ষার্থী (${snap.studentRoll || s.id})`} {snap.className ? `[${snap.className}]` : ""} (রোল: {toBanglaNumber(snap.studentRoll || "০")})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          {/* Interactive Live A4 Preview Wrapper */}
          <div className="space-y-3 print:space-y-0">
            {/* Top Toolbar for Preview */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white px-5 py-3 rounded-2xl print:hidden shadow-md">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300">
                  {printMode === "bulk"
                    ? `বাল্ক ভিউ: পৃষ্ঠা ${toBanglaNumber(currentStudentIndex + 1)} / ${toBanglaNumber(
                        studentSnapshots.length
                      )} (${studentSnapshots.length} জন ছাত্রের প্রিন্ট রেডি)`
                    : printMode === "single"
                    ? "একক ছাত্রের প্রিভিউ"
                    : "ব্ল্যাংক শিট প্রিভিউ"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Previous / Next buttons for bulk mode */}
                {printMode === "bulk" && studentSnapshots.length > 1 && (
                  <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1">
                    <button
                      type="button"
                      disabled={currentStudentIndex === 0}
                      onClick={() => setCurrentStudentIndex((prev) => Math.max(0, prev - 1))}
                      className="p-1 hover:bg-slate-700 disabled:opacity-30 rounded-lg transition"
                      title="পূর্ববর্তী ছাত্র"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs px-2 font-mono">
                      {currentStudentIndex + 1} / {studentSnapshots.length}
                    </span>
                    <button
                      type="button"
                      disabled={currentStudentIndex === studentSnapshots.length - 1}
                      onClick={() =>
                        setCurrentStudentIndex((prev) =>
                          Math.min(studentSnapshots.length - 1, prev + 1)
                        )
                      }
                      className="p-1 hover:bg-slate-700 disabled:opacity-30 rounded-lg transition"
                      title="পরবর্তী ছাত্র"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Zoom Controls */}
                <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(65, z - 10))}
                    className="p-1 hover:bg-slate-700 rounded-lg transition"
                    title="জুম আউট"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs px-1 font-mono">{zoomLevel}%</span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
                    className="p-1 hover:bg-slate-700 rounded-lg transition"
                    title="জুম ইন"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Print Button */}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>
                    {printMode === "bulk"
                      ? `সকল ${toBanglaNumber(studentSnapshots.length)} জনের পাতা প্রিন্ট করুন`
                      : "প্রিন্ট / PDF"}
                  </span>
                </button>
              </div>
            </div>

            {/* Screen Preview Container (Shows 1 Sheet at a time with zoom) */}
            <div className="bg-slate-200/80 p-4 sm:p-8 rounded-3xl overflow-auto flex justify-center border border-slate-300 print:hidden">
              <div
                style={{
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: "top center",
                  transition: "transform 0.2s ease",
                }}
              >
                <AmalSheetA4
                  template={activeTemplate}
                  student={currentPreviewStudent}
                  madrasaInfo={madrasaInfo}
                  startDateStr={startDateStr}
                  isPreview={true}
                />
              </div>
            </div>

            {/* HIDDEN PRINT-ONLY CONTAINER: Renders ALL students for physical printer / PDF */}
            <div className="hidden print:block w-full">
              {studentSnapshots.map((snap, idx) => (
                <div key={snap.studentId + idx} className="print-page-break">
                  <AmalSheetA4
                    template={activeTemplate}
                    student={snap}
                    madrasaInfo={madrasaInfo}
                    startDateStr={startDateStr}
                    isPreview={false}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TEMPLATE BUILDER & AMAL ITEMS */}
      {activeTab === "templates" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                আমল ট্র্যাকার টেমপ্লেট ও কর্মসূচি তালিকা
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                মাদরাসার নিয়ম অনুযায়ী ট্র্যাকার টেমপ্লেট কাস্টমাইজ করুন বা নতুন বিষয় যুক্ত করুন।
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleOpenTemplateModal()}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md shadow-indigo-600/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ নতুন টেমপ্লেট যোগ করুন</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4 relative overflow-hidden group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-bold">
                      {toBanglaNumber(tpl.durationDays)} দিন মেয়াদী
                    </span>
                    {tpl.isDefault && (
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">
                        অফিসিয়াল
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-slate-900 group-hover:text-indigo-600 transition">
                      {tpl.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                      {tpl.description}
                    </p>
                  </div>

                  {/* Amal Items Count */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>মোট আমল / কর্মসূচি:</span>
                      <strong className="text-slate-900">{toBanglaNumber(tpl.items.length)} টি</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>ক্যাটাগরি:</span>
                      <strong className="text-slate-900">{toBanglaNumber(tpl.categories.length)} টি</strong>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemplateId(tpl.id);
                      setActiveTab("studio");
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-indigo-600" />
                    <span>প্রিন্ট করুন</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenTemplateModal(tpl)}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                      title="সম্পাদনা করুন"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    {!tpl.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(tpl.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: EVALUATION & GRADEBOOK */}
      {activeTab === "evaluation" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                আমল মূল্যায়ন ও পারফরম্যান্স খাতা
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                ছুটি শেষে জমা দেওয়া শিট দেখে শিক্ষক নম্বর ও অভিভাবক রেটিং সিস্টেমে সংরক্ষণ করতে পারেন।
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setEvalForm({
                  grade: "মুমতাজ",
                  totalDays: activeTemplate.durationDays || 7,
                  completedDays: activeTemplate.durationDays || 7,
                  totalScorePercentage: 95,
                  parentSignatureCollected: true,
                });
                setIsEvalModalOpen(true);
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ নতুন মূল্যায়ন এন্ট্রি</span>
            </button>
          </div>

          {/* Records Table */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <div className="relative max-w-sm w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="ছাত্রের নাম বা রোল দিয়ে খুঁজুন..."
                  value={evalSearchQuery}
                  onChange={(e) => setEvalSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>
              <span className="text-xs font-bold text-slate-500">
                মোট রেকর্ড: {toBanglaNumber(evaluationLogs.length)} টি
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3 text-center w-10">নং</th>
                    <th className="p-3">শিক্ষার্থী ও জামাত</th>
                    <th className="p-3">আমলনামার ধরন</th>
                    <th className="p-3 text-center">সময়কাল</th>
                    <th className="p-3 text-center">প্রাপ্ত গ্রেড</th>
                    <th className="p-3 text-center">অভিভাবক স্বাক্ষর</th>
                    <th className="p-3 text-center">কার্যক্রম</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {evaluationLogs
                    .filter((l) =>
                      evalSearchQuery
                        ? l.studentName.toLowerCase().includes(evalSearchQuery.toLowerCase()) ||
                          (l.studentRoll && l.studentRoll.includes(evalSearchQuery))
                        : true
                    )
                    .map((log, idx) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 text-center text-slate-500 font-mono">
                          {toBanglaNumber(idx + 1)}
                        </td>
                        <td className="p-3 font-semibold text-slate-900">
                          <div>{log.studentName}</div>
                          <div className="text-[11px] text-slate-500 font-normal">
                            রোল: {toBanglaNumber(log.studentRoll || "-")} | জামাত: {log.className || "-"}
                          </div>
                        </td>
                        <td className="p-3 text-slate-700 font-medium">
                          {log.templateTitle}
                        </td>
                        <td className="p-3 text-center text-slate-600">
                          {log.startDate} হতে {log.endDate}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-3 py-1 rounded-full font-bold text-[11px] ${
                              log.grade === "মুমতাজ"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : log.grade === "জায়্যিদ জিদ্দান"
                                ? "bg-blue-100 text-blue-800 border border-blue-300"
                                : "bg-amber-100 text-amber-800 border border-amber-300"
                            }`}
                          >
                            {log.grade}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {log.parentSignatureCollected ? (
                            <span className="text-emerald-600 font-bold flex items-center justify-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>সংগৃহীত</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">অনুপস্থিত</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm("রেকর্ডটি মুছে ফেলতে চান?")) {
                                await deleteAmalEvaluationLog(log.id);
                                setEvaluationLogs((prev) => prev.filter((l) => l.id !== log.id));
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}

                  {evaluationLogs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                        এখনো কোনো মূল্যায়ন রেকর্ড যুক্ত করা হয়নি।
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: TEMPLATE BUILDER & EDIT */}
      {isTemplateModalOpen && editingTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:hidden">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-scaleUp">
            <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <h3 className="font-black text-lg flex items-center gap-2">
                <Edit className="w-5 h-5 text-indigo-400" />
                <span>আমল ট্র্যাকার টেমপ্লেট সম্পাদনা</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(false)}
                className="p-1 hover:bg-white/10 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs sm:text-sm text-slate-800">
              {/* Template Title & Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="block font-bold text-slate-700">টেমপ্লেটের নাম:</label>
                  <input
                    type="text"
                    value={editingTemplate.title}
                    onChange={(e) =>
                      setEditingTemplate({ ...editingTemplate, title: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700">মেয়াদকাল (দিন):</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={editingTemplate.durationDays}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        durationDays: parseInt(e.target.value, 10) || 7,
                      })
                    }
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* Arabic Slogan */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  আরবি স্লোগান / কুরআনিক আয়াত:
                </label>
                <input
                  type="text"
                  value={editingTemplate.arabicSlogan}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate, arabicSlogan: e.target.value })
                  }
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl font-arabic text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Naseehat Text */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  অভিভাবকের প্রতি বিনীত নসিহত:
                </label>
                <textarea
                  rows={3}
                  value={editingTemplate.naseehatText}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate, naseehatText: e.target.value })
                  }
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Template Feature Toggles & Signatures */}
              <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="block font-bold text-slate-800 text-xs">
                  স্বাক্ষর ও শিট লেআউট কনফিগারেশন:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 text-slate-800 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingTemplate.showImamDailySignRow !== false}
                      onChange={(e) =>
                        setEditingTemplate({
                          ...editingTemplate,
                          showImamDailySignRow: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span>৫ ওয়াক্তের নিচে ইমামের জামাত সত্যায়ন রো</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-800 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingTemplate.showImamSign !== false}
                      onChange={(e) =>
                        setEditingTemplate({
                          ...editingTemplate,
                          showImamSign: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span>ফুটার সেকশনে ইমামের মূল স্বাক্ষর বক্স</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-800 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingTemplate.showGradeEvaluation !== false}
                      onChange={(e) =>
                        setEditingTemplate({
                          ...editingTemplate,
                          showGradeEvaluation: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span>অভিভাবক সামগ্রিক গ্রেড মূল্যায়ন স্কেল</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-800 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingTemplate.showWatermark !== false}
                      onChange={(e) =>
                        setEditingTemplate({
                          ...editingTemplate,
                          showWatermark: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span>পৃষ্ঠায় মাদরাসার হালকা জলছাপ (Watermark)</span>
                  </label>
                </div>
              </div>

              {/* Items List inside this Template */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-800">
                    আমল ও কর্মসূচির বিষয়সমূহ ({toBanglaNumber(editingTemplate.items.length)} টি):
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const newItem = {
                        id: `item_${Date.now()}`,
                        categoryId: editingTemplate.categories[0]?.id || "ibadat",
                        name: "নতুন আমল/বিষয়",
                        subtitle: "১ পৃষ্ঠা / নির্দিষ্ট সময়",
                        type: "checkbox" as const,
                        weight: 10,
                      };
                      setEditingTemplate({
                        ...editingTemplate,
                        items: [...editingTemplate.items, newItem],
                      });
                    }}
                    className="text-xs px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-bold transition flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ বিষয় যোগ করুন</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {editingTemplate.items.map((item, iIdx) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <span className="font-mono text-xs text-slate-400 w-5 text-center">
                        {iIdx + 1}
                      </span>
                      <input
                        type="text"
                        value={item.name}
                        placeholder="আমলের নাম (যেমন: ফজর নামাজ জামাতে)"
                        onChange={(e) => {
                          const updated = [...editingTemplate.items];
                          updated[iIdx].name = e.target.value;
                          setEditingTemplate({ ...editingTemplate, items: updated });
                        }}
                        className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                      <input
                        type="text"
                        value={item.subtitle || ""}
                        placeholder="বিবরণ/শর্ত"
                        onChange={(e) => {
                          const updated = [...editingTemplate.items];
                          updated[iIdx].subtitle = e.target.value;
                          setEditingTemplate({ ...editingTemplate, items: updated });
                        }}
                        className="w-32 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                      <select
                        value={item.categoryId}
                        onChange={(e) => {
                          const updated = [...editingTemplate.items];
                          updated[iIdx].categoryId = e.target.value;
                          setEditingTemplate({ ...editingTemplate, items: updated });
                        }}
                        className="w-32 px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        {editingTemplate.categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name.split(" ")[0]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = editingTemplate.items.filter((_, idx) => idx !== iIdx);
                          setEditingTemplate({ ...editingTemplate, items: updated });
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={isSavingTemplate}
                onClick={handleSaveTemplate}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingTemplate ? "সংরক্ষণ হচ্ছে..." : "টেমপ্লেট সংরক্ষণ করুন"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EVALUATION ENTRY */}
      {isEvalModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:hidden">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp">
            <div className="p-5 bg-gradient-to-r from-emerald-900 to-slate-900 text-white flex items-center justify-between">
              <h3 className="font-black text-lg flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-400" />
                <span>আমলনামা মূল্যায়ন এন্ট্রি</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEvalModalOpen(false)}
                className="p-1 hover:bg-white/10 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs sm:text-sm text-slate-800">
              {/* Student Picker */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">শিক্ষার্থী নির্বাচন:</label>
                <select
                  value={evalForm.studentId || ""}
                  onChange={(e) => {
                    const st = students.find((s: any) => String(s.id) === e.target.value);
                    if (st) {
                      const snap = buildAmalStudentSnapshot(st, classes);
                      setEvalForm({
                        ...evalForm,
                        studentId: snap.studentId,
                        studentName: snap.studentName,
                        studentRoll: snap.studentRoll,
                        className: snap.className,
                        parentPhone: snap.guardianPhone,
                      });
                    }
                  }}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-medium outline-none bg-slate-50"
                >
                  <option value="">ছাত্র নির্বাচন করুন...</option>
                  {students.map((st: any) => {
                    const snap = buildAmalStudentSnapshot(st, classes);
                    return (
                      <option key={st.id} value={st.id}>
                        {snap.studentName || `শিক্ষার্থী (${st.id})`} {snap.className ? `(${snap.className})` : ""} - রোল: {toBanglaNumber(snap.studentRoll || "০")}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Grade Picker */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">প্রাপ্ত মূল্যায়ন গ্রেড:</label>
                <select
                  value={evalForm.grade || "মুমতাজ"}
                  onChange={(e) => setEvalForm({ ...evalForm, grade: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-bold text-emerald-800 outline-none bg-slate-50"
                >
                  <option value="মুমতাজ">মুমতাজ (১০০% আমল ও জামাত)</option>
                  <option value="জায়্যিদ জিদ্দান">জায়্যিদ জিদ্দান (অধিকাংশ আদায়)</option>
                  <option value="জায়্যিদ">জায়্যিদ (সন্তোষজনক)</option>
                  <option value="মেহনত প্রয়োজন">মেহনত প্রয়োজন</option>
                </select>
              </div>

              {/* Parent Signature Checkbox */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={evalForm.parentSignatureCollected}
                  onChange={(e) =>
                    setEvalForm({ ...evalForm, parentSignatureCollected: e.target.checked })
                  }
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span className="font-semibold text-xs text-slate-800">
                  অভিভাবকের স্বাক্ষর ও তারিখ সংগৃহীত হয়েছে
                </span>
              </label>

              {/* Teacher Remarks */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">উস্তাদের মন্তব্য:</label>
                <textarea
                  rows={2}
                  placeholder="যেমন: মাশাআল্লাহ, ছুটির দিনগুলোতে নিয়মিত আমল হয়েছে।"
                  value={evalForm.teacherRemarks || ""}
                  onChange={(e) => setEvalForm({ ...evalForm, teacherRemarks: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs outline-none"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEvalModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={isSavingEval}
                onClick={handleSaveEvaluation}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingEval ? "সংরক্ষণ হচ্ছে..." : "মূল্যায়ন সংরক্ষণ করুন"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
