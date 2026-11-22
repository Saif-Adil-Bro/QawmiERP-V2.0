"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Command,
  X,
  UserPlus,
  Wallet,
  Receipt,
  CheckSquare,
  BookOpen,
  PlusCircle,
  FileSpreadsheet,
  Database,
  ArrowRight,
  Sparkles,
  Users,
  GraduationCap,
  CalendarDays,
  Award,
  Layers,
  HeartHandshake,
  Utensils,
  Library,
  ShieldCheck,
  Settings,
  Bell,
  Scale,
  Loader2,
  ChevronRight,
  TrendingUp,
  Camera,
  Lock,
  CheckCircle2,
  Send,
  Clock,
  Webhook,
  Puzzle,
  AlertTriangle,
  Stethoscope,
  ShieldAlert,
  CreditCard,
} from "lucide-react";
import { HEALTH_ROLES } from "@/lib/student-health/model";
import { usePermissions } from "@/components/permissions/PermissionContext";
import { searchUniversalCommand, UniversalSearchResultItem } from "@/app/actions/universal-search";

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: any;
  category: string;
  badge?: string;
  color: string;
  keywords: string[];
  roles?: string[];
}

const STATIC_QUICK_ACTIONS: QuickAction[] = [
  {
    id: "action-new-admission",
    title: "নতুন শিক্ষার্থী ভর্তি আবেদন",
    subtitle: "ভর্তি ফরম পূরণ ও নতুন ছাত্র রেজিস্ট্রেশন",
    href: "/dashboard/admissions",
    icon: UserPlus,
    category: "অ্যাকশন",
    badge: "ভর্তি",
    color: "text-emerald-600 bg-emerald-50",
    keywords: ["vorti", "admission", "student", "ভর্তি", "ছাত্র ভর্তি", "নতুন ছাত্র", "নতুন"],
  },
  {
    id: "action-collect-fee",
    title: "ফি আদায় ও রসিদ প্রদান",
    subtitle: "ছাত্রদের মাসিক বেতন ও খোরাকি ফি কালেকশন",
    href: "/dashboard/accounting",
    icon: Receipt,
    category: "অ্যাকশন",
    badge: "আদায়",
    color: "text-blue-600 bg-blue-50",
    keywords: ["fee", "payment", "collection", "বেতন", "ফি", "রসিদ", "আদায়", "টাকা"],
  },
  {
    id: "action-take-attendance",
    title: "দৈনিক হাজিরা গ্রহণ",
    subtitle: "জামাত অনুযায়ী উপস্থিত ও অনুপস্থিত মার্ক করুন",
    href: "/dashboard/attendance",
    icon: CheckSquare,
    category: "অ্যাকশন",
    badge: "হাজিরা",
    color: "text-teal-600 bg-teal-50",
    keywords: ["attendance", "hazira", "হাজিরা", "উপস্থিতি", "অনুপস্থিতি"],
  },
  {
    id: "action-hifz-sabak",
    title: "হিফজ সবক ও আমুক্তা এন্ট্রি",
    subtitle: "দৈনিক সবক, সাতপারা ও হেফজ ট্র্যাকিং",
    href: "/dashboard/hifz",
    icon: BookOpen,
    category: "অ্যাকশন",
    badge: "হিফজ",
    color: "text-amber-600 bg-amber-50",
    keywords: ["hifz", "sabak", "amukta", "হিফজ", "সবক", "আমুক্তা", "পারা", "হাফেজ"],
  },
  {
    id: "action-new-expense",
    title: "নতুন খরচ ভাউচার এন্ট্রি",
    subtitle: "মেস বাজার, অফিস খরচ বা সাধারণ ব্যয় হিসাব",
    href: "/dashboard/accounting/expenses",
    icon: Wallet,
    category: "অ্যাকশন",
    badge: "ব্যয়",
    color: "text-rose-600 bg-rose-50",
    keywords: ["expense", "khoroch", "voucher", "খরচ", "ব্যয়", "বাজার", "ভাউচার"],
  },
  {
    id: "action-zakat-collect",
    title: "যাকাত ও অনুদান সংগ্রহ",
    subtitle: "মুহূর্তের মধ্যে ডিজিটাল রসিদসহ অনুদান এন্ট্রি",
    href: "/dashboard/zakat/collection",
    icon: HeartHandshake,
    category: "অ্যাকশন",
    badge: "দান",
    color: "text-cyan-600 bg-cyan-50",
    keywords: ["zakat", "donation", "dan", "যাকাত", "দান", "অনুদান", "রসিদ"],
  },
  {
    id: "action-question-bank",
    title: "প্রশ্নব্যাংক ও প্রশ্নপত্র জেনারেটর",
    subtitle: "পরীক্ষার প্রশ্ন তৈরি ও অটো ফরম্যাটিং",
    href: "/dashboard/exams/question-bank",
    icon: Award,
    category: "অ্যাকশন",
    badge: "পরীক্ষা",
    color: "text-purple-600 bg-purple-50",
    keywords: ["question", "exam", "proshno", "প্রশ্ন", "প্রশ্নপত্র", "পরীক্ষা"],
  },
  {
    id: "action-backup",
    title: "১-ক্লিক সম্পূর্ণ সিস্টেম ব্যাকআপ",
    subtitle: "সকল ডাটার নিরাপদ অফলাইন কপি ডাউনলোড",
    href: "/dashboard/settings/backup",
    icon: Database,
    category: "টুলস",
    badge: "ব্যাকআপ",
    color: "text-indigo-600 bg-indigo-50",
    keywords: ["backup", "restore", "ডাটা", "ব্যাকআপ", "ডাউনলোড"],
  },
  {
    id: "action-amal-tracker",
    title: "বাড়ির কর্মসূচি ও আমল ট্র্যাকার (A4)",
    subtitle: "সাপ্তাহিক ও ছুটির আমলনামা A4 প্রিন্ট ও অভিভাবক মূল্যায়ন",
    href: "/dashboard/academic/amal-tracker",
    icon: Sparkles,
    category: "টুলস",
    badge: "আমলনামা",
    color: "text-emerald-600 bg-emerald-50",
    keywords: ["amal", "amal tracker", "namaz", "routine", "আমল", "আমলনামা", "আমল ট্র্যাকার", "নামাজ", "ছুটির আমল", "বাড়ির পড়া"],
  },
  {
    id: "nav-student-health", roles: HEALTH_ROLES, title: "অসুস্থ শিক্ষার্থী ও স্বাস্থ্যসেবা", subtitle: "অসুস্থ শিক্ষার্থীর নথি ও ফলো-আপ",
    href: "/dashboard/students/health", icon: Stethoscope, badge: "স্বাস্থ্য", category: "নেভিগেশন",
    color: "text-teal-700 bg-teal-50", keywords: ["health", "sick", "medical", "জ্বর", "চিকিৎসা", "অসুস্থ"],
  },
  {
    id: "nav-students",
    title: "শিক্ষার্থী তালিকা ও প্রোফাইল",
    subtitle: "সকল শিক্ষার্থীর তথ্য ও ফাইল আর্কাইভ",
    href: "/dashboard/students",
    icon: Users,
    category: "নেভিগেশন",
    color: "text-slate-600 bg-slate-100",
    keywords: ["students", "shikkharthi", "ছাত্র তালিকা", "প্রোফাইল"],
  },
  {
    id: "nav-classes",
    title: "জামাত ও শাখা ব্যবস্থাপনা",
    subtitle: "ক্লাস লিস্ট, সেকশন ও রুটিন",
    href: "/dashboard/classes",
    icon: Layers,
    category: "নেভিগেশন",
    color: "text-slate-600 bg-slate-100",
    keywords: ["classes", "jamat", "জামাত", "শ্রেণি", "শাখা"],
  },
  {
    id: "nav-staff",
    title: "উস্তাদ ও স্টাফ রেজিস্টার (HR)",
    subtitle: "শিক্ষকদের তালিকা, বেতন ও প্রোফাইল",
    href: "/dashboard/staff",
    icon: Users,
    category: "নেভিগেশন",
    color: "text-slate-600 bg-slate-100",
    keywords: ["staff", "ustad", "teacher", "উস্তাদ", "শিক্ষক", "স্টাফ"],
  },
  {
    id: "nav-reports",
    title: "আর্থিক রিপোর্ট ও লেজার খতিয়ান",
    subtitle: "মাসিক আয়-ব্যয় এবং শুরা রিপোর্ট",
    href: "/dashboard/accounting/reports",
    icon: Scale,
    category: "নেভিগেশন",
    color: "text-slate-600 bg-slate-100",
    keywords: ["reports", "ledger", "khotiyan", "রিপোর্ট", "খতিয়ান", "হিসাব"],
  },
  {
    id: "nav-security",
    title: "সিকিউরিটি, অ্যাক্টিভ সেশন ও 2FA",
    subtitle: "লগইন সেশন নিয়ন্ত্রণ ও স্টেপ-আপ ওটিপি",
    href: "/dashboard/settings/security",
    icon: Lock,
    category: "নেভিগেশন",
    badge: "2FA",
    color: "text-indigo-600 bg-indigo-50",
    keywords: ["security", "session", "2fa", "mfa", "otp", "সিকিউরিটি", "সেশন", "নিরাপত্তা"],
  },
  {
    id: "nav-approvals",
    title: "অনুমোদন ওয়ার্কফ্লো সেন্টার",
    subtitle: "বড় খরচ, ফি মওকুফ ও রেজাল্ট অনুমোদন",
    href: "/dashboard/approvals",
    icon: CheckCircle2,
    category: "নেভিগেশন",
    badge: "অনুমোদন",
    color: "text-amber-600 bg-amber-50",
    keywords: ["approval", "workflow", "waiver", "অনুমোদন", "ওয়ার্কফ্লো", "মওকুফ"],
  },
  {
    id: "nav-orchestrator",
    title: "নোটিফিকেশন অর্কেস্ট্রেটর",
    subtitle: "Push, WhatsApp, SMS ও Email টেমপ্লেট ও কিউ",
    href: "/dashboard/communication/orchestrator",
    icon: Send,
    category: "টুলস",
    badge: "মেসেজ",
    color: "text-teal-600 bg-teal-50",
    keywords: ["orchestrator", "notification", "whatsapp", "sms", "push", "অর্কেস্ট্রেটর", "নোটিফিকেশন", "এসএমএস"],
  },
  {
    id: "nav-automation",
    title: "অটোমেশন ও শিডিউলড ক্রন",
    subtitle: "স্বয়ংক্রিয় মাসিক ফি, তাগাদা ও জব লগ",
    href: "/dashboard/settings/automation",
    icon: Clock,
    category: "টুলস",
    badge: "ক্রন",
    color: "text-sky-600 bg-sky-50",
    keywords: ["automation", "cron", "schedule", "অটোমেশন", "ক্রন", "শিডিউল"],
  },
  {
    id: "nav-webhooks",
    title: "ওয়েবহুক ও ইন্টিগ্রেশন হাব",
    subtitle: "এক্সটারনাল API ওয়েবহুক ও ডেলিভারি লগ",
    href: "/dashboard/settings/webhooks",
    icon: Webhook,
    category: "টুলস",
    badge: "API",
    color: "text-purple-600 bg-purple-50",
    keywords: ["webhook", "integration", "api", "ওয়েবহুক", "ইন্টিগ্রেশন"],
  },
  {
    id: "nav-widgets",
    title: "উইজেট ও প্লাগইন ম্যানেজার",
    subtitle: "ডিফল্ট উইজেট ও কাস্টম .zip প্লাগইন ইনস্টল",
    href: "/dashboard/settings/widgets",
    icon: Puzzle,
    category: "টুলস",
    badge: "Plugin",
    color: "text-indigo-600 bg-indigo-50",
    keywords: ["widget", "plugin", "zip", "উইজেট", "প্লাগইন"],
  },
  {
    id: "nav-payment-gateway",
    title: "পেমেন্ট গেটওয়ে সেটিংস",
    subtitle: "SSLCommerz, bKash ও Nagad কনফিগারেশন",
    href: "/dashboard/settings/payment-gateway",
    icon: CreditCard,
    category: "নেভিগেশন",
    badge: "গেটওয়ে",
    color: "text-emerald-600 bg-emerald-50",
    keywords: ["payment gateway", "sslcommerz", "bkash", "nagad", "পেমেন্ট গেটওয়ে"],
  },
  {
    id: "nav-executive-bi",
    title: "এক্সিকিউটিভ BI ও ডাইজেস্ট রিপোর্ট",
    subtitle: "বোর্ডিং, যাকাত, বকেয়া ও পরীক্ষার বিশ্লেষণ",
    href: "/dashboard/analytics/executive-bi",
    icon: TrendingUp,
    category: "নেভিগেশন",
    badge: "BI",
    color: "text-emerald-600 bg-emerald-50",
    keywords: ["executive bi", "bi", "digest", "analytics", "বিশ্লেষণ", "ডাইজেস্ট", "রিপোর্ট"],
  },
  {
    id: "nav-early-warning",
    title: "AI আর্লি ওয়ার্নিং ও ড্রপআউট ঝুঁকি",
    subtitle: "শিক্ষার্থীর ঝুঁকি স্কোর ও ইন্টারভেনশন",
    href: "/dashboard/analytics/early-warning",
    icon: AlertTriangle,
    category: "নেভিগেশন",
    badge: "AI ঝুঁকি",
    color: "text-amber-600 bg-amber-50",
    keywords: ["early warning", "dropout", "risk", "আর্লি ওয়ার্নিং", "ড্রপআউট", "ঝুঁকি"],
  },
  {
    id: "nav-anomalies",
    title: "আর্থিক ও বোর্ডিং অসঙ্গতি মনিটর",
    subtitle: "বাজার খরচ স্পাইক, ডুপ্লিকেট ভাউচার ও মওকুফ",
    href: "/dashboard/accounting/anomalies",
    icon: ShieldAlert,
    category: "নেভিগেশন",
    badge: "অসঙ্গতি",
    color: "text-rose-600 bg-rose-50",
    keywords: ["anomaly", "anomalies", "fraud", "duplicate", "অসঙ্গতি", "অ্যানোমালি", "ভাউচার"],
  },
];

