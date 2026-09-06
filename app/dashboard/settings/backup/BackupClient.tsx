"use client";

import { useState, useRef, useEffect, DragEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  FileJson,
  Layers,
  Clock,
  HardDrive,
  Users,
  BookOpen,
  Award,
  CalendarCheck,
  Wallet,
  GraduationCap,
  UtensilsCrossed,
  Library,
  Bell,
  Sliders,
  HelpCircle,
  FileCheck2,
  Trash2,
  ArrowRight,
  Info,
  Sparkles,
  Lock,
} from "lucide-react";
import {
  BackupOverviewStats,
  BackupModuleKey,
  BackupPayload,
  BackupManifest,
  BackupAuditEntry,
  generateBackupExport,
  analyzeBackupFile,
  executeDataRestore,
} from "@/app/actions/backup";

const MODULE_DEFINITIONS: {
  key: BackupModuleKey;
  name: string;
  desc: string;
  icon: any;
  color: string;
}[] = [
  {
    key: "students",
    name: "শিক্ষার্থী ও ভর্তি",
    desc: "সকল ছাত্র-ছাত্রী, প্রোফাইল, ভর্তি বিবরণ ও হিফজ/কিতাব লগ",
    icon: Users,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  {
    key: "academic",
    name: "একাডেমিক ও পাঠদান",
    desc: "জামাত/শাখা, বিষয়, শিক্ষক বণ্টন ও ক্লাস রুটিন",
    icon: BookOpen,
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  {
    key: "exams",
    name: "পরীক্ষা ও ফলাফল",
    desc: "পরীক্ষা, বিষয়ভিত্তিক নম্বর, প্রশ্নব্যাংক ও পাবলিশড রেজাল্ট",
    icon: Award,
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  {
    key: "attendance",
    name: "হাজিরা ও ছুটি",
    desc: "ছাত্র ও শিক্ষকদের দৈনিক উপস্থিতি এবং ছুটির রেকর্ড",
    icon: CalendarCheck,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
  {
    key: "finance",
    name: "হিসাব ও অনুদান",
    desc: "ছাত্রদের ফি আদায়, মাদরাসার খরচ, জাকাত ও ডোনার তহবিল",
    icon: Wallet,
    color: "text-teal-600 bg-teal-50 border-teal-200",
  },
  {
    key: "staff",
    name: "শিক্ষক ও স্টাফ",
    desc: "শিক্ষক প্রোফাইল এবং ইউজার লগইন তথ্য",
    icon: GraduationCap,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
  },
  {
    key: "boarding",
    name: "বোর্ডিং ও মিল",
    desc: "দৈনিক খাবার ও মেস ব্যবস্থাপনা সংক্রান্ত ডাটা",
    icon: UtensilsCrossed,
    color: "text-rose-600 bg-rose-50 border-rose-200",
  },
  {
    key: "library",
    name: "লাইব্রেরি ও কুতুবখানা",
    desc: "বইয়ের তালিকা ও ইস্যু/রিটার্ন ডাটা",
    icon: Library,
    color: "text-cyan-600 bg-cyan-50 border-cyan-200",
  },
  {
    key: "communication",
    name: "নোটিশ ও এসএমএস",
    desc: "বিজ্ঞপ্তি, এসএমএস টেমপ্লেট ও নোটিফিকেশন লগ",
    icon: Bell,
    color: "text-orange-600 bg-orange-50 border-orange-200",
  },
  {
    key: "settings",
    name: "মাদরাসা সেটিংস",
    desc: "প্রতিষ্ঠানের তথ্য, শিক্ষাবর্ষ ও ছুটির ক্যালেন্ডার",
    icon: Sliders,
    color: "text-slate-600 bg-slate-100 border-slate-200",
  },
];

export default function BackupClient({
  initialStats,
}: {
  initialStats: BackupOverviewStats;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"export" | "restore" | "history">("export");
  const [stats, setStats] = useState<BackupOverviewStats>(initialStats);

  // Export States
  const [selectedExportModules, setSelectedExportModules] = useState<BackupModuleKey[]>([
    "students",
    "academic",
    "attendance",
    "exams",
    "finance",
    "staff",
    "boarding",
    "library",
    "communication",
    "settings",
  ]);
  const [exportFormat, setExportFormat] = useState<"formatted" | "minified">("formatted");
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  // Restore States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [analyzingFile, setAnalyzingFile] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [analyzedData, setAnalyzedData] = useState<{
    isValid: boolean;
    manifest?: BackupManifest;
    moduleCounts?: Record<string, number>;
    totalRecords?: number;
    warnings?: string[];
    error?: string;
    parsedPayload?: BackupPayload;
  } | null>(null);

  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [selectedRestoreModules, setSelectedRestoreModules] = useState<BackupModuleKey[]>([
    "students",
    "academic",
    "attendance",
    "exams",
    "finance",
    "staff",
    "boarding",
    "library",
    "communication",
    "settings",
  ]);
  const [createAutoSnapshot, setCreateAutoSnapshot] = useState(true);
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{
    success: boolean;
    message: string;
    restoredStats?: Record<string, number>;
    totalRestored?: number;
    error?: string;
  } | null>(null);

  // Select all / Deselect all handlers
  const toggleAllExportModules = () => {
    if (selectedExportModules.length === MODULE_DEFINITIONS.length) {
      setSelectedExportModules([]);
    } else {
      setSelectedExportModules(MODULE_DEFINITIONS.map((m) => m.key));
    }
  };

  const toggleExportModule = (key: BackupModuleKey) => {
    setSelectedExportModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleRestoreModule = (key: BackupModuleKey) => {
    setSelectedRestoreModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // 1-Click Instant Backup Action
  const handleDownloadBackup = async (modulesToExport?: BackupModuleKey[]) => {
    try {
      setIsExporting(true);
      setExportSuccessMessage(null);

      const modules = modulesToExport || selectedExportModules;
      if (modules.length === 0) {
        alert("অনুগ্রহ করে কমপক্ষে একটি মডিউল নির্বাচন করুন।");
        setIsExporting(false);
        return;
      }

      const res = await generateBackupExport({
        modules,
        format: exportFormat,
        includeMetadata: true,
      });

      if (!res.success || !res.backupJson) {
        alert(res.error || "ব্যাকআপ তৈরিতে সমস্যা হয়েছে।");
        return;
      }

      // Trigger automatic browser download
      const blob = new Blob([res.backupJson], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = res.filename || `qawmi_backup_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportSuccessMessage(
        `সফলভাবে ব্যাকআপ ফাইল প্রস্তুত ও ডাউনলোড হয়েছে (${res.backupPayload?.manifest.total_records || 0} টি রেকর্ড)।`
      );

      // Refresh overview
      router.refresh();
    } catch (err: any) {
      alert("ব্যাকআপ ডাউনলোডে সমস্যা: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Drag & Drop
  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith(".json")) {
      alert("অনুগ্রহ করে একটি বৈধ .json ব্যাকআপ ফাইল সিলেক্ট করুন।");
      return;
    }
    setUploadedFile(file);
    setAnalyzingFile(true);
    setAnalyzedData(null);
    setRestoreResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const analysis = await analyzeBackupFile(content);
        setAnalyzedData(analysis);
        if (analysis.manifest?.modules) {
          setSelectedRestoreModules(analysis.manifest.modules);
        }
      } catch (err: any) {
        setAnalyzedData({
          isValid: false,
          error: "ফাইল রিডিং ব্যর্থ হয়েছে: " + err.message,
        });
      } finally {
        setAnalyzingFile(false);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!analyzedData?.parsedPayload) {
      alert("প্রথমে একটি বৈধ ব্যাকআপ ফাইল লোড করুন।");
      return;
    }

    if (restoreMode === "replace") {
      if (confirmPassphrase.trim().toUpperCase() !== "RESTORE") {
        alert("ক্লিন রিপ্লেস মোডের জন্য নিশ্চিতকরণ ঘরে 'RESTORE' টাইপ করুন।");
        return;
      }
    }

    const isConfirmed = window.confirm(
      restoreMode === "replace"
        ? "⚠️ সতর্কবার্তা: ক্লিন রিপ্লেস মোড নির্বাচিত মডিউলগুলোর বর্তমান ডাটা মুছে ফেলে ব্যাকআপের তথ্য স্থাপন করবে। আপনি কি নিশ্চিত?"
        : "আপনি কি ব্যাকআপের তথ্য বর্তমান ডাটাবেজে মার্জ ও আপডেট করতে চান?"
    );

    if (!isConfirmed) return;

    try {
      setIsRestoring(true);
      setRestoreResult(null);

      const res = await executeDataRestore({
        backupPayload: analyzedData.parsedPayload,
        restoreMode: restoreMode,
        selectedModules: selectedRestoreModules,
        createAutoSnapshot: createAutoSnapshot,
      });

      setRestoreResult(res);

      if (res.success) {
        router.refresh();
      }
    } catch (err: any) {
      setRestoreResult({
        success: false,
        message: "রিস্টোর ব্যর্থ হয়েছে।",
        error: err?.message || String(err),
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const resetRestoreFile = () => {
    setUploadedFile(null);
    setAnalyzedData(null);
    setRestoreResult(null);
    setConfirmPassphrase("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-fadeIn">
      {/* Top Banner & Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-md shadow-emerald-600/20">
                <Database className="w-6 h-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                ডাটা ব্যাকআপ ও রিস্টোর সেন্টার
              </h1>
              <span className="bg-emerald-100 text-emerald-800 text-xs px-3 py-1 rounded-full font-bold border border-emerald-200">
                ক্লাউড ভল্ট v2.5
              </span>
            </div>
            <p className="text-slate-600 text-sm max-w-3xl leading-relaxed">
              মাদরাসার সকল ছাত্র-ছাত্রী, ভর্তি, ফলাফল, হিসাব-নিকাশ, হাজিরা এবং সেটিংস নিরাপদে ব্যাকআপ রাখুন এবং যেকোনো প্রয়োজনে ১-ক্লিকে পুনরুদ্ধার করুন।
            </p>
          </div>

          {/* Quick 1-Click Backup Button */}
          <button
            type="button"
            onClick={() => handleDownloadBackup(MODULE_DEFINITIONS.map((m) => m.key))}
            disabled={isExporting}
            className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/25 transition transform active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {isExporting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>ব্যাকআপ প্রস্তুত হচ্ছে...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>১-ক্লিক সম্পূর্ণ ব্যাকআপ ডাউনলোড</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-100">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>সর্বমোট রেকর্ড</span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              {stats.total_records.toLocaleString("bn-BD")} টি
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Users className="w-4 h-4 text-blue-600" />
              <span>ছাত্র ও ভর্তি</span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              {stats.counts.students.toLocaleString("bn-BD")} জন
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Wallet className="w-4 h-4 text-teal-600" />
              <span>আর্থিক লেনদেন</span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              {stats.counts.fees_and_transactions.toLocaleString("bn-BD")} টি
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Clock className="w-4 h-4 text-purple-600" />
              <span>সর্বশেষ ব্যাকআপ</span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-800 mt-1.5 truncate">
              {stats.last_backup?.timestamp
                ? new Date(stats.last_backup.timestamp).toLocaleDateString("bn-BD", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "এখনও নেওয়া হয়নি"}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 bg-slate-200/70 p-1.5 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("export")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition ${
            activeTab === "export"
              ? "bg-white text-emerald-700 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Download className="w-4 h-4" />
          <span>ব্যাকআপ তৈরি ও ডাউনলোড</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("restore")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition ${
            activeTab === "restore"
              ? "bg-white text-emerald-700 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>ডাটা রিস্টোর / পুনরুদ্ধার</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition ${
            activeTab === "history"
              ? "bg-white text-emerald-700 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>অ্যাক্টিভিটি হিস্ট্রি লগ ({stats.history.length})</span>
        </button>
      </div>

      {/* TAB 1: EXPORT / CREATE BACKUP */}
      {activeTab === "export" && (
        <div className="space-y-6">
          {exportSuccessMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-emerald-800 animate-fadeIn">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{exportSuccessMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setExportSuccessMessage(null)}
                className="text-xs text-emerald-700 hover:underline font-bold"
              >
                বন্ধ করুন
              </button>
            </div>
          )}

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-emerald-600" />
                  <span>কাস্টম মডিউল নির্বাচন ও এক্সপোর্ট সেটিংস</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  যেসব মডিউলের তথ্য ব্যাকআপ ফাইলে অন্তর্ভুক্ত করতে চান তা নির্বাচন করুন
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleAllExportModules}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                >
                  {selectedExportModules.length === MODULE_DEFINITIONS.length
                    ? "সবগুলো বাদ দিন"
                    : "সবগুলো নির্বাচন করুন"}
                </button>
              </div>
            </div>

            {/* Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {MODULE_DEFINITIONS.map((mod) => {
                const Icon = mod.icon;
                const isChecked = selectedExportModules.includes(mod.key);

                return (
                  <div
                    key={mod.key}
                    onClick={() => toggleExportModule(mod.key)}
                    className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3.5 ${
                      isChecked
                        ? "border-emerald-500 bg-emerald-50/40 shadow-xs"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // handled by parent div
                      className="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg border ${mod.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 truncate">
                          {mod.name}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {mod.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Export Format & Trigger */}
            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-600">ফাইল ফরম্যাট:</span>
                <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setExportFormat("formatted")}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                      exportFormat === "formatted" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600"
                    }`}
                  >
                    পাঠযোগ্য (Pretty JSON)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat("minified")}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                      exportFormat === "minified" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600"
                    }`}
                  >
                    কম্প্রেসড (Minified)
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDownloadBackup()}
                disabled={isExporting || selectedExportModules.length === 0}
                className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>প্রস্তুত হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>নির্বাচিত ({selectedExportModules.length} টি) মডিউল ডাউনলোড করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RESTORE FROM BACKUP */}
      {activeTab === "restore" && (
        <div className="space-y-6">
          {/* File Upload / Drag and Drop Area */}
          {!uploadedFile && (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-10 sm:p-14 border-2 border-dashed rounded-3xl text-center cursor-pointer transition ${
                dragActive
                  ? "border-emerald-500 bg-emerald-50/60 scale-[0.99]"
                  : "border-slate-300 hover:border-emerald-400 bg-white"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="max-w-md mx-auto space-y-4">
                <div className="w-16 h-16 mx-auto bg-emerald-100 text-emerald-700 rounded-3xl flex items-center justify-center shadow-inner">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    ব্যাকআপ ফাইল (.json) এখানে এনে ছেড়ে দিন
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    অথবা আপনার কম্পিউটার বা মোবাইল থেকে ব্যাকআপ ফাইল নির্বাচন করতে ক্লিক করুন
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition">
                  <FileJson className="w-4 h-4 text-emerald-600" />
                  <span>ফাইল সিলেক্ট করুন</span>
                </div>
              </div>
            </div>
          )}

          {/* Loading File State */}
          {analyzingFile && (
            <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-800">
                ব্যাকআপ ফাইলটি যাচাই ও বিশ্লেষণ করা হচ্ছে...
              </p>
            </div>
          )}

          {/* Analyzed Backup File Preview & Configuration */}
          {analyzedData && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6 animate-fadeIn">
              {/* File Info Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
                    <FileCheck2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 truncate">
                      {uploadedFile?.name}
                    </h4>
                    <p className="text-xs text-slate-500">
                      সাইজ: {Math.round((uploadedFile?.size || 0) / 1024)} KB • সংস্করণ:{" "}
                      {analyzedData.manifest?.version || "2.0"} • জেনারেট:{" "}
                      {analyzedData.manifest?.generated_at
                        ? new Date(analyzedData.manifest.generated_at).toLocaleString("bn-BD")
                        : "N/A"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={resetRestoreFile}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition shrink-0"
                >
                  ফাইল বাতিল / অন্য ফাইল নির্বাচন
                </button>
              </div>

              {/* Warnings if any */}
              {analyzedData.warnings && analyzedData.warnings.length > 0 && (
                <div className="space-y-2">
                  {analyzedData.warnings.map((w, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Module Record Counts in File */}
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>ফাইলে প্রাপ্ত ডাটার বিবরণ (মোট {analyzedData.totalRecords || 0} টি রেকর্ড)</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {Object.entries(analyzedData.moduleCounts || {}).map(([key, count]) => {
                    if (count === 0) return null;
                    return (
                      <div key={key} className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <span className="text-[11px] font-medium text-slate-500 capitalize block truncate">
                          {key}
                        </span>
                        <span className="text-base font-bold text-slate-800">
                          {count.toLocaleString("bn-BD")} টি
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Restore Options: Mode & Safety Settings */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-600" />
                  <span>রিস্টোর মোড ও নিরাপত্তা নির্বাচন</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Merge Mode */}
                  <div
                    onClick={() => setRestoreMode("merge")}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition ${
                      restoreMode === "merge"
                        ? "border-emerald-500 bg-emerald-50/40"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={restoreMode === "merge"}
                        onChange={() => setRestoreMode("merge")}
                        className="w-4 h-4 text-emerald-600"
                      />
                      <span className="font-bold text-sm text-slate-900">
                        স্মার্ট মার্জ (Smart Merge - Recommended)
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed pl-6">
                      বিদ্যমান ডাটা মুছে যাবে না। নতুন রেকর্ডগুলো যোগ হবে এবং বিদ্যমান রেকর্ডের সাথে আপডেট হবে।
                    </p>
                  </div>

                  {/* Replace Mode */}
                  <div
                    onClick={() => setRestoreMode("replace")}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition ${
                      restoreMode === "replace"
                        ? "border-rose-500 bg-rose-50/40"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={restoreMode === "replace"}
                        onChange={() => setRestoreMode("replace")}
                        className="w-4 h-4 text-rose-600"
                      />
                      <span className="font-bold text-sm text-rose-900">
                        ক্লিন রিপ্লেস (Clean Overwrite)
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed pl-6">
                      নির্বাচিত মডিউলের বর্তমান ডাটা সম্পূর্ণ খালি করে ব্যাকআপের নতুন ডাটা দিয়ে ডাটাবেজ পুনর্গঠন করবে।
                    </p>
                  </div>
                </div>

                {/* Pre-Snapshot Checkbox */}
                <label className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createAutoSnapshot}
                    onChange={(e) => setCreateAutoSnapshot(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    রিস্টোর শুরুর পূর্বে বর্তমান অবস্থার একটি স্বয়ংক্রিয় সেফটি স্ন্যাপশট (Auto Safety Snapshot) সংরক্ষণ করুন
                  </span>
                </label>

                {/* Passphrase Confirmation for Clean Replace */}
                {restoreMode === "replace" && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
                    <label className="block text-xs font-bold text-rose-900">
                      নিরাপত্তা নিশ্চিতকরণ: নিচে &quot;RESTORE&quot; টাইপ করুন
                    </label>
                    <input
                      type="text"
                      value={confirmPassphrase}
                      onChange={(e) => setConfirmPassphrase(e.target.value)}
                      placeholder="RESTORE"
                      className="w-full sm:w-64 px-3.5 py-2 border border-rose-300 rounded-xl bg-white text-xs font-bold text-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-500 uppercase tracking-widest"
                    />
                  </div>
                )}
              </div>

              {/* Restore Result Notification */}
              {restoreResult && (
                <div
                  className={`p-4 rounded-2xl border flex items-start gap-3 text-sm ${
                    restoreResult.success
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-rose-50 border-rose-200 text-rose-900"
                  }`}
                >
                  {restoreResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h5 className="font-bold">{restoreResult.message}</h5>
                    {restoreResult.error && (
                      <p className="text-xs opacity-80 mt-1 font-mono">{restoreResult.error}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Execute Button */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleExecuteRestore}
                  disabled={isRestoring}
                  className={`px-8 py-3.5 text-white font-bold rounded-2xl shadow-lg transition flex items-center gap-2 text-sm disabled:opacity-50 cursor-pointer ${
                    restoreMode === "replace"
                      ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                      : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                  }`}
                >
                  {isRestoring ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>রিস্টোর সম্পন্ন হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>
                        {restoreMode === "replace"
                          ? "সম্পূর্ণ প্রতিস্থাপন ও রিস্টোর করুন"
                          : "ডাটা রিস্টোর ও মার্জ সম্পন্ন করুন"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AUDIT HISTORY LOG */}
      {activeTab === "history" && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" />
                <span>ব্যাকআপ ও রিস্টোর অ্যাক্টিভিটি হিস্ট্রি</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                কখন কে ব্যাকআপ ডাউনলোড বা ডাটা রিস্টোর করেছেন তার নিরাপদ অডিট রেকর্ড
              </p>
            </div>
          </div>

          {stats.history.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Database className="w-10 h-10 mx-auto opacity-40" />
              <p className="text-sm">এখনও কোনো ব্যাকআপ বা রিস্টোর রেকর্ড তৈরি হয়নি।</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="pb-3 px-3">অ্যাকশন টাইপ</th>
                    <th className="pb-3 px-3">তারিখ ও সময়</th>
                    <th className="pb-3 px-3">ইউজার / এডমিন</th>
                    <th className="pb-3 px-3">রেকর্ড সংখ্যা</th>
                    <th className="pb-3 px-3">স্ট্যাটাস</th>
                    <th className="pb-3 px-3">বিবরণ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.history.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                            log.type === "BACKUP_EXPORT"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : log.type === "RESTORE_MERGE"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : log.type === "RESTORE_REPLACE"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {log.type === "BACKUP_EXPORT" && <Download className="w-3 h-3" />}
                          {log.type.startsWith("RESTORE") && <Upload className="w-3 h-3" />}
                          {log.type === "AUTO_SNAPSHOT" && <HardDrive className="w-3 h-3" />}
                          {log.type === "BACKUP_EXPORT"
                            ? "এক্সপোর্ট ব্যাকআপ"
                            : log.type === "RESTORE_MERGE"
                            ? "মার্জ রিস্টোর"
                            : log.type === "RESTORE_REPLACE"
                            ? "রিপ্লেস রিস্টোর"
                            : "অটো স্ন্যাপশট"}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-slate-600 font-medium">
                        {new Date(log.timestamp).toLocaleString("bn-BD", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="font-bold text-slate-800">{log.actor_name}</div>
                        <div className="text-[10px] text-slate-400">{log.actor_email}</div>
                      </td>

                      <td className="py-3.5 px-3 font-bold text-slate-800">
                        {log.total_records ? log.total_records.toLocaleString("bn-BD") + " টি" : "—"}
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>সফল</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-slate-600 max-w-xs truncate" title={log.note}>
                        {log.note || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
