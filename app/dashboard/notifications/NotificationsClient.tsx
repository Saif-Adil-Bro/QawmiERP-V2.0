"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  Clock,
  MessageSquare,
  UserPlus,
  Filter,
  Search,
  RotateCw,
  Plus,
  Send,
  Calendar,
  ExternalLink,
  Shield,
  FileText,
  AlertTriangle,
  Info,
  CheckCheck,
  Printer,
  ChevronRight,
  ArrowUpDown,
  History,
  Activity,
  Layers,
  GraduationCap,
  BookOpen,
  DollarSign,
  Database,
  Users,
  Settings,
  Download,
  Trash2,
  Eye,
  Check,
  X,
  Laptop,
  Smartphone,
  Globe,
} from "lucide-react";
import {
  GlobalNotificationItem,
  NotificationStats,
  NotificationCategory,
  createSystemNotification,
} from "@/app/actions/notifications";
import {
  GlobalActivityLogItem,
  ActivityStats,
  ActivityModule,
  ActivityActionType,
  MODULE_BANGLA_NAMES,
} from "@/types/activity-logs";
import {
  getActivityLogs,
  recordActivityLog,
  clearOldActivityLogs,
} from "@/app/actions/activity-logs";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface NotificationsClientProps {
  initialNotifications: GlobalNotificationItem[];
  initialStats: NotificationStats;
  initialActivityLogs?: GlobalActivityLogItem[];
  initialActivityStats?: ActivityStats;
}