export function UniversalCommandPalette({
  isOpen,
  onClose,
  onOpenExecutiveSummary,
}: {
  isOpen: boolean;
  onClose: () => void;
  onOpenExecutiveSummary?: () => void;
}) {
  const {summary}=usePermissions();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UniversalSearchResultItem[]>([]);
  const [isSearching, startSearching] = useTransition();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setSearchResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global Keyboard shortcuts (Ctrl+K, Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open handled by parent or trigger
        }
      } else if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      setSelectedIndex(0);
      return;
    }

    const timer = setTimeout(() => {
      startSearching(async () => {
        try {
          const res = await searchUniversalCommand(query);
          setSearchResults(res);
          setSelectedIndex(0);
        } catch {
          setSearchResults([]);
        }
      });
    }, 180);

    return () => clearTimeout(timer);
  }, [query]);

  // Filter static actions based on query
  const filteredQuickActions = STATIC_QUICK_ACTIONS.filter((act) => {
    if(act.roles && !act.roles.some(r=>summary?.roles.includes(r)))return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      act.title.toLowerCase().includes(q) ||
      act.subtitle.toLowerCase().includes(q) ||
      act.keywords.some((k) => k.toLowerCase().includes(q))
    );
  });

  // Combined selectable items
  const combinedItems: { id: string; title: string; subtitle: string; href?: string; onClick?: () => void; icon?: any; badge?: string; badgeColor?: string }[] = [];

  // If query is empty or matches executive summary, add executive summary action at top
  if (!query || "মাসিক নির্বাহী ড্যাশবোর্ড সামারি রিপোর্ট muhtamim executive summary".toLowerCase().includes(query.toLowerCase())) {
    combinedItems.push({
      id: "action-exec-summary",
      title: "📊 এক ক্লিকে 'মাসিক নির্বাহী ড্যাশবোর্ড' ওপেন করুন",
      subtitle: "মুহতামিম স্পেশাল: চলতি মাসের আয়-ব্যয়, হাজিরা %, হিফজ ও বকেয়ার সামারি",
      onClick: () => {
        onClose();
        if (onOpenExecutiveSummary) onOpenExecutiveSummary();
      },
      badge: "মুহতামিম সামারি",
      badgeColor: "bg-amber-100 text-amber-900 border-amber-300 font-bold",
    });
  }

  // Add DB search results
  searchResults.forEach((r) => {
    combinedItems.push({
      id: r.id,
      title: r.title,
      subtitle: `${r.categoryLabel} • ${r.subtitle}`,
      href: r.href,
      badge: r.badge,
      badgeColor: r.badgeColor,
    });
  });

  // Add matching quick actions
  filteredQuickActions.forEach((act) => {
    combinedItems.push({
      id: act.id,
      title: act.title,
      subtitle: `${act.category} • ${act.subtitle}`,
      href: act.href,
      icon: act.icon,
      badge: act.badge,
      badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
    });
  });

  // Handle arrow key navigation & Enter
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (combinedItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % combinedItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + combinedItems.length) % combinedItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = combinedItems[selectedIndex];
      if (selected) {
        if (selected.onClick) {
          selected.onClick();
        } else if (selected.href) {
          onClose();
          router.push(selected.href);
        }
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-3 sm:pt-20 px-2 sm:px-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[82vh] animate-in zoom-in-95 duration-150 dark:bg-slate-900 dark:border-slate-800 sepia-mode:bg-[#FCF8F2] sepia-mode:border-[#E8DFD1]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center border-b border-slate-100 px-3 sm:px-4 py-3 sm:py-3.5 gap-2 dark:border-slate-800 sepia-mode:border-[#E8DFD1]">
          <Search className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 ml-1" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="ছাত্রের নাম, রোল, রসিদ নং, কিতাব বা যেকোনো মেন্যু..."
            className="w-full text-sm sm:text-base font-medium text-slate-800 placeholder-slate-400 bg-transparent focus:outline-hidden dark:text-slate-100 sepia-mode:text-[#2C1A0C]"
          />
          {isSearching && <Loader2 className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />}
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              title="লেখা মুছুন"
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:bg-slate-800 shrink-0 transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Dedicated Close Button for Mobile & Desktop */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 text-xs font-semibold shrink-0 transition"
            title="সার্চ উইন্ডো বন্ধ করুন"
            aria-label="Close search"
          >
            <X className="w-4 h-4" />
            <span className="text-[11px]">বন্ধ</span>
          </button>

          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 text-[11px] font-semibold text-slate-400 bg-slate-100 rounded-md border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="overflow-y-auto p-2 space-y-1 divide-y divide-transparent">
          {combinedItems.length === 0 && query.trim() && !isSearching && (
            <div className="text-center py-10 px-4">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                &quot;{query}&quot; সংক্রান্ত কোনো তথ্য পাওয়া যায়নি
              </p>
              <p className="text-xs text-slate-400 mt-1">
                বানান সঠিক আছে কিনা যাচাই করুন অথবা অন্য কোনো কি-ওয়ার্ড দিয়ে খুঁজুন
              </p>
            </div>
          )}

          {combinedItems.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <div
                key={item.id}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => {
                  if (item.onClick) {
                    item.onClick();
                  } else if (item.href) {
                    onClose();
                    router.push(item.href);
                  }
                }}
                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors duration-100 ${
                  isSelected
                    ? "bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100 sepia-mode:bg-[#EFE6D8]"
                    : "hover:bg-slate-50 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60 sepia-mode:text-[#451A03] sepia-mode:hover:bg-[#F5EFE6]"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      isSelected
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 sepia-mode:bg-[#E8DFD1]"
                    }`}
                  >
                    {item.icon ? (
                      <item.icon className="w-4 h-4" />
                    ) : item.id.startsWith("student") ? (
                      <Users className="w-4 h-4" />
                    ) : item.id.startsWith("payment") ? (
                      <Receipt className="w-4 h-4" />
                    ) : item.id.startsWith("donor") ? (
                      <HeartHandshake className="w-4 h-4" />
                    ) : item.id.startsWith("book") ? (
                      <Library className="w-4 h-4" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold truncate leading-tight">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 sepia-mode:text-[#7C6248] truncate leading-tight mt-0.5">
                      {item.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.badge && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        item.badgeColor || "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isSelected && (
                    <ArrowRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Hotkey & Mobile Close Guide */}
        <div className="bg-slate-50 px-3 sm:px-4 py-2 sm:py-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 dark:bg-slate-950/50 dark:border-slate-800 dark:text-slate-400 sepia-mode:bg-[#F5EFE6] sepia-mode:border-[#E8DFD1]">
          <div className="hidden sm:flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-sm font-mono text-[10px] shadow-2xs dark:bg-slate-800 dark:border-slate-700">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-sm font-mono text-[10px] shadow-2xs dark:bg-slate-800 dark:border-slate-700">
                ↓
              </kbd>
              <span>নির্বাচন করুন</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-sm font-mono text-[10px] shadow-2xs dark:bg-slate-800 dark:border-slate-700">
                ↵ Enter
              </kbd>
              <span>যেতে চাপুন</span>
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="sm:hidden text-slate-500 hover:text-slate-800 dark:text-slate-400 font-medium flex items-center gap-1 py-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>বন্ধ করতে ট্যাপ করুন</span>
          </button>

          <span className="font-semibold text-emerald-700 dark:text-emerald-400 text-[10px] sm:text-[11px]">
            কওমি ইউনিভার্সাল সার্চ
          </span>
        </div>
      </div>
    </div>
  );
}
