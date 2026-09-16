"use client";

import { useState, useRef, useMemo, DragEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
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
  FileCheck2,
  Sparkles,
  HeartHandshake,
  CreditCard,
  Package,
  CalendarDays,
  ShieldCheck,
  UserPlus,
  Scroll,
  FileQuestion,
  Receipt,
  TrendingDown,
  Gift,
  Globe,
  BadgeCheck,
  FileCheck,
  MessageSquare,
  UserCheck,
  ShieldAlert,
  Search,
  Filter,
} from "lucide-react";
import {
  BackupOverviewStats,
  BackupModuleKey,
  BackupPayload,
  BackupManifest,
  generateBackupExport,
  analyzeBackupFile,
  executeDataRestore,
} from "@/app/actions/backup";

export interface ModuleDefinition {
  key: BackupModuleKey;
  name: string;
  desc: string;
  category: "academic" | "finance" | "students" | "admin";
  countKey: string;
  icon: any;
  color: string;
}

const MODULE_DEFINITIONS: ModuleDefinition[] = [
  // 1. শিক্ষার্থী ও সেবা
  {
    key: "students",
    name: "শিক্ষার্থী ও প্রোফাইল ডাটাবেজ",
    desc: "সকল ছাত্র-ছাত্রীর স্থায়ী তথ্য, ছবি, অভিভাবক বিবরণ ও রোল/রেজিস্ট্রেশন",
    category: "students",
    countKey: "students",
    icon: Users,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  {
    key: "admissions",
    name: "অনলাইন ও অফলাইন ভর্তি আবেদন",
    desc: "নতুন ভর্তি ফর্ম, বাছাই পরীক্ষা, অনুমোদন হিস্ট্রি ও ফি পেমেন্ট স্লিপ",
    category: "students",
    countKey: "admissions",
    icon: UserPlus,
    color: "text-teal-600 bg-teal-50 border-teal-200",
  },
  {
    key: "id_cards",
    name: "ডিজিটাল স্মার্ট আইডি কার্ড",
    desc: "শিক্ষার্থী ও শিক্ষক আইডি কার্ড জেনারেশন, কিউআর কোড ও কাস্টম টেমপ্লেট",
    category: "students",
    countKey: "id_cards",
    icon: BadgeCheck,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
  },
  {
    key: "certificates",
    name: "সনদপত্র ও প্রত্যয়নপত্র",
    desc: "হিফজ সমাপ্তি সনদ, চারিত্রিক ও প্রশংসাপত্র এবং টেমপ্লেট রেজিস্টার",
    category: "students",
    countKey: "certificates",
    icon: FileCheck,
    color: "text-violet-600 bg-violet-50 border-violet-200",
  },
  {
    key: "leaves",
    name: "শিক্ষার্থী ও শিক্ষক ছুটির আবেদন",
    desc: "অনুমোদিত ছুটির রেকর্ড, কারণ, সময়সীমা ও হোস্টেল গেটপাস হিস্ট্রি",
    category: "students",
    countKey: "leaves",
    icon: CalendarDays,
    color: "text-cyan-600 bg-cyan-50 border-cyan-200",
  },
  {
    key: "alumni",
    name: "কওমি অ্যালামনাই নেটওয়ার্ক",
    desc: "ফারেগীন/গ্র্যাজুয়েট ডাটাবেজ, পেশা, মোবাইল ও ব্যাচ বিবরণী",
    category: "students",
    countKey: "alumni",
    icon: UserCheck,
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },

  // 2. অ্যাকাডেমিক ও শিক্ষা
  {
    key: "academic",
    name: "জামাত, বিষয় ও সিলেবাস",
    desc: "মারহালা, জামাত/শাখা, বিষয় বণ্টন, কিতাব তালিকা ও বার্ষিক সিলেবাস",
    category: "academic",
    countKey: "subjects",
    icon: BookOpen,
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  {
    key: "routines",
    name: "ক্লাস ও পরীক্ষার রুটিন",
    desc: "পিরিয়ডভিত্তিক সাপ্তাহিক ক্লাস শিডিউল ও বার্ষিক পরীক্ষার সময়সূচি",
    category: "academic",
    countKey: "routines",
    icon: CalendarCheck,
    color: "text-sky-600 bg-sky-50 border-sky-200",
  },
  {
    key: "hifz_kitab",
    name: "হিফজুল কুরআন ও কিতাব দৈনিক অগ্রগতি",
    desc: "সবক, সাত সবক, আমোখতা, দৈনিক তিলাওয়াত ও কিতাব দরসের প্রগ্রেস লগ",
    category: "academic",
    countKey: "hifz_kitab",
    icon: Scroll,
    color: "text-emerald-700 bg-emerald-50 border-emerald-300",
  },
  {
    key: "attendance",
    name: "হাজিরা ও বায়োমেট্রিক ট্র্যাকিং",
    desc: "শিক্ষার্থী ও উস্তাদগণের দৈনিক উপস্থিতি, অনুপস্থিতি ও বিলম্ব হিস্ট্রি",
    category: "academic",
    countKey: "attendance_records",
    icon: CalendarCheck,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
  {
    key: "exams",
    name: "পরীক্ষা ও মেধা মূল্যায়ন",
    desc: "সাময়িক ও বার্ষিক পরীক্ষা, বিষয়ভিত্তিক নম্বর ও মেধা তালিকা",
    category: "academic",
    countKey: "exams",
    icon: Award,
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  {
    key: "question_bank",
    name: "প্রশ্নব্যাংক ও ডিজিটাল প্রশ্নপত্র",
    desc: "অধ্যায়ভিত্তিক প্রশ্নসমূহ, মার্কস ও প্রিন্ট উপযোগী ডিজিটাল পরীক্ষার প্রশ্ন",
    category: "academic",
    countKey: "question_bank",
    icon: FileQuestion,
    color: "text-orange-600 bg-orange-50 border-orange-200",
  },

  // 3. হিসাব ও তহবিল সংগ্রহ (Finance & Fundraising)
  {
    key: "fees",
    name: "শিক্ষার্থী ফি ও বকেয়া খাতা",
    desc: "মাসিক বেতন, খোরাকি, ভর্তি ফি কাঠামো, বকেয়া খাতা ও বিশেষ ছাড়",
    category: "finance",
    countKey: "fees",
    icon: Receipt,
    color: "text-teal-600 bg-teal-50 border-teal-200",
  },
  {
    key: "finance_transactions",
    name: "ফি আদায়, রসিদ ও ক্যাশবুক",
    desc: "সকল ক্যাশ ও ডিজিটাল পেমেন্ট রসিদ, দৈনিক ক্যাশবুক ও অডিট রেকর্ড",
    category: "finance",
    countKey: "finance_transactions",
    icon: CreditCard,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  {
    key: "expenses",
    name: "সাধারণ ব্যয় ও মেস বাজার খরচ",
    desc: "ভাউচারভিত্তিক মাদরাসা খরচ, মেস বাজার ও রক্ষণাবেক্ষণ ব্যয়",
    category: "finance",
    countKey: "expenses",
    icon: TrendingDown,
    color: "text-rose-600 bg-rose-50 border-rose-200",
  },
  {
    key: "zakat_donations",
    name: "যাকাত ও অনুদান সংগ্রহ",
    desc: "যাকাত, লিল্লাহ বোর্ডিং, ইমদাদী অনুদান, সাধারণ দান ও মানি রসিদ",
    category: "finance",
    countKey: "zakat_donations",
    icon: HeartHandshake,
    color: "text-rose-700 bg-rose-50 border-rose-200",
  },
  {
    key: "donors_funds",
    name: "কেন্দ্রীয় দাতা রেজিস্টার ও ফান্ড",
    desc: "স্থায়ী শুভাকাঙ্ক্ষী, দাতা তালিকা, ক্যাটাগরি ও ডেডিকেটেড ফান্ডসমূহ",
    category: "finance",
    countKey: "donors_funds",
    icon: Users,
    color: "text-fuchsia-600 bg-fuchsia-50 border-fuchsia-200",
  },
  {
    key: "fundraising_special",
    name: "বিশেষ তহবিল সংগ্রহ",
    desc: "বার্ষিক মাহফিল, কোরবানির চামড়া, আজীবন সদস্য চাঁদা ও দান বাক্স",
    category: "finance",
    countKey: "fundraising_special",
    icon: Gift,
    color: "text-amber-700 bg-amber-50 border-amber-200",
  },
  {
    key: "payment_gateway",
    name: "অনলাইন পেমেন্ট গেটওয়ে ও ট্রানজেকশন",
    desc: "বিকাশ, নগদ, রকেট, ব্যাংক ও অনলাইন ডোনেশন গেটওয়ে ট্রানজেকশন লগ",
    category: "finance",
    countKey: "payment_gateway",
    icon: Globe,
    color: "text-sky-600 bg-sky-50 border-sky-200",
  },

  // 4. প্রশাসন, মেস ও অন্যান্য
  {
    key: "boarding",
    name: "বোর্ডিং, মেস ও মিল রেজিস্টার",
    desc: "আবাসিক ছাত্রদের সকাল, দুপুর ও রাতের মিল হিসাব ও ডাইনিং লগ",
    category: "admin",
    countKey: "boarding_meals",
    icon: UtensilsCrossed,
    color: "text-pink-600 bg-pink-50 border-pink-200",
  },
  {
    key: "library",
    name: "গ্রন্থাগার ও কিতাব ইস্যু/রিটার্ন",
    desc: "কুতুবখানার বইয়ের ক্যাটালগ, আলমারি নম্বর ও শিক্ষার্থী ইস্যু রেজিস্টার",
    category: "admin",
    countKey: "library_books",
    icon: Library,
    color: "text-sky-600 bg-sky-50 border-sky-200",
  },
  {
    key: "inventory",
    name: "সম্পদ ও ইনভেন্টরি মজুদ",
    desc: "মাদরাসার স্থায়ী সম্পদ, আসবাবপত্র, ইলেকট্রনিক্স ও স্টক সামগ্রী",
    category: "admin",
    countKey: "inventory_items",
    icon: Package,
    color: "text-amber-800 bg-amber-50 border-amber-300",
  },
  {
    key: "staff",
    name: "শিক্ষক, স্টাফ ও ইউজার রোল",
    desc: "মুহতামিম, নাযেমে তালিমাত, শিক্ষকবৃন্দের প্রোফাইল ও অ্যাক্সেস পারমিশন",
    category: "admin",
    countKey: "teachers_staff",
    icon: GraduationCap,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
  },
  {
    key: "communication",
    name: "অভিভাবক যোগাযোগ ও কমপ্লেইন্ট",
    desc: "অভিভাবকদের মতামত, অভিযোগ ও সাক্ষাতের শিডিউল রেজিস্টার",
    category: "admin",
    countKey: "parent_feedbacks",
    icon: MessageSquare,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
  {
    key: "notices_sms",
    name: "নোটিশ বোর্ড ও বাল্ক এসএমএস",
    desc: "বিজ্ঞপ্তি প্রকাশ, এসএমএস নোটিফিকেশন লগ ও মেসেজ টেমপ্লেট",
    category: "admin",
    countKey: "notices_sms",
    icon: Bell,
    color: "text-orange-600 bg-orange-50 border-orange-200",
  },
  {
    key: "settings",
    name: "শিক্ষাবর্ষ, সেশন ও সেটিংস",
    desc: "প্রতিষ্ঠানের প্রোফাইল, শিক্ষাবর্ষ, ছুটির ক্যালেন্ডার ও কনফিগারেশন",
    category: "admin",
    countKey: "sessions_settings",
    icon: Sliders,
    color: "text-slate-600 bg-slate-100 border-slate-200",
  },
  {
    key: "audit_logs",
    name: "অডিট ট্রেইল ও সিকিউরিটি লগ",
    desc: "সিস্টেম অ্যাক্টিভিটি হিস্ট্রি, ব্যাকআপ রেকর্ড ও ডাটা ট্র্যাকিং লগ",
    category: "admin",
    countKey: "audit_logs",
    icon: ShieldAlert,
    color: "text-slate-700 bg-slate-100 border-slate-300",
  },
];

export default function BackupClient({
  initialStats,
}: {
  initialStats: BackupOverviewStats;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"export" | "restore" | "history">("export");
  const [stats] = useState<BackupOverviewStats>(initialStats);

  // Category and Search Filtering States
  const [selectedCategory, setSelectedCategory] = useState<"all" | "academic" | "finance" | "students" | "admin">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Export States
  const [selectedExportModules, setSelectedExportModules] = useState<BackupModuleKey[]>(
    MODULE_DEFINITIONS.map((m) => m.key)
  );
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
  const [selectedRestoreModules, setSelectedRestoreModules] = useState<BackupModuleKey[]>(
    MODULE_DEFINITIONS.map((m) => m.key)
  );
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

  // Filtered Modules for Export UI
  const filteredModules = useMemo(() => {
    return MODULE_DEFINITIONS.filter((mod) => {
      const matchCategory = selectedCategory === "all" || mod.category === selectedCategory;
      const matchSearch =
        !searchQuery.trim() ||
        mod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mod.desc.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

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

  // 1-Click Instant Backup Action
  const handleDownloadBackup = async (modulesToExport?: BackupModuleKey[]) => {
    try {
      setIsExporting(true);
      setExportSuccessMessage(null);

      const modules = modulesToExport || selectedExportModules;
      if (modules.length === 0) {
        alert("অনুগ্রহ করে অন্তত একটি মডিউল নির্বাচন করুন।");
        setIsExporting(false);
        return;
      }

      const res = await generateBackupExport({
        modules: modules,
        format: exportFormat,
        includeMetadata: true,
      });

      if (!res.success || !res.backupJson) {
        throw new Error(res.error || "ব্যাকআপ এক্সপোর্ট ব্যর্থ হয়েছে।");
      }

      // Trigger Browser Download
      const blob = new Blob([res.backupJson], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", res.filename || `qawmi_backup_${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportSuccessMessage(
        `সফল হয়েছে! মাদরাসার সকল নির্বাচিত মডিউল ও ডায়নামিক মেটাডাটার ১০০% সুরক্ষিত ব্যাকআপ ডাউনলোড সম্পন্ন হয়েছে।`
      );
    } catch (err: any) {
      alert("ব্যাকআপ ডাউনলোডে ত্রুটি: " + (err.message || String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  // Drag & Drop File Handlers
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
      alert("অনুগ্রহ করে শুধুমাত্র বৈধ কওমি ব্যাকআপ .json ফাইল আপলোড করুন।");
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
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-md shadow-emerald-600/20">
                <Database className="w-6 h-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                ডাটা ব্যাকআপ ও রিস্টোর সেন্টার
              </h1>
              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs px-3 py-1 rounded-full font-bold border border-emerald-200">
                <Sparkles className="w-3.5 h-3.5" />
                <span>ইউনিভার্সাল জিরো-লস আর্কিটেকচার</span>
              </span>
            </div>
            <p className="text-slate-600 text-sm max-w-3xl leading-relaxed">
              যাকাত, ডোনেশন, শিক্ষার্থী, ফি লেজার, হিফজ অগ্রগতি, পরীক্ষা, আইডি কার্ড, মেস ও সেটিংসসহ মাদরাসার ২৬+ মডিউলের ১০০% ডাটা চিরতরে সুরক্ষিত ও স্বয়ংক্রিয় ব্যাকআপের আওতায়।
            </p>
          </div>

          {/* Quick 1-Click Universal Backup Button */}
          <button
            type="button"
            onClick={() => handleDownloadBackup(MODULE_DEFINITIONS.map((m) => m.key))}
            disabled={isExporting}
            className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/25 transition transform active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {isExporting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>পূর্ণাঙ্গ ব্যাকআপ প্রস্তুত হচ্ছে...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>১-ক্লিক সম্পূর্ণ ব্যাকআপ ডাউনলোড ({MODULE_DEFINITIONS.length} টি মডিউল)</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mt-8 pt-6 border-t border-slate-100">
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>সর্বমোট রেকর্ড</span>
            </div>
            <p className="text-lg sm:text-xl font-black text-slate-900 mt-1">
              {stats.total_records.toLocaleString("bn-BD")} টি
            </p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Users className="w-4 h-4 text-blue-600" />
              <span>ছাত্র ও ভর্তি</span>
            </div>
            <p className="text-lg sm:text-xl font-black text-slate-900 mt-1">
              {((stats.counts?.students || 0) + (stats.counts?.admissions || 0)).toLocaleString("bn-BD")} জন
            </p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Receipt className="w-4 h-4 text-teal-600" />
              <span>ফি ও আদায় রসিদ</span>
            </div>
            <p className="text-lg sm:text-xl font-black text-slate-900 mt-1">
              {((stats.counts?.fees || 0) + (stats.counts?.finance_transactions || 0)).toLocaleString("bn-BD")} টি
            </p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <HeartHandshake className="w-4 h-4 text-rose-600" />
              <span>যাকাত ও অনুদান</span>
            </div>
            <p className="text-lg sm:text-xl font-black text-slate-900 mt-1">
              {((stats.counts?.zakat_donations || 0) + (stats.counts?.fundraising_special || 0) + (stats.counts?.donors_funds || 0)).toLocaleString("bn-BD")} টি
            </p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Award className="w-4 h-4 text-amber-600" />
              <span>পরীক্ষা ও রেজাল্ট</span>
            </div>
            <p className="text-lg sm:text-xl font-black text-slate-900 mt-1">
              {((stats.counts?.exams || 0) + (stats.counts?.exam_results || 0) + (stats.counts?.question_bank || 0)).toLocaleString("bn-BD")} টি
            </p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Clock className="w-4 h-4 text-purple-600" />
              <span>সর্বশেষ ব্যাকআপ</span>
            </div>
            <p className="text-xs font-bold text-slate-800 mt-1.5 truncate">
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

        {/* Dynamic Zero-Maintenance Banner */}
        <div className="mt-4 p-3 bg-emerald-50/70 border border-emerald-200/70 rounded-2xl flex items-center justify-between gap-3 text-xs text-emerald-900">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>ইউনিভার্সাল জিরো-মেইনটেন্যান্স সিস্টেম সক্রিয়:</strong> ডাটাবেজে নতুন যেকোনো টেবিল বা মেটাডাটা যুক্ত হলে তা কোনো কোড পরিবর্তন ছাড়াই স্বয়ংক্রিয়ভাবে ব্যাকআপ ফাইলে অন্তর্ভুক্ত হয়ে যায়।
            </span>
          </div>
          <span className="hidden sm:inline-flex bg-white px-2.5 py-1 rounded-lg font-bold border border-emerald-200 text-[11px] text-emerald-800 shrink-0">
            মোট ২৬ টি স্বতন্ত্র মডিউল
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 bg-slate-200/70 p-1.5 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("export")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition cursor-pointer ${
            activeTab === "export"
              ? "bg-white text-emerald-700 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Download className="w-4 h-4" />
          <span>ব্যাকআপ তৈরি ও ডাউনলোড ({MODULE_DEFINITIONS.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("restore")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition cursor-pointer ${
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
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition cursor-pointer ${
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
                className="text-xs text-emerald-700 hover:underline font-bold cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          )}

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
            {/* Filter Bar & Category Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-emerald-600" />
                  <span>মডিউল নির্বাচন ও ব্যাকআপ সেটিংস</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  নিচের যেকোনো মডিউলের ডাটা পৃথকভাবে অথবা সব মডিউল একসাথে ব্যাকআপ ফাইল তৈরি করতে পারেন
                </p>
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="মডিউল খুঁজুন (যেমন: যাকাত, ফি...)"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Category Filter Pills & Selection Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    selectedCategory === "all"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  সকল মডিউল ({MODULE_DEFINITIONS.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory("academic")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    selectedCategory === "academic"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  অ্যাকাডেমিক ও শিক্ষা ({MODULE_DEFINITIONS.filter((m) => m.category === "academic").length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory("finance")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    selectedCategory === "finance"
                      ? "bg-teal-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  হিসাব ও তহবিল ({MODULE_DEFINITIONS.filter((m) => m.category === "finance").length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory("students")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    selectedCategory === "students"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  শিক্ষার্থী ও সেবা ({MODULE_DEFINITIONS.filter((m) => m.category === "students").length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory("admin")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    selectedCategory === "admin"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  প্রশাসন ও অন্যান্য ({MODULE_DEFINITIONS.filter((m) => m.category === "admin").length})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleAllExportModules}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  {selectedExportModules.length === MODULE_DEFINITIONS.length
                    ? "সবগুলো আনচেক করুন"
                    : "সবগুলো নির্বাচন করুন"}
                </button>
              </div>
            </div>

            {/* Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredModules.map((mod) => {
                const Icon = mod.icon;
                const isChecked = selectedExportModules.includes(mod.key);
                const liveCount = (stats.counts as any)?.[mod.countKey] || 0;

                return (
                  <div
                    key={mod.key}
                    onClick={() => toggleExportModule(mod.key)}
                    className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3.5 relative overflow-hidden ${
                      isChecked
                        ? "border-emerald-500 bg-emerald-50/40 shadow-xs"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // handled by parent div
                      className="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`p-1.5 rounded-lg border shrink-0 ${mod.color}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {mod.name}
                          </h4>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {mod.desc}
                      </p>
                      <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-100/80">
                        <span className="text-[11px] font-semibold text-slate-400">বর্তমান ডাটা:</span>
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                          {liveCount.toLocaleString("bn-BD")} টি রেকর্ড
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredModules.length === 0 && (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-xs">
                কোনো মডিউল পাওয়া যায়নি। অনুগ্রহ করে অনুসন্ধান কীওয়ার্ড পরিবর্তন করুন।
              </div>
            )}

            {/* Export Format & Trigger */}
            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-600">ফাইল ফরম্যাট:</span>
                <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setExportFormat("formatted")}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                      exportFormat === "formatted" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600"
                    }`}
                  >
                    পাঠযোগ্য (Pretty JSON)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat("minified")}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
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
                ব্যাকআপ ফাইলটি স্মার্ট স্ক্যানারের মাধ্যমে যাচাই ও বিশ্লেষণ করা হচ্ছে...
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
                      {analyzedData.manifest?.version || "3.0"} • জেনারেট:{" "}
                      {analyzedData.manifest?.generated_at
                        ? new Date(analyzedData.manifest.generated_at).toLocaleString("bn-BD")
                        : "N/A"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={resetRestoreFile}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition shrink-0 cursor-pointer"
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
                  <span>ফাইলে প্রাপ্ত ডাটার পূর্ণাঙ্গ বিবরণ (মোট {analyzedData.totalRecords || 0} টি রেকর্ড)</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {Object.entries(analyzedData.moduleCounts || {}).map(([key, count]) => {
                    if (count === 0) return null;
                    const matchedMod = MODULE_DEFINITIONS.find((m) => m.key === key);
                    const label = matchedMod ? matchedMod.name : key.replace(/_/g, " ");

                    return (
                      <div key={key} className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <span className="text-[11px] font-medium text-slate-500 capitalize block truncate">
                          {label}
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
                        className="w-4 h-4 text-emerald-600 cursor-pointer"
                      />
                      <span className="font-bold text-sm text-slate-900">
                        স্মার্ট মার্জ (Smart Merge - Recommended)
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed pl-6">
                      বিদ্যমান ডাটা সুরক্ষিত থাকবে। ব্যাকআপের নতুন ডাটা যোগ হবে এবং মেটাডাটা নিরাপদে সিঙ্ক হবে।
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
                        className="w-4 h-4 text-rose-600 cursor-pointer"
                      />
                      <span className="font-bold text-sm text-rose-900">
                        ক্লিন রিপ্লেস (Clean Overwrite)
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed pl-6">
                      বর্তমান ডাটাবেজ খালি করে ব্যাকআপের সম্পূর্ণ নতুন তথ্য স্থাপন করবে।
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
                  <div className="space-y-1">
                    <p className="font-bold">{restoreResult.message}</p>
                    {restoreResult.totalRestored !== undefined && (
                      <p className="text-xs">
                        সর্বমোট {restoreResult.totalRestored.toLocaleString("bn-BD")} টি রেকর্ড সফলভাবে রিস্টোর হয়েছে।
                      </p>
                    )}
                    {restoreResult.error && (
                      <p className="text-xs text-rose-700 font-mono mt-1">
                        ত্রুটির বিবরণ: {restoreResult.error}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-4 flex items-center justify-end">
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
                      <span>রিস্টোর প্রক্রিয়া চলছে...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>
                        {restoreMode === "replace"
                          ? "ডাটাবেজ প্রতিস্থাপন ও সম্পূর্ণ রিস্টোর করুন"
                          : "স্মার্ট মার্জ পদ্ধতিতে রিস্টোর সম্পন্ন করুন"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: HISTORY LOGS */}
      {activeTab === "history" && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" />
                <span>ব্যাকআপ ও রিস্টোর অ্যাক্টিভিটি হিস্ট্রি</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                প্রতিষ্ঠানের সর্বশেষ সকল ডাটা এক্সপোর্ট, সেফটি স্ন্যাপশট ও রিস্টোর হিস্ট্রি
              </p>
            </div>
          </div>

          {stats.history.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl border border-slate-200">
              এখনও পর্যন্ত কোনো ব্যাকআপ বা রিস্টোর হিস্ট্রি পাওয়া যায়নি।
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-800 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">তারিখ ও সময়</th>
                    <th className="p-3.5">অ্যাকশনের ধরন</th>
                    <th className="p-3.5">অপারেটর</th>
                    <th className="p-3.5">রেকর্ড সংখ্যা</th>
                    <th className="p-3.5">স্ট্যাটাস</th>
                    <th className="p-3.5">বিবরণ / নোট</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.history.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/60">
                      <td className="p-3.5 font-semibold text-slate-900 whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString("bn-BD", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[11px] ${
                            entry.type === "BACKUP_EXPORT"
                              ? "bg-emerald-100 text-emerald-800"
                              : entry.type === "AUTO_SNAPSHOT"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {entry.type === "BACKUP_EXPORT"
                            ? "এক্সপোর্ট ব্যাকআপ"
                            : entry.type === "AUTO_SNAPSHOT"
                            ? "সেফটি স্ন্যাপশট"
                            : "ডাটা রিস্টোর"}
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{entry.actor_name}</div>
                        <div className="text-[10px] text-slate-400">{entry.actor_email}</div>
                      </td>
                      <td className="p-3.5 font-bold text-slate-800 whitespace-nowrap">
                        {entry.total_records > 0
                          ? `${entry.total_records.toLocaleString("bn-BD")} টি`
                          : "স্বয়ংক্রিয়"}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            entry.status === "SUCCESS"
                              ? "text-emerald-600"
                              : entry.status === "WARNING"
                              ? "text-amber-600"
                              : "text-rose-600"
                          }`}
                        >
                          {entry.status === "SUCCESS" ? "সফল" : "ব্যর্থ"}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-600 max-w-xs truncate">
                        {entry.note || "সাধারণ সিস্টেম অপারেশন"}
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