export default function NotificationsClient({
  initialNotifications,
  initialStats,
  initialActivityLogs = [],
  initialActivityStats = {
    totalLogs: 0,
    todayCount: 0,
    weekCount: 0,
    successCount: 0,
    moduleCounts: {},
  },
}: NotificationsClientProps) {
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab");

  // Main navigation tab: "notifications" | "activity"
  const [activeMainTab, setActiveMainTab] = useState<"notifications" | "activity">(
    urlTab === "activity" ? "activity" : "notifications"
  );

  // ==========================================
  // STATE: NOTIFICATIONS TAB
  // ==========================================
  const [notifications, setNotifications] = useState<GlobalNotificationItem[]>(initialNotifications);
  const [stats, setStats] = useState<NotificationStats>(initialStats);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [submittingNotice, setSubmittingNotice] = useState(false);
  const [noticeForm, setNoticeForm] = useState({
    title: "",
    description: "",
    category: "SYSTEM" as NotificationCategory,
    severity: "INFO" as "INFO" | "WARNING" | "SUCCESS" | "CRITICAL",
    link: "/dashboard",
  });
  const [feedbackMsg, setFeedbackMsg] = useState("");

  // ==========================================
  // STATE: ACTIVITY LOGS TAB
  // ==========================================
  const [activityLogs, setActivityLogs] = useState<GlobalActivityLogItem[]>(initialActivityLogs);
  const [activityStats, setActivityStats] = useState<ActivityStats>(initialActivityStats);
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);

  // Activity filters
  const [actSearch, setActSearch] = useState("");
  const [actModule, setActModule] = useState<string>("ALL");
  const [actActionType, setActActionType] = useState<string>("ALL");
  const [actTimeRange, setActTimeRange] = useState<"all" | "today" | "week" | "month">("all");
  const [actSeverity, setActSeverity] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"timeline" | "table">("timeline");

  // Activity modal states
  const [selectedLogDetail, setSelectedLogDetail] = useState<GlobalActivityLogItem | null>(null);
  const [isManualLogModalOpen, setIsManualLogModalOpen] = useState(false);
  const [submittingManualLog, setSubmittingManualLog] = useState(false);
  const [manualLogForm, setManualLogForm] = useState({
    title: "",
    description: "",
    module: "SETTINGS" as ActivityModule,
    action_type: "CREATE" as ActivityActionType,
    severity: "SUCCESS" as "SUCCESS" | "INFO" | "WARNING" | "CRITICAL",
  });
  const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(30);
  const [isCleaning, setIsCleaning] = useState(false);

  // Sync tab with URL if changed
  useEffect(() => {
    if (urlTab === "activity") {
      setActiveMainTab("activity");
    } else if (urlTab === "notifications") {
      setActiveMainTab("notifications");
    }
  }, [urlTab]);

  // ==========================================
  // FILTERED NOTIFICATIONS
  // ==========================================
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (selectedCategory !== "ALL" && item.category !== selectedCategory) {
        return false;
      }
      if (selectedStatus !== "ALL") {
        if (selectedStatus === "PENDING" && item.status !== "PENDING") return false;
        if (selectedStatus === "RESOLVED" && item.status !== "RESOLVED") return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchSender = item.senderName?.toLowerCase().includes(q) || false;
        const matchModule = item.sourceModule.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchSender && !matchModule) {
          return false;
        }
      }
      return true;
    });
  }, [notifications, selectedCategory, selectedStatus, searchQuery]);

  // ==========================================
  // FILTERED ACTIVITY LOGS
  // ==========================================
  const filteredActivityLogs = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;
    const startOfMonth = Date.now() - 30 * 24 * 60 * 60 * 1000;

    return activityLogs.filter((log) => {
      if (actModule !== "ALL" && log.module !== actModule) return false;
      if (actActionType !== "ALL" && log.action_type !== actActionType) return false;
      if (actSeverity !== "ALL" && log.severity !== actSeverity) return false;

      const logTime = new Date(log.timestamp).getTime();
      if (actTimeRange === "today" && logTime < startOfToday) return false;
      if (actTimeRange === "week" && logTime < startOfWeek) return false;
      if (actTimeRange === "month" && logTime < startOfMonth) return false;

      if (actSearch.trim()) {
        const q = actSearch.toLowerCase().trim();
        const matchTitle = log.title.toLowerCase().includes(q);
        const matchDesc = log.description.toLowerCase().includes(q);
        const matchActor = log.actor_name.toLowerCase().includes(q);
        const matchModule = log.module_name_bn.toLowerCase().includes(q);
        const matchIp = log.ip_address?.toLowerCase().includes(q) || false;
        if (!matchTitle && !matchDesc && !matchActor && !matchModule && !matchIp) {
          return false;
        }
      }

      return true;
    });
  }, [activityLogs, actModule, actActionType, actSeverity, actTimeRange, actSearch]);

  // Handle Refreshing Activity Logs
  const handleRefreshActivityLogs = async () => {
    try {
      setIsRefreshingLogs(true);
      const res = await getActivityLogs({ limit: 200 });
      if (res && res.success) {
        setActivityLogs(res.logs);
        setActivityStats(res.stats);
        setFeedbackMsg("অ্যাক্টিভিটি হিস্ট্রি লগ সফলভাবে হালনাগাদ হয়েছে!");
        setTimeout(() => setFeedbackMsg(""), 3000);
      }
    } catch (err: any) {
      alert("লগ রিফ্রেশ করতে সমস্যা হয়েছে।");
    } finally {
      setIsRefreshingLogs(false);
    }
  };

  // Handle Manual Log Submission
  const handleCreateManualLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualLogForm.title.trim() || !manualLogForm.description.trim()) {
      alert("অনুগ্রহ করে শিরোনাম ও বিবরণ প্রদান করুন।");
      return;
    }

    try {
      setSubmittingManualLog(true);
      const res = await recordActivityLog({
        title: manualLogForm.title,
        description: manualLogForm.description,
        module: manualLogForm.module,
        action_type: manualLogForm.action_type,
        severity: manualLogForm.severity,
        device: "ওয়েব অ্যাডমিন কনসোল",
      });

      if (res && res.success && res.log) {
        setActivityLogs([res.log, ...activityLogs]);
        setIsManualLogModalOpen(false);
        setManualLogForm({
          title: "",
          description: "",
          module: "SETTINGS",
          action_type: "CREATE",
          severity: "SUCCESS",
        });
        setFeedbackMsg("নতুন অ্যাডমিন অ্যাক্টিভিটি লগ সফলভাবে সংরক্ষিত হয়েছে!");
        setTimeout(() => setFeedbackMsg(""), 4000);
      } else {
        alert(res.error || "লগ সংরক্ষণ ব্যর্থ হয়েছে।");
      }
    } catch (err: any) {
      alert(err.message || "ত্রুটি হয়েছে।");
    } finally {
      setSubmittingManualLog(false);
    }
  };

  // Handle Log Cleanup
  const handleCleanupLogs = async () => {
    try {
      setIsCleaning(true);
      const res = await clearOldActivityLogs(cleanupDays);
      if (res && res.success) {
        await handleRefreshActivityLogs();
        setIsCleanupModalOpen(false);
        setFeedbackMsg(`${cleanupDays} দিনের পুরোনো ${toBanglaNumber(res.clearedCount || 0)} টি লগ ক্লিনআপ করা হয়েছে।`);
        setTimeout(() => setFeedbackMsg(""), 4000);
      } else {
        alert(res.error || "ক্লিনআপ ব্যর্থ হয়েছে।");
      }
    } catch (err: any) {
      alert(err.message || "ত্রুটি হয়েছে।");
    } finally {
      setIsCleaning(false);
    }
  };

  // Export Activity Logs as JSON
  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activityLogs, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `qawmi_activity_logs_${new Date().toISOString().split("T")[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export Activity Logs as CSV
  const handleExportCsv = () => {
    const headers = ["ID,Time,Module,Action_Type,Severity,Actor,Role,Title,Description,IP_Address"];
    const rows = activityLogs.map((l) => {
      const cleanDesc = `"${(l.description || "").replace(/"/g, '""')}"`;
      const cleanTitle = `"${(l.title || "").replace(/"/g, '""')}"`;
      return [
        l.id,
        l.timestamp,
        l.module_name_bn,
        l.action_type,
        l.severity,
        `"${l.actor_name}"`,
        `"${l.actor_role}"`,
        cleanTitle,
        cleanDesc,
        l.ip_address || "",
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent([headers, ...rows].join("\n"));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", csvContent);
    downloadAnchor.setAttribute("download", `qawmi_activity_audit_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Format Relative and Absolute Time
  const formatFullDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString("bn-BD", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  const formatRelativeTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return "এইমাত্র";
      if (diffMin < 60) return `${toBanglaNumber(diffMin)} মিনিট আগে`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${toBanglaNumber(diffHours)} ঘণ্টা আগে`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return "গতকাল";
      if (diffDays < 7) return `${toBanglaNumber(diffDays)} দিন আগে`;
      return d.toLocaleDateString("bn-BD");
    } catch {
      return isoStr;
    }
  };

  // Helper for Module Colors & Icons
  const getModuleConfig = (module: ActivityModule) => {
    switch (module) {
      case "STUDENTS":
        return {
          icon: Users,
          bg: "bg-emerald-100",
          text: "text-emerald-800",
          border: "border-emerald-200",
          badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-200",
        };
      case "ADMISSIONS":
        return {
          icon: UserPlus,
          bg: "bg-indigo-100",
          text: "text-indigo-800",
          border: "border-indigo-200",
          badgeBg: "bg-indigo-50 text-indigo-800 border-indigo-200",
        };
      case "ACADEMIC":
        return {
          icon: Layers,
          bg: "bg-cyan-100",
          text: "text-cyan-800",
          border: "border-cyan-200",
          badgeBg: "bg-cyan-50 text-cyan-800 border-cyan-200",
        };
      case "HIFZ":
        return {
          icon: BookOpen,
          bg: "bg-teal-100",
          text: "text-teal-800",
          border: "border-teal-200",
          badgeBg: "bg-teal-50 text-teal-800 border-teal-200",
        };
      case "ATTENDANCE":
        return {
          icon: Clock,
          bg: "bg-amber-100",
          text: "text-amber-800",
          border: "border-amber-200",
          badgeBg: "bg-amber-50 text-amber-800 border-amber-200",
        };
      case "EXAMS":
        return {
          icon: GraduationCap,
          bg: "bg-purple-100",
          text: "text-purple-800",
          border: "border-purple-200",
          badgeBg: "bg-purple-50 text-purple-800 border-purple-200",
        };
      case "FINANCE":
        return {
          icon: DollarSign,
          bg: "bg-emerald-100",
          text: "text-emerald-800",
          border: "border-emerald-200",
          badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-200",
        };
      case "BACKUP":
        return {
          icon: Database,
          bg: "bg-blue-100",
          text: "text-blue-800",
          border: "border-blue-200",
          badgeBg: "bg-blue-50 text-blue-800 border-blue-200",
        };
      case "COMMUNICATION":
        return {
          icon: MessageSquare,
          bg: "bg-rose-100",
          text: "text-rose-800",
          border: "border-rose-200",
          badgeBg: "bg-rose-50 text-rose-800 border-rose-200",
        };
      default:
        return {
          icon: Settings,
          bg: "bg-slate-100",
          text: "text-slate-800",
          border: "border-slate-200",
          badgeBg: "bg-slate-50 text-slate-800 border-slate-200",
        };
    }
  };

  const getActionTypeBadge = (action: ActivityActionType) => {
    switch (action) {
      case "CREATE":
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">নতুন তৈরি</span>;
      case "UPDATE":
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800">হালনাগাদ</span>;
      case "DELETE":
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800">মুছে ফেলা</span>;
      case "APPROVE":
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-100 text-teal-800">অনুমোদন</span>;
      case "PAYMENT":
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-green-100 text-green-800">ফি আদায়</span>;
      case "ATTENDANCE":
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">হাজিরা</span>;
      case "EXAM":
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800">পরীক্ষা</span>;
      case "BACKUP":
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800">ব্যাকআপ</span>;
      case "NOTICE":
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-pink-100 text-pink-800">নোটিশ</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800">{action}</span>;
    }
  };

  const getCategoryBadge = (category: NotificationCategory) => {
    switch (category) {
      case "LEAVE":
        return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">ছুটির আবেদন</span>;
      case "COMPLAINT":
        return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-900 border border-rose-200">অভিযোগ ও পরামর্শ</span>;
      case "ADMISSION":
        return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">ভর্তি আবেদন</span>;
      case "ACADEMIC":
        return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-900 border border-blue-200">অ্যাকাডেমিক</span>;
      default:
        return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">সিস্টেম নোটিশ</span>;
    }
  };

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeForm.title.trim() || !noticeForm.description.trim()) {
      alert("অনুগ্রহ করে নোটিশের শিরোনাম ও বিবরণ লিখুন।");
      return;
    }

    try {
      setSubmittingNotice(true);
      const res = await createSystemNotification({
        title: noticeForm.title,
        description: noticeForm.description,
        category: noticeForm.category,
        severity: noticeForm.severity,
        link: noticeForm.link,
      });

      if (res && res.success && res.notification) {
        setNotifications([res.notification, ...notifications]);
        setIsNewModalOpen(false);
        setNoticeForm({
          title: "",
          description: "",
          category: "SYSTEM",
          severity: "INFO",
          link: "/dashboard",
        });
        setFeedbackMsg("নতুন সিস্টেম নোটিশ সফলভাবে তৈরি ও সম্প্রচার হয়েছে!");
        setTimeout(() => setFeedbackMsg(""), 4000);
      } else {
        alert(res?.error || "নোটিশ সংরক্ষণ ব্যর্থ হয়েছে।");
      }
    } catch (err: any) {
      alert(err.message || "ত্রুটি হয়েছে।");
    } finally {
      setSubmittingNotice(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ========================================================
          PAGE HEADER
      ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              {activeMainTab === "notifications" ? (
                <Bell className="w-5 h-5" />
              ) : (
                <History className="w-5 h-5" />
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              {activeMainTab === "notifications"
                ? "বিজ্ঞপ্তি ও সতর্কতা (Notifications & Alerts)"
                : "গ্লোবাল অ্যাক্টিভিটি হিস্ট্রি লগ (Activity Audit Trail)"}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            {activeMainTab === "notifications"
              ? "মাদরাসার গুরুত্বপূর্ণ ইভেন্ট, ছুটির দরখাস্ত, অভিভাবকের অভিযোগ ও সিস্টেমের লাইভ অ্যালার্ট।"
              : "মাদরাসার সকল মডিউলের প্রশাসনিক, একাডেমিক ও আর্থিক কার্যক্রমের সম্পূর্ণ অডিট টাইমলাইন।"}
          </p>
        </div>

        {/* Global Action Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>প্রিন্ট / রিপোর্ট</span>
          </button>

          {activeMainTab === "notifications" ? (
            <button
              type="button"
              onClick={() => setIsNewModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>নতুন সিস্টেম নোটিশ পাঠান</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                title="CSV এক্সপোর্ট"
              >
                <Download className="w-4 h-4" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                title="JSON এক্সপোর্ট"
              >
                <Database className="w-4 h-4" />
                <span>JSON</span>
              </button>
              <button
                type="button"
                onClick={() => setIsManualLogModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>ম্যানুয়াল লগ এন্ট্রি</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-2xl flex items-center gap-2 text-xs sm:text-sm font-semibold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* ========================================================
          TOP NAVIGATION TABS (CRITICAL: Activity tab HAS NO count badge!)
      ======================================================== */}
      <div className="flex items-center p-1 bg-slate-100/90 rounded-2xl border border-slate-200 print:hidden">
        {/* Tab 1: Notifications & Alerts (Shows Unread Count Badge) */}
        <button
          type="button"
          onClick={() => setActiveMainTab("notifications")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeMainTab === "notifications"
              ? "bg-white text-emerald-800 shadow-xs border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>বিজ্ঞপ্তি ও সতর্কতা</span>
          {stats.unread > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-600 text-white shadow-2xs">
              {toBanglaNumber(stats.unread)} টি নতুন
            </span>
          )}
        </button>

        {/* Tab 2: Activity History Logs (CRITICAL: NO count badge show korbe na!) */}
        <button
          type="button"
          onClick={() => setActiveMainTab("activity")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeMainTab === "activity"
              ? "bg-white text-indigo-800 shadow-xs border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
          }`}
        >
          <History className="w-4 h-4" />
          <span>অ্যাক্টিভিটি হিস্ট্রি লগ</span>
        </button>
      </div>

      {/* ========================================================
          TAB 1: NOTIFICATIONS & ALERTS VIEW
      ======================================================== */}
      {activeMainTab === "notifications" && (
        <div className="space-y-6">
          {/* KPI Stats Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 print:grid-cols-4">
            {/* Total Events */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>মোট নোটিফিকেশন</span>
                <Bell className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">
                {toBanglaNumber(stats.total)}
              </div>
              <p className="text-[11px] text-slate-400">সর্বমোট নিবন্ধিত বিজ্ঞপ্তি</p>
            </div>

            {/* Pending Leaves */}
            <Link
              href="/dashboard/attendance/leaves"
              className="bg-white p-4 sm:p-5 rounded-2xl border border-amber-200/90 shadow-xs hover:border-amber-400 transition space-y-1 group"
            >
              <div className="flex items-center justify-between text-amber-800 text-xs font-bold">
                <span>অমীমাংসিত ছুটির আবেদন</span>
                <Clock className="w-4 h-4 text-amber-600 group-hover:scale-110 transition" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-700">
                {toBanglaNumber(stats.pendingLeaves)}
              </div>
              <p className="text-[11px] text-amber-800/80 flex items-center gap-1">
                <span>অনুমোদন করতে ক্লিক করুন</span>
                <ChevronRight className="w-3 h-3" />
              </p>
            </Link>

            {/* Pending Complaints */}
            <Link
              href="/dashboard/communication/feedback"
              className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-200/90 shadow-xs hover:border-rose-400 transition space-y-1 group"
            >
              <div className="flex items-center justify-between text-rose-800 text-xs font-bold">
                <span>অভিযোগ ও পরামর্শ</span>
                <MessageSquare className="w-4 h-4 text-rose-600 group-hover:scale-110 transition" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-rose-700">
                {toBanglaNumber(stats.pendingComplaints)}
              </div>
              <p className="text-[11px] text-rose-800/80 flex items-center gap-1">
                <span>ব্যবস্থা গ্রহণ করতে ক্লিক করুন</span>
                <ChevronRight className="w-3 h-3" />
              </p>
            </Link>

            {/* Admissions */}
            <Link
              href="/dashboard/admissions"
              className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-200/90 shadow-xs hover:border-emerald-400 transition space-y-1 group"
            >
              <div className="flex items-center justify-between text-emerald-800 text-xs font-bold">
                <span>নতুন ভর্তি আবেদন</span>
                <UserPlus className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-700">
                {toBanglaNumber(stats.pendingAdmissions)}
              </div>
              <p className="text-[11px] text-emerald-800/80 flex items-center gap-1">
                <span>যাচাই করতে ক্লিক করুন</span>
                <ChevronRight className="w-3 h-3" />
              </p>
            </Link>
          </div>

          {/* Filter and Search Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 print:hidden">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Search Input */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="শিরোনাম, প্রেরক, বা কারণ দিয়ে খুঁজুন..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              {/* Category Filter */}
              <div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                >
                  <option value="ALL">সকল ক্যাটাগরি ({toBanglaNumber(notifications.length)})</option>
                  <option value="LEAVE">ছুটির আবেদন (ছাত্র ও শিক্ষক)</option>
                  <option value="COMPLAINT">অভিভাবকের অভিযোগ ও পরামর্শ</option>
                  <option value="ADMISSION">অনলাইন ভর্তি আবেদন</option>
                  <option value="SYSTEM">সিস্টেম বিজ্ঞপ্তি ও এলার্ট</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                >
                  <option value="ALL">সকল স্ট্যাটাস</option>
                  <option value="PENDING">অমীমাংসিত (Pending Review)</option>
                  <option value="RESOLVED">নিষ্পন্ন / অনুমোদিত (Resolved)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Event Logs List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200/80 bg-slate-50/70 flex items-center justify-between gap-2">
              <span className="font-bold text-slate-800 text-sm">
                বিজ্ঞপ্তি ও রিমাইন্ডার তালিকা ({toBanglaNumber(filteredNotifications.length)} টি প্রদর্শিত)
              </span>
              <span className="text-xs text-slate-500 font-medium">লাইভ সিংক সক্রিয়</span>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredNotifications.length > 0 ? (
                filteredNotifications.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 sm:p-5 hover:bg-slate-50/80 transition flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                      <div className="shrink-0 mt-1">
                        {item.category === "LEAVE" && (
                          <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
                            <Clock className="w-5 h-5" />
                          </div>
                        )}
                        {item.category === "COMPLAINT" && (
                          <div className="p-2.5 bg-rose-100 text-rose-800 rounded-xl">
                            <MessageSquare className="w-5 h-5" />
                          </div>
                        )}
                        {item.category === "ADMISSION" && (
                          <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                            <UserPlus className="w-5 h-5" />
                          </div>
                        )}
                        {item.category === "SYSTEM" && (
                          <div className="p-2.5 bg-purple-100 text-purple-800 rounded-xl">
                            <Bell className="w-5 h-5" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {getCategoryBadge(item.category)}
                          <strong className="text-sm font-bold text-slate-900">
                            {item.title}
                          </strong>
                          {item.status === "PENDING" ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              অমীমাংসিত
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                              নিষ্পন্ন
                            </span>
                          )}
                        </div>

                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
                          {item.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                          <span>মডিউল: <strong className="text-slate-600">{item.sourceModule}</strong></span>
                          {item.senderName && (
                            <span>প্রেরক: <strong className="text-slate-600">{item.senderName} ({item.senderRole || "ব্যবহারকারী"})</strong></span>
                          )}
                          <span>তারিখ ও সময়: <strong className="text-slate-600">{formatFullDate(item.timestamp)}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center sm:self-center gap-2 print:hidden">
                      <Link
                        href={item.link}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs"
                      >
                        <span>কার্যক্রম গ্রহণ করুন</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-slate-400 space-y-2">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-700">কোনো নোটিফিকেশন বা অ্যালার্ট পাওয়া যায়নি</p>
                  <p className="text-xs text-slate-400">আপনার ফিল্টার বা সার্চ অনুযায়ী কোনো রেকর্ড বিদ্যমান নেই।</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: GLOBAL ACTIVITY HISTORY LOGS VIEW
      ======================================================== */}
      {activeMainTab === "activity" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Activity Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 print:grid-cols-4">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>সর্বমোট অডিট লগ</span>
                <Activity className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">
                {toBanglaNumber(activityStats.totalLogs)}
              </div>
              <p className="text-[11px] text-slate-400">নিবন্ধিত প্রশাসনিক কার্যক্রম</p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-emerald-800 text-xs font-bold">
                <span>আজকের কার্যক্রম</span>
                <Clock className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-700">
                {toBanglaNumber(activityStats.todayCount)}
              </div>
              <p className="text-[11px] text-emerald-600/80">গত ২৪ ঘণ্টায় বাস্তবায়িত</p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-cyan-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-cyan-800 text-xs font-bold">
                <span>গত ৭ দিনের লগ</span>
                <Calendar className="w-4 h-4 text-cyan-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-cyan-700">
                {toBanglaNumber(activityStats.weekCount)}
              </div>
              <p className="text-[11px] text-cyan-600/80">চলতি সপ্তাহের কার্যক্রম</p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-blue-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-blue-800 text-xs font-bold">
                <span>সফল অ্যাকশন হার</span>
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-blue-700">
                ১০০%
              </div>
              <p className="text-[11px] text-blue-600/80">{toBanglaNumber(activityStats.successCount)} টি সফল রেকর্ড</p>
            </div>
          </div>

          {/* Activity Filters Toolbar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 print:hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative lg:col-span-2">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={actSearch}
                  onChange={(e) => setActSearch(e.target.value)}
                  placeholder="অ্যাক্টিভিটি, ব্যবহারকারী বা মডিউল খুঁজুন..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                />
              </div>

              {/* Module Filter */}
              <div>
                <select
                  value={actModule}
                  onChange={(e) => setActModule(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                >
                  <option value="ALL">সকল মডিউল</option>
                  <option value="STUDENTS">ছাত্র ব্যবস্থাপনা</option>
                  <option value="ADMISSIONS">ভর্তি ব্যবস্থাপনা</option>
                  <option value="ACADEMIC">জামাত ও রুটিন</option>
                  <option value="HIFZ">হিফজুল কুরআন</option>
                  <option value="ATTENDANCE">হাজিরা ও ছুটি</option>
                  <option value="EXAMS">পরীক্ষা ও মূল্যায়ন</option>
                  <option value="FINANCE">হিসাব ও ফি</option>
                  <option value="BACKUP">ব্যাকআপ ও রিস্টোর</option>
                  <option value="COMMUNICATION">অভিভাবক যোগাযোগ</option>
                  <option value="SETTINGS">সিস্টেম ও সেটিংস</option>
                </select>
              </div>

              {/* Action Type Filter */}
              <div>
                <select
                  value={actActionType}
                  onChange={(e) => setActActionType(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                >
                  <option value="ALL">সকল অ্যাকশন টাইপ</option>
                  <option value="CREATE">নতুন তৈরি (Create)</option>
                  <option value="UPDATE">হালনাগাদ (Update)</option>
                  <option value="DELETE">মুছে ফেলা (Delete)</option>
                  <option value="APPROVE">অনুমোদন (Approve)</option>
                  <option value="ATTENDANCE">হাজিরা (Attendance)</option>
                  <option value="PAYMENT">ফি আদায় (Payment)</option>
                  <option value="EXAM">পরীক্ষা (Exam)</option>
                  <option value="BACKUP">ব্যাকআপ (Backup)</option>
                  <option value="NOTICE">নোটিশ (Notice)</option>
                </select>
              </div>

              {/* Time Range Filter */}
              <div>
                <select
                  value={actTimeRange}
                  onChange={(e) => setActTimeRange(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                >
                  <option value="all">সকল সময়কাল</option>
                  <option value="today">আজকের কার্যক্রম</option>
                  <option value="week">গত ৭ দিন</option>
                  <option value="month">গত ৩০ দিন</option>
                </select>
              </div>
            </div>

            {/* Sub-bar: Refresh & View Toggle & Cleanup */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefreshActivityLogs}
                  disabled={isRefreshingLogs}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer"
                  title="লগ রিফ্রেশ করুন"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isRefreshingLogs ? "animate-spin text-indigo-600" : ""}`} />
                  <span>রিফ্রেশ</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCleanupModalOpen(true)}
                  className="px-3 py-1.5 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer"
                  title="পুরোনো লগ ক্লিনআপ"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>লগ ক্লিনআপ</span>
                </button>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setViewMode("timeline")}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                    viewMode === "timeline" ? "bg-white text-indigo-800 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  টাইমলাইন ভিউ
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                    viewMode === "table" ? "bg-white text-indigo-800 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  টেবিল ভিউ
                </button>
              </div>
            </div>
          </div>

          {/* Activity Logs Stream */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200/80 bg-slate-50/70 flex items-center justify-between gap-2">
              <span className="font-bold text-slate-800 text-sm">
                অ্যাক্টিভিটি হিস্ট্রি লগ ({toBanglaNumber(filteredActivityLogs.length)} টি প্রদর্শিত)
              </span>
              <span className="text-xs text-slate-500 font-medium">
                অডিট হিস্ট্রি সংরক্ষিত ও অপরিবর্তনীয়
              </span>
            </div>

            {filteredActivityLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <CheckCircle2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">কোনো অ্যাক্টিভিটি হিস্ট্রি লগ পাওয়া যায়নি</p>
                <p className="text-xs text-slate-400">আপনার ফিল্টার বা সার্চ অনুযায়ী কোনো রেকর্ড বিদ্যমান নেই।</p>
              </div>
            ) : viewMode === "timeline" ? (
              /* TIMELINE VIEW */
              <div className="divide-y divide-slate-100">
                {filteredActivityLogs.map((log) => {
                  const mod = getModuleConfig(log.module);
                  const Icon = mod.icon;

                  return (
                    <div
                      key={log.id}
                      className="p-4 sm:p-5 hover:bg-slate-50/80 transition flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                    >
                      <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                        {/* Module Icon */}
                        <div className={`p-2.5 rounded-xl shrink-0 mt-1 ${mod.bg} ${mod.text}`}>
                          <Icon className="w-5 h-5" />
                        </div>

                        {/* Details */}
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${mod.badgeBg}`}>
                              {log.module_name_bn}
                            </span>
                            {getActionTypeBadge(log.action_type)}
                            <strong className="text-sm font-bold text-slate-900">
                              {log.title}
                            </strong>
                            <span className="text-[11px] text-slate-400 font-medium">
                              • {formatRelativeTime(log.timestamp)}
                            </span>
                          </div>

                          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
                            {log.description}
                          </p>

                          {/* Metadata & Actor Bar */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 pt-1">
                            <span className="flex items-center gap-1 font-semibold text-slate-700">
                              <span>অ্যাক্টর:</span>
                              <strong>{log.actor_name}</strong>
                              <span className="text-slate-400 font-normal">({log.actor_role})</span>
                            </span>

                            {log.device && (
                              <span className="flex items-center gap-1 text-slate-400">
                                <Laptop className="w-3 h-3 text-slate-400" />
                                <span>{log.device}</span>
                              </span>
                            )}

                            {log.ip_address && (
                              <span className="flex items-center gap-1 text-slate-400">
                                <Globe className="w-3 h-3 text-slate-400" />
                                <span>আইপি: {log.ip_address}</span>
                              </span>
                            )}

                            <span className="text-slate-400">
                              সময়: <strong>{formatFullDate(log.timestamp)}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Controls */}
                      <div className="shrink-0 flex items-center sm:self-center gap-2 print:hidden">
                        <button
                          type="button"
                          onClick={() => setSelectedLogDetail(log)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>বিস্তারিত</span>
                        </button>

                        {log.link && (
                          <Link
                            href={log.link}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                          >
                            <span>মডিউলে যান</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* DENSE TABLE VIEW */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 border-b text-slate-600 font-bold uppercase text-[11px]">
                    <tr>
                      <th className="p-3">সময়</th>
                      <th className="p-3">মডিউল</th>
                      <th className="p-3">অ্যাকশন</th>
                      <th className="p-3">বিবরণ</th>
                      <th className="p-3">ব্যবহারকারী</th>
                      <th className="p-3 text-right print:hidden">কার্যক্রম</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredActivityLogs.map((log) => {
                      const mod = getModuleConfig(log.module);
                      return (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-3 whitespace-nowrap text-slate-500 font-mono text-xs">
                            <div>{formatRelativeTime(log.timestamp)}</div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(log.timestamp).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${mod.badgeBg}`}>
                              {log.module_name_bn}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {getActionTypeBadge(log.action_type)}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{log.title}</div>
                            <div className="text-xs text-slate-600 line-clamp-1">{log.description}</div>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <div className="font-semibold text-slate-800">{log.actor_name}</div>
                            <div className="text-[10px] text-slate-400">{log.actor_role}</div>
                          </td>
                          <td className="p-3 text-right whitespace-nowrap print:hidden">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedLogDetail(log)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition"
                                title="সম্পূর্ণ অডিট বিবরণ"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {log.link && (
                                <Link
                                  href={log.link}
                                  className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition"
                                  title="মডিউল ওপেন করুন"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: LOG DETAILS AUDIT VIEWER
      ======================================================== */}
      {selectedLogDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-800 rounded-lg">
                  <Activity className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">অ্যাক্টিভিটি লগ অডিট বিবরণ</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLogDetail(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-semibold uppercase">কার্যক্রমের শিরোনাম</span>
                <h4 className="text-base font-bold text-slate-900">{selectedLogDetail.title}</h4>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs sm:text-sm text-slate-700">
                {selectedLogDetail.description}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl border bg-slate-50/50">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">মডিউল</span>
                  <span className="font-bold text-slate-800">{selectedLogDetail.module_name_bn}</span>
                </div>
                <div className="p-3 rounded-xl border bg-slate-50/50">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">অ্যাকশন টাইপ</span>
                  <span className="font-bold text-slate-800">{selectedLogDetail.action_type}</span>
                </div>
                <div className="p-3 rounded-xl border bg-slate-50/50">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">অ্যাক্টর / ব্যবহারকারী</span>
                  <span className="font-bold text-slate-800">{selectedLogDetail.actor_name}</span>
                  <span className="text-slate-500 block text-[11px]">{selectedLogDetail.actor_role}</span>
                </div>
                <div className="p-3 rounded-xl border bg-slate-50/50">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">আইপি ও ডিভাইস</span>
                  <span className="font-bold text-slate-800">{selectedLogDetail.ip_address || "লোকাল ক্লায়েন্ট"}</span>
                  <span className="text-slate-500 block text-[11px]">{selectedLogDetail.device || "ওয়েব ব্রাউজার"}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl border bg-slate-50/50 text-xs">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">লগ রেকর্ড টাইমস্ট্যাম্প</span>
                <span className="font-bold text-slate-800">{formatFullDate(selectedLogDetail.timestamp)}</span>
                <span className="text-slate-400 block text-[10px] font-mono mt-0.5">{selectedLogDetail.timestamp}</span>
              </div>

              {selectedLogDetail.metadata && (
                <div className="space-y-1">
                  <span className="text-xs text-slate-400 font-semibold uppercase">অতিরিক্ত মেটাডাটা</span>
                  <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-[11px] font-mono overflow-x-auto">
                    {JSON.stringify(selectedLogDetail.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              {selectedLogDetail.link ? (
                <Link
                  href={selectedLogDetail.link}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <span>সংশ্লিষ্ট পেইজে যান</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={() => setSelectedLogDetail(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: MANUAL LOG ENTRY
      ======================================================== */}
      {isManualLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-800 rounded-lg">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">ম্যানুয়াল অ্যাডমিন লগ এন্ট্রি</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsManualLogModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateManualLog} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  কার্যক্রমের শিরোনাম <span className="text-indigo-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={manualLogForm.title}
                  onChange={(e) => setManualLogForm({ ...manualLogForm, title: e.target.value })}
                  placeholder="যেমন: মাসিক অভিভাবক সম্মেলন আয়োজন বা রেজুলেশন গ্রহণ..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">মডিউল</label>
                  <select
                    value={manualLogForm.module}
                    onChange={(e) => setManualLogForm({ ...manualLogForm, module: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold bg-white"
                  >
                    <option value="STUDENTS">ছাত্র ব্যবস্থাপনা</option>
                    <option value="ADMISSIONS">ভর্তি ব্যবস্থাপনা</option>
                    <option value="ACADEMIC">জামাত ও রুটিন</option>
                    <option value="HIFZ">হিফজুল কুরআন</option>
                    <option value="ATTENDANCE">হাজিরা ও ছুটি</option>
                    <option value="EXAMS">পরীক্ষা ও মূল্যায়ন</option>
                    <option value="FINANCE">হিসাব ও ফি</option>
                    <option value="BACKUP">ব্যাকআপ ও রিস্টোর</option>
                    <option value="COMMUNICATION">অভিভাবক যোগাযোগ</option>
                    <option value="SETTINGS">সিস্টেম ও সেটিংস</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">অ্যাকশন টাইপ</label>
                  <select
                    value={manualLogForm.action_type}
                    onChange={(e) => setManualLogForm({ ...manualLogForm, action_type: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold bg-white"
                  >
                    <option value="CREATE">নতুন তৈরি (Create)</option>
                    <option value="UPDATE">হালনাগাদ (Update)</option>
                    <option value="APPROVE">অনুমোদন (Approve)</option>
                    <option value="NOTICE">নোটিশ (Notice)</option>
                    <option value="SETTINGS">সেটিংস (Settings)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  বিস্তারিত বিবরণ <span className="text-indigo-600">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={manualLogForm.description}
                  onChange={(e) => setManualLogForm({ ...manualLogForm, description: e.target.value })}
                  placeholder="গৃহীত সিদ্ধান্তের সারসংক্ষেপ বা কার্যক্রমের বিবরণ লিখুন..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualLogModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submittingManualLog}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{submittingManualLog ? "সংরক্ষণ হচ্ছে..." : "লগ সংরক্ষণ করুন"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: LOG CLEANUP
      ======================================================== */}
      {isCleanupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 bg-rose-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 text-rose-800 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-rose-900 text-base">পুরোনো অ্যাক্টিভিটি লগ ক্লিনআপ</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCleanupModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                ডাটাবেজ পারফরম্যান্স ও স্টোরেজ অপ্টিমাইজেশনের জন্য নির্দিষ্ট সময়ের পুরোনো অপ্রয়োজনীয় অডিট হিস্ট্রি ক্লিনআপ করতে পারেন।
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  কত দিনের পুরোনো লগ ক্লিনআপ করতে চান?
                </label>
                <select
                  value={cleanupDays}
                  onChange={(e) => setCleanupDays(Number(e.target.value))}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold bg-white"
                >
                  <option value={15}>১৫ দিনের পুরোনো</option>
                  <option value={30}>৩০ দিনের পুরোনো (সুপারিশকৃত)</option>
                  <option value={60}>৬০ দিনের পুরোনো</option>
                  <option value={90}>৯০ দিনের পুরোনো</option>
                </select>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                ⚠️ সতর্কতা: ক্লিনআপ করার পূর্বে প্রয়োজনে উপরোক্ত "JSON" বা "CSV" বাটন চেপে ব্যাকআপ ফাইল ডাউনলোড করে নিন।
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50">
              <button
                type="button"
                onClick={() => setIsCleanupModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={isCleaning}
                onClick={handleCleanupLogs}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isCleaning ? "ক্লিনআপ হচ্ছে..." : "নিশ্চিতভাবে ক্লিনআপ করুন"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CREATE SYSTEM BROADCAST NOTICE
      ======================================================== */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
                  <Send className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">নতুন সিস্টেম নোটিশ পাঠান</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNotice} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  নোটিশের শিরোনাম <span className="text-emerald-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={noticeForm.title}
                  onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                  placeholder="যেমন: মাসিক স্টাফ মিটিং বা জরুরি নোটিশ..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">ক্যাটাগরি</label>
                  <select
                    value={noticeForm.category}
                    onChange={(e) => setNoticeForm({ ...noticeForm, category: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold bg-white"
                  >
                    <option value="SYSTEM">সিস্টেম নোটিশ</option>
                    <option value="ACADEMIC">অ্যাকাডেমিক নোটিশ</option>
                    <option value="FINANCE">অর্থ ও ফি সংক্রান্ত</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">গুরুত্ব / সেভিয়ারিটি</label>
                  <select
                    value={noticeForm.severity}
                    onChange={(e) => setNoticeForm({ ...noticeForm, severity: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold bg-white"
                  >
                    <option value="INFO">সাধারণ (Info)</option>
                    <option value="WARNING">সতর্কতা (Warning)</option>
                    <option value="CRITICAL">জরুরি (Critical)</option>
                    <option value="SUCCESS">সফলতা (Success)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  বিস্তারিত বিবরণ <span className="text-emerald-600">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={noticeForm.description}
                  onChange={(e) => setNoticeForm({ ...noticeForm, description: e.target.value })}
                  placeholder="নোটিশের বিস্তারিত বিবরণ লিখুন..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  অ্যাকশন লিঙ্ক (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={noticeForm.link}
                  onChange={(e) => setNoticeForm({ ...noticeForm, link: e.target.value })}
                  placeholder="/dashboard বা অন্য কোনো পেজ লিঙ্ক"
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submittingNotice}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submittingNotice ? "পাঠানো হচ্ছে..." : "সম্প্রচার করুন"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
