"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { 
  Plus, Search, Filter, Calendar, CalendarDays, Edit3, Trash2, 
  Archive, RotateCcw, Printer, FileText, CheckCircle2, AlertCircle, 
  Clock, Sparkles, Building, Layers, Eye, EyeOff, X, ArrowRight,
  Download, Share2, Info, Bell, Check, Loader2, GraduationCap, Settings
} from "lucide-react";
import { 
  createAcademicHoliday, 
  updateAcademicHoliday, 
  deleteAcademicHoliday, 
  archiveAcademicHoliday, 
  restoreAcademicHoliday, 
  seedDefaultQawmiHolidays,
  updateWeeklyHolidays
} from "@/app/actions/holidays";
import { AcademicHoliday, HOLIDAY_CATEGORIES } from "@/lib/holidays";
import { toBanglaNumber } from "@/lib/numberToBangla";
import PrintLetterpad from "@/app/components/PrintLetterpad";

interface HolidaysClientProps {
  initialHolidays: AcademicHoliday[];
  classes: { id: string; name: string }[];
  madrasaInfo?: any;
  initialWeekendDays?: string[];
}

const PRESET_TEMPLATES = [
  {
    title: "প্রথম সাময়িক পরীক্ষা সমাপ্তি পরবর্তী অবকাশ",
    category: "exam_vacation" as const,
    days: 7,
    description: "প্রথম সাময়িক পরীক্ষা সুষ্ঠুভাবে সম্পন্ন হওয়ায় সকল বিভাগের শিক্ষা কার্যক্রম সাময়িকভাবে বন্ধ থাকবে।",
  },
  {
    title: "পবিত্র ঈদুল ফিতর ও রমজানুল মুবারকের অবকাশ",
    category: "ramadan" as const,
    days: 26,
    description: "পবিত্র মাহে রমজান ও ঈদুল ফিতর উপলক্ষে মাদরাসার সার্বিক শ্রেণি কার্যক্রম বন্ধ থাকবে।",
  },
  {
    title: "পবিত্র ঈদুল আযহা ও কুরবানির ছুটি",
    category: "eid_vacation" as const,
    days: 14,
    description: "পবিত্র ঈদুল আযহা ও কুরবানি উপলক্ষে মাদরাসা বন্ধ থাকবে। নির্ধারিত তারিখে উপস্থিত থাকা বাধ্যতামূলক।",
  },
  {
    title: "দ্বিতীয় সাময়িক / ষান্মাসিক পরীক্ষা পরবর্তী ছুটি",
    category: "exam_vacation" as const,
    days: 7,
    description: "দ্বিতীয় সাময়িক পরীক্ষা সমাপ্তি পরবর্তী নিয়মিত শিক্ষাবৃত্তিক ছুটি।",
  },
  {
    title: "পবিত্র আশুরা ও মহররম ছুটি",
    category: "religious" as const,
    days: 2,
    description: "পবিত্র আশুরা উপলক্ষে মাদরাসার পাঠদান ও অফিস বন্ধ থাকবে।",
  },
  {
    title: "বার্ষিক পরীক্ষা সমাপ্তি ও শিক্ষাবর্ষ সমাপনী ছুটি",
    category: "exam_vacation" as const,
    days: 12,
    description: "বার্ষিক পরীক্ষা ও ফলাফল ঘোষণার পর শিক্ষাবর্ষের সমাপনী অবকাশ।",
  },
  {
    title: "আন্তর্জাতিক মাতৃভাষা দিবস (২১ ফেব্রুয়ারি)",
    category: "national" as const,
    days: 1,
    description: "মহান শহীদ দিবস ও আন্তর্জাতিক মাতৃভাষা দিবস উপলক্ষে মাদরাসার সাধারণ ছুটি।",
  },
  {
    title: "মহান স্বাধীনতা ও জাতীয় দিবস (২৬ মার্চ)",
    category: "national" as const,
    days: 1,
    description: "মহান স্বাধীনতা ও জাতীয় দিবস উপলক্ষে সাধারণ ছুটি।",
  },
  {
    title: "মহান বিজয় দিবস (১৬ ডিসেম্বর)",
    category: "national" as const,
    days: 1,
    description: "মহান বিজয় দিবস উপলক্ষে মাদরাসার ছুটি থাকবে।",
  },
];

const WEEKDAYS_CONFIG = [
  { id: "Friday", bn: "শুক্রবার", ar: "الجمعة", sub: "প্রধান কওমি ছুটি", isPrimary: true },
  { id: "Thursday", bn: "বৃহস্পতিবার", ar: "الخميس", sub: "অর্ধদিবস / সাপ্তাহিক ছুটি" },
  { id: "Saturday", bn: "শনিবার", ar: "السبت", sub: "সাপ্তাহিক" },
  { id: "Sunday", bn: "রবিবার", ar: "الأحد", sub: "সাপ্তাহিক" },
  { id: "Monday", bn: "সোমবার", ar: "الاثنين", sub: "সাপ্তাহিক" },
  { id: "Tuesday", bn: "মঙ্গলবার", ar: "الثلاثاء", sub: "সাপ্তাহিক" },
  { id: "Wednesday", bn: "বুধবার", ar: "الأربعاء", sub: "সাপ্তাহিক" },
];

export default function HolidaysClient({
  initialHolidays = [],
  classes = [],
  madrasaInfo,
  initialWeekendDays = ["Friday"],
}: HolidaysClientProps) {
  const [holidays, setHolidays] = useState<AcademicHoliday[]>(initialHolidays);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("active_upcoming");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Weekly Holidays (Weekend) Settings State
  const [weekendDays, setWeekendDays] = useState<string[]>(
    initialWeekendDays && initialWeekendDays.length > 0 ? initialWeekendDays : ["Friday"]
  );
  const [isWeekendSelectorOpen, setIsWeekendSelectorOpen] = useState(false);
  const [savingWeekend, setSavingWeekend] = useState(false);

  // Form Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<AcademicHoliday | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    category: "general" as keyof typeof HOLIDAY_CATEGORIES,
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date().toISOString().split("T")[0],
    reopen_date: "",
    reopen_time: "সকাল ৮:০০ ঘটিকা",
    applicable_to: "all",
    applicable_classes: [] as string[],
    description: "",
    notice_number: "",
    publish_to_portal: true,
  });

  // Notice Printable Modal
  const [noticeHoliday, setNoticeHoliday] = useState<AcademicHoliday | null>(null);

  // Loading & Feedback
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showFeedback = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4500);
  };

  // Save Weekly Holidays (Weekend)
  const handleSaveWeekendDays = async () => {
    if (weekendDays.length === 0) {
      showFeedback("error", "কমপক্ষে একটি দিন সাপ্তাহিক ছুটি হিসেবে নির্ধারণ করতে হবে।");
      return;
    }
    setSavingWeekend(true);
    try {
      const res = await updateWeeklyHolidays(weekendDays);
      if (res.error) {
        showFeedback("error", res.error);
      } else {
        showFeedback("success", "সাপ্তাহিক ছুটির দিন সফলভাবে সংরক্ষিত ও কার্যকর হয়েছে!");
        setIsWeekendSelectorOpen(false);
      }
    } catch (err) {
      showFeedback("error", "সাপ্তাহিক ছুটি সংরক্ষণ ব্যর্থ হয়েছে।");
    } finally {
      setSavingWeekend(false);
    }
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingHoliday(null);
    const today = new Date().toISOString().split("T")[0];
    setFormData({
      title: "",
      category: "exam_vacation",
      start_date: today,
      end_date: today,
      reopen_date: "",
      reopen_time: "সকাল ৮:০০ ঘটিকা",
      applicable_to: "all",
      applicable_classes: [],
      description: "",
      notice_number: `মাদ/ছুটি/${new Date().getFullYear()}/${(holidays.length + 1).toString().padStart(2, "0")}`,
      publish_to_portal: true,
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (h: AcademicHoliday) => {
    setEditingHoliday(h);
    setFormData({
      title: h.title,
      category: (h.category as any) || "general",
      start_date: h.start_date,
      end_date: h.end_date,
      reopen_date: h.reopen_date || "",
      reopen_time: h.reopen_time || "সকাল ৮:০০ ঘটিকা",
      applicable_to: h.applicable_to || "all",
      applicable_classes: h.applicable_classes || [],
      description: h.description || "",
      notice_number: h.notice_number || "",
      publish_to_portal: h.publish_to_portal !== false,
    });
    setIsModalOpen(true);
  };

  // Handle Preset Selection in Form
  const handleSelectPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    const sDate = formData.start_date;
    const startObj = new Date(sDate);
    const endObj = new Date(startObj);
    endObj.setDate(endObj.getDate() + (preset.days - 1));
    const eDate = endObj.toISOString().split("T")[0];

    const reopenObj = new Date(endObj);
    reopenObj.setDate(reopenObj.getDate() + 1);
    const rDate = reopenObj.toISOString().split("T")[0];

    setFormData((prev) => ({
      ...prev,
      title: preset.title,
      category: preset.category,
      start_date: sDate,
      end_date: eDate,
      reopen_date: rDate,
      reopen_time: "সকাল ৮:০০ ঘটিকা",
      description: preset.description,
    }));
  };

  /**
   * Universal Mobile & Desktop Print Engine
   * Clones notice directly into document.body with #temp-print-frame
   * Solves Android Chrome print spooler blank page issue!
   */
  const handlePrintNotice = () => {
    const printableElement = document.getElementById("printable-holiday-notice");
    if (!printableElement) {
      window.print();
      return;
    }

    const existingFrame = document.getElementById("temp-print-frame");
    if (existingFrame) existingFrame.remove();

    const existingStyle = document.getElementById("temp-holiday-print-style");
    if (existingStyle) existingStyle.remove();

    const style = document.createElement("style");
    style.id = "temp-holiday-print-style";
    style.innerHTML = `
      @media print {
        @page {
          size: A4 portrait;
          margin: 6mm 8mm;
        }
        html, body {
          width: 100% !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          overflow: visible !important;
        }
        body > *:not(#temp-print-frame) {
          display: none !important;
        }
        #temp-print-frame {
          display: block !important;
          position: static !important;
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          box-shadow: none !important;
          border: none !important;
          box-sizing: border-box !important;
        }
        #temp-print-frame * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `;
    document.head.appendChild(style);

    const clone = printableElement.cloneNode(true) as HTMLElement;
    clone.id = "temp-print-frame";
    clone.style.border = "none";
    clone.style.boxShadow = "none";
    clone.style.padding = "0";
    clone.style.margin = "0";
    clone.style.width = "100%";
    clone.style.background = "#ffffff";

    document.body.appendChild(clone);
    document.body.classList.add("is-printing-now");

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove("is-printing-now");
        const temp = document.getElementById("temp-print-frame");
        if (temp) temp.remove();
        const tempStyle = document.getElementById("temp-holiday-print-style");
        if (tempStyle) tempStyle.remove();
      }, 1000);
    }, 250);
  };

  // Handle Save (Create / Update)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showFeedback("error", "ছুটির শিরোনাম প্রদান করুন।");
      return;
    }
    if (formData.start_date > formData.end_date) {
      showFeedback("error", "শেষ তারিখ শুরু তারিখের চেয়ে পূর্বে হতে পারে না।");
      return;
    }

    setSubmitting(true);
    try {
      if (editingHoliday) {
        const res = await updateAcademicHoliday(editingHoliday.id, formData);
        if (res.error) {
          showFeedback("error", res.error);
        } else if (res.holiday) {
          setHolidays((prev) => prev.map((item) => (item.id === res.holiday!.id ? res.holiday! : item)));
          showFeedback("success", "ছুটির তথ্য সফলভাবে হালনাগাদ করা হয়েছে!");
          setIsModalOpen(false);
        }
      } else {
        const res = await createAcademicHoliday(formData);
        if (res.error) {
          showFeedback("error", res.error);
        } else if (res.holiday) {
          setHolidays((prev) => [res.holiday!, ...prev]);
          showFeedback("success", "নতুন ছুটি সফলভাবে যুক্ত করা হয়েছে!");
          setIsModalOpen(false);
        }
      }
    } catch (err: any) {
      showFeedback("error", err?.message || "একটি ত্রুটি হয়েছে।");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete
  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`আপনি কি নিশ্চিত যে "${title}" ছুটি তালিকা থেকে স্থায়ীভাবে মুছে ফেলতে চান?`)) {
      return;
    }
    try {
      const res = await deleteAcademicHoliday(id);
      if (res.error) {
        showFeedback("error", res.error);
      } else {
        setHolidays((prev) => prev.filter((h) => h.id !== id));
        showFeedback("success", "ছুটি সফলভাবে মুছে ফেলা হয়েছে।");
      }
    } catch (err: any) {
      showFeedback("error", err?.message || "মুছতে ব্যর্থ হয়েছে।");
    }
  };

  // Handle Archive / Restore
  const handleToggleArchive = async (h: AcademicHoliday) => {
    try {
      if (h.is_archived) {
        const res = await restoreAcademicHoliday(h.id);
        if (res.success) {
          setHolidays((prev) => prev.map((item) => (item.id === h.id ? { ...item, is_archived: false } : item)));
          showFeedback("success", "ছুটি সফলভাবে সক্রিয় তালিকায় ফিরিয়ে আনা হয়েছে।");
        }
      } else {
        const res = await archiveAcademicHoliday(h.id);
        if (res.success) {
          setHolidays((prev) => prev.map((item) => (item.id === h.id ? { ...item, is_archived: true } : item)));
          showFeedback("success", "ছুটি সফলভাবে আর্কাইভ করা হয়েছে।");
        }
      }
    } catch (err: any) {
      showFeedback("error", err?.message || "অপারেশন ব্যর্থ হয়েছে।");
    }
  };

  // Handle 1-Click Seed Presets
  const handleSeedPresets = async () => {
    if (!confirm("আপনি কি কওমি মাদরাসার স্ট্যান্ডার্ড বার্ষিক ছুটির তালিকা (ঈদুল ফিতর, ঈদুল আযহা, প্রথম ও দ্বিতীয় সাময়িক ছুটি ইত্যাদি) লোড করতে চান?")) {
      return;
    }
    setSeeding(true);
    try {
      const res = await seedDefaultQawmiHolidays();
      if (res.error) {
        showFeedback("error", res.error);
      } else {
        showFeedback("success", res.message || "কওমি বার্ষিক ছুটির তালিকা যুক্ত হয়েছে!");
        window.location.reload();
      }
    } catch (err: any) {
      showFeedback("error", err?.message || "ডিফল্ট লোড করতে ব্যর্থ হয়েছে।");
    } finally {
      setSeeding(false);
    }
  };

  // Filtered & Sorted Holidays
  const filteredHolidays = useMemo(() => {
    return holidays.filter((h) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = h.title.toLowerCase().includes(q);
        const matchNotice = (h.notice_number || "").toLowerCase().includes(q);
        const matchDesc = (h.description || "").toLowerCase().includes(q);
        if (!matchTitle && !matchNotice && !matchDesc) return false;
      }

      // Category
      if (selectedCategory !== "all" && h.category !== selectedCategory) {
        return false;
      }

      // Status
      const today = new Date().toISOString().split("T")[0];
      const isArchived = Boolean(h.is_archived);
      const isOngoing = today >= h.start_date && today <= h.end_date;
      const isUpcoming = today < h.start_date;
      const isCompleted = today > h.end_date;

      if (selectedStatus === "active_upcoming") {
        if (isArchived || isCompleted) return false;
      } else if (selectedStatus === "ongoing") {
        if (isArchived || !isOngoing) return false;
      } else if (selectedStatus === "upcoming") {
        if (isArchived || !isUpcoming) return false;
      } else if (selectedStatus === "completed") {
        if (isArchived || !isCompleted) return false;
      } else if (selectedStatus === "archived") {
        if (!isArchived) return false;
      }

      return true;
    });
  }, [holidays, searchQuery, selectedCategory, selectedStatus]);

  // Statistics Summary
  const stats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const nonArchived = holidays.filter((h) => !h.is_archived);
    const ongoing = nonArchived.filter((h) => today >= h.start_date && today <= h.end_date);
    const upcoming = nonArchived.filter((h) => today < h.start_date);
    const totalDays = nonArchived.reduce((sum, h) => sum + (h.total_days || 1), 0);

    return {
      totalCount: nonArchived.length,
      ongoingCount: ongoing.length,
      upcomingCount: upcoming.length,
      totalDays,
    };
  }, [holidays]);

  return (
    <div className="space-y-6">
      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2.5 transition animate-fadeIn ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Weekly Holiday Settings Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs print:hidden space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-800">
                  সাপ্তাহিক নিয়মিত ছুটি (Weekly Holidays)
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {toBanglaNumber(weekendDays.length)} দিন নির্ধারিত
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                হাজিরা গণনা, শিক্ষাপঞ্জি ও রুটিনে এই দিনগুলোতে স্বয়ংক্রিয়ভাবে সাপ্তাহিক ছুটি গণ্য হবে
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsWeekendSelectorOpen(!isWeekendSelectorOpen)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {isWeekendSelectorOpen ? "সিলেকশন লুকান" : "সাপ্তাহিক ছুটি পরিবর্তন / নির্ধারণ করুন"}
            </button>
            <Link
              href="/dashboard/settings"
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition text-xs flex items-center gap-1"
              title="মাদরাসা জেনারেল সেটিংস থেকেও পরিবর্তন করা যায়"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Current Active Weekend Day Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-semibold text-slate-600 mr-1">বর্তমান সাপ্তাহিক ছুটি:</span>
          {weekendDays.map((dId) => {
            const dayMeta = WEEKDAYS_CONFIG.find((w) => w.id === dId);
            return (
              <span
                key={dId}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-50 border border-emerald-300 text-emerald-950 shadow-2xs"
              >
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>{dayMeta?.bn || dId}</span>
                <span className="text-[10px] text-emerald-700 font-normal">({dayMeta?.sub || "সাপ্তাহিক"})</span>
              </span>
            );
          })}
        </div>

        {/* Expanded Weekend Day Selector Panel */}
        {isWeekendSelectorOpen && (
          <div className="mt-3 pt-4 border-t border-slate-100 space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-xs text-slate-600">
                মাদরাসার জন্য সাপ্তাহিক ছুটির দিনসমূহ টিক দিয়ে নির্বাচন করুন:
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500">দ্রুত নির্বাচন:</span>
                <button
                  type="button"
                  onClick={() => setWeekendDays(["Friday"])}
                  className={`px-2.5 py-0.5 text-xs rounded-lg font-medium border transition cursor-pointer ${
                    weekendDays.length === 1 && weekendDays.includes("Friday")
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  শুধু জুমাবার (Friday)
                </button>
                <button
                  type="button"
                  onClick={() => setWeekendDays(["Thursday", "Friday"])}
                  className={`px-2.5 py-0.5 text-xs rounded-lg font-medium border transition cursor-pointer ${
                    weekendDays.length === 2 && weekendDays.includes("Thursday") && weekendDays.includes("Friday")
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  বৃহস্পতি ও জুমাবার
                </button>
                <button
                  type="button"
                  onClick={() => setWeekendDays(["Friday", "Saturday"])}
                  className={`px-2.5 py-0.5 text-xs rounded-lg font-medium border transition cursor-pointer ${
                    weekendDays.length === 2 && weekendDays.includes("Friday") && weekendDays.includes("Saturday")
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  শুক্র ও শনিবার
                </button>
              </div>
            </div>

            {/* Day Selector Buttons Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {WEEKDAYS_CONFIG.map((day) => {
                const isSelected = weekendDays.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        if (weekendDays.length > 1) {
                          setWeekendDays(weekendDays.filter((d) => d !== day.id));
                        } else {
                          showFeedback("error", "কমপক্ষে একটি দিন সাপ্তাহিক ছুটি থাকতে হবে।");
                        }
                      } else {
                        setWeekendDays([...weekendDays, day.id]);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition relative overflow-hidden cursor-pointer ${
                      isSelected
                        ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isSelected ? "text-emerald-900" : "text-slate-800"}`}>
                          {day.bn}
                        </span>
                        <span className="text-[10px] text-slate-400 font-serif">{day.ar}</span>
                      </div>
                      <span className={`text-[10px] block mt-0.5 ${isSelected ? "text-emerald-700 font-medium" : "text-slate-500"}`}>
                        {day.sub}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between pt-1 border-t border-slate-100">
                      <span className="text-[9px] text-slate-400">{day.id}</span>
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                        isSelected ? "bg-emerald-600 text-white" : "border border-slate-300"
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Save & Cancel Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
              <div className="text-[11px] text-slate-500">
                * সংরক্ষণ করার সাথে সাথে হাজিরা শিট ও অভিভাবক পোর্টালে সাপ্তাহিক ছুটি স্বয়ংক্রিয়ভাবে আপডেট হবে।
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsWeekendSelectorOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleSaveWeekendDays}
                  disabled={savingWeekend}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingWeekend ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  সাপ্তাহিক ছুটি সংরক্ষণ করুন
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">মোট ছুটি</span>
            <div className="text-xl sm:text-2xl font-black text-slate-800">
              {toBanglaNumber(stats.totalCount)} <span className="text-xs font-normal text-slate-500">টি</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">চলমান অবকাশ</span>
            <div className="text-xl sm:text-2xl font-black text-amber-600">
              {toBanglaNumber(stats.ongoingCount)} <span className="text-xs font-normal text-slate-500">টি</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">আসন্ন ছুটি</span>
            <div className="text-xl sm:text-2xl font-black text-blue-600">
              {toBanglaNumber(stats.upcomingCount)} <span className="text-xs font-normal text-slate-500">টি</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">বার্ষিক মোট বন্ধ</span>
            <div className="text-xl sm:text-2xl font-black text-purple-700">
              {toBanglaNumber(stats.totalDays)} <span className="text-xs font-normal text-slate-500">দিন</span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Filters & Action Buttons */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ছুটির নাম, স্মারক নং বা বিবরণ দিয়ে খুঁজুন..."
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {holidays.length === 0 && (
              <button
                type="button"
                onClick={handleSeedPresets}
                disabled={seeding}
                className="px-3.5 py-2 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition flex items-center gap-1.5 shadow-xs"
              >
                {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-600" />}
                কওমি বার্ষিক প্রিসেট লোড করুন
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" />
              + নতুন ছুটি তৈরি করুন
            </button>
          </div>
        </div>

        {/* Filter Badges & View Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> ফিল্টার:
            </span>

            {[
              { id: "active_upcoming", label: "চলমান ও আসন্ন" },
              { id: "all", label: "সকল ছুটি" },
              { id: "ongoing", label: "শুধু চলমান" },
              { id: "upcoming", label: "শুধু আসন্ন" },
              { id: "completed", label: "অতিক্রান্ত" },
              { id: "archived", label: "আর্কাইভকৃত" },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStatus(st.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  selectedStatus === st.id
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs py-1.5 px-3 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">সকল ক্যাটাগরি</option>
              <option value="exam_vacation">পরীক্ষার ছুটি</option>
              <option value="eid_vacation">ঈদের ছুটি</option>
              <option value="ramadan">রমজানের ছুটি</option>
              <option value="religious">ধর্মীয় ছুটি</option>
              <option value="national">জাতীয় দিবস</option>
              <option value="general">সাধারণ ছুটি</option>
              <option value="emergency">জরুরি বন্ধ</option>
            </select>
          </div>
        </div>
      </div>

      {/* Holidays List / Grid */}
      {filteredHolidays.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
            <CalendarDays className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-800">কোনো ছুটির রেকর্ড পাওয়া যায়নি</h3>
            <p className="text-xs text-slate-500">
              নির্বাচিত ফিল্টারে কোনো ছুটির তথ্য নেই। আপনি নতুন ছুটি যুক্ত করতে পারেন অথবা কওমি প্রিসেট থেকে এক ক্লিকে লোড করতে পারেন।
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              + নতুন ছুটি তৈরি করুন
            </button>
            <button
              type="button"
              onClick={handleSeedPresets}
              className="px-4 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
              প্রিসেট তালিকা লোড
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredHolidays.map((h) => {
            const today = new Date().toISOString().split("T")[0];
            const isOngoing = today >= h.start_date && today <= h.end_date;
            const isUpcoming = today < h.start_date;
            const categoryMeta = HOLIDAY_CATEGORIES[h.category as keyof typeof HOLIDAY_CATEGORIES] || {
              label: "সাধারণ ছুটি",
              color: "bg-slate-100 text-slate-800 border-slate-200",
            };

            return (
              <div
                key={h.id}
                className={`bg-white rounded-2xl border transition-all duration-200 p-5 flex flex-col justify-between space-y-4 hover:shadow-md relative overflow-hidden ${
                  h.is_archived
                    ? "border-slate-200 opacity-60 bg-slate-50/50"
                    : isOngoing
                    ? "border-amber-400 ring-2 ring-amber-400/20 shadow-xs"
                    : "border-slate-200"
                }`}
              >
                {/* Status Indicator Stripe */}
                {isOngoing && !h.is_archived && (
                  <div className="absolute top-0 right-0 left-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold py-0.5 text-center uppercase tracking-wider">
                    ● চলমান ছুটি (Active Vacation)
                  </div>
                )}

                <div className={`space-y-3 ${isOngoing && !h.is_archived ? "pt-2" : ""}`}>
                  {/* Category & Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${categoryMeta.color}`}
                    >
                      {categoryMeta.label}
                    </span>

                    <div className="flex items-center gap-1">
                      {h.publish_to_portal ? (
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold border border-emerald-200 flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          পোর্টালে উন্মুক্ত
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-medium border border-slate-200 flex items-center gap-1">
                          <EyeOff className="w-3 h-3" />
                          লুকানো
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Notice Number */}
                  <div>
                    <h3 className="text-base font-bold text-slate-800 line-clamp-2 leading-snug">
                      {h.title}
                    </h3>
                    {h.notice_number && (
                      <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                        স্মারক: {h.notice_number}
                      </span>
                    )}
                  </div>

                  {/* Dates Box */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-xs text-slate-700">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">ছুটির সময়কাল:</span>
                      <strong className="font-semibold text-slate-900">
                        {h.start_date} হতে {h.end_date}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500">মোট দিন:</span>
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-[11px]">
                        {toBanglaNumber(h.total_days || 1)} দিন
                      </span>
                    </div>

                    {h.reopen_date && (
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-indigo-900 font-medium">
                        <span>মাদরাসা খোলার তারিখ:</span>
                        <strong className="text-indigo-700">
                          {h.reopen_date} {h.reopen_time ? `(${h.reopen_time})` : ""}
                        </strong>
                      </div>
                    )}

                    {/* Applicable Classes / Department Badge */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px] text-slate-600">
                      <span className="flex items-center gap-1 text-slate-500">
                        <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                        প্রযোজ্য জামাত:
                      </span>
                      <span className="font-semibold text-slate-800 text-right truncate max-w-[180px]" title={
                        h.applicable_to === "all"
                          ? "সকল বিভাগ ও জামাত"
                          : h.applicable_to === "specific_classes" && h.applicable_classes && h.applicable_classes.length > 0
                          ? h.applicable_classes.map(cid => classes.find(c => c.id === cid)?.name || cid).join(", ")
                          : h.applicable_to === "hifz"
                          ? "হিফজুল কুরআন বিভাগ"
                          : h.applicable_to === "kitab"
                          ? "কিতাব বিভাগ"
                          : h.applicable_to === "nurani"
                          ? "নূরানী ও মক্তব বিভাগ"
                          : h.applicable_to === "najera"
                          ? "নাজেরা বিভাগ"
                          : "নির্ধারিত বিভাগ"
                      }>
                        {h.applicable_to === "all"
                          ? "সকল বিভাগ ও জামাত"
                          : h.applicable_to === "specific_classes" && h.applicable_classes && h.applicable_classes.length > 0
                          ? h.applicable_classes.map(cid => classes.find(c => c.id === cid)?.name || cid).join(", ")
                          : h.applicable_to === "hifz"
                          ? "হিফজ বিভাগ"
                          : h.applicable_to === "kitab"
                          ? "কিতাব বিভাগ"
                          : h.applicable_to === "nurani"
                          ? "নূরানী ও মক্তব"
                          : h.applicable_to === "najera"
                          ? "নাজেরা বিভাগ"
                          : "নির্ধারিত বিভাগ"}
                      </span>
                    </div>
                  </div>

                  {/* Description / Instructions */}
                  {h.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                      {h.description}
                    </p>
                  )}
                </div>

                {/* Footer Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => setNoticeHoliday(h)}
                    className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 border border-indigo-200"
                    title="নোটিশ প্রিন্ট ও পিডিএফ"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    বিজ্ঞপ্তি প্রিন্ট
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(h)}
                      className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                      title="সম্পাদনা করুন"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleArchive(h)}
                      className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                      title={h.is_archived ? "পুনরুদ্ধার করুন" : "আর্কাইভ করুন"}
                    >
                      {h.is_archived ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(h.id, h.title)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="মুছে ফেলুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create & Edit Academic Holiday */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 my-8 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    {editingHoliday ? "ছুটির বিবরণ সম্পাদনা করুন" : "নতুন ছুটি / অবকাশ যোগ করুন"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    মাদরাসার ছুটির তারিখ, খোলার দিন ও নোটিশ বিবরণী পূরণ করুন
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Preset Selector for New Holiday */}
            {!editingHoliday && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  প্রচলিত কওমি ছুটির টেমপ্লেট থেকে দ্রুত পূরণ:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_TEMPLATES.slice(0, 6).map((pst, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPreset(pst)}
                      className="px-2.5 py-1 text-[11px] rounded-lg bg-white hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 text-slate-700 font-medium transition"
                    >
                      + {pst.title.length > 22 ? pst.title.substring(0, 20) + "..." : pst.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ছুটির শিরোনাম / উপলক্ষ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="উদা: প্রথম সাময়িক পরীক্ষা পরবর্তী অবকাশ অথবা পবিত্র ঈদুল ফিতরের ছুটি"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ছুটির ক্যাটাগরি</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="exam_vacation">পরীক্ষার ছুটি (Exam Vacation)</option>
                    <option value="eid_vacation">ঈদের ছুটি (Eid Vacation)</option>
                    <option value="ramadan">রমজানুল মুবারক অবকাশ</option>
                    <option value="religious">ধর্মীয় ও বিশেষ ছুটি</option>
                    <option value="national">জাতীয় দিবস</option>
                    <option value="general">সাধারণ ছুটি</option>
                    <option value="emergency">জরুরি / দুর্যোগকালীন বন্ধ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">স্মারক নং / নোটিশ নম্বর</label>
                  <input
                    type="text"
                    value={formData.notice_number}
                    onChange={(e) => setFormData({ ...formData, notice_number: e.target.value })}
                    placeholder="উদা: মাদ/ছুটি/২০২৬/০১"
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      শুরু তারিখ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      শেষ তারিখ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      মাদরাসা খোলার তারিখ
                    </label>
                    <input
                      type="date"
                      value={formData.reopen_date}
                      onChange={(e) => setFormData({ ...formData, reopen_date: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Dynamic Reopen Time Setting */}
                <div className="pt-2.5 border-t border-slate-200/70">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      মাদরাসা খোলার সময় / উপস্থিতির সময়:
                    </label>
                    <input
                      type="text"
                      value={formData.reopen_time}
                      onChange={(e) => setFormData({ ...formData, reopen_time: e.target.value })}
                      placeholder="উদা: সকাল ৮:০০ ঘটিকা / বাদ ফজর / বাদ মাগরিব"
                      className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:w-64 font-medium"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-slate-400">দ্রুত নির্বাচন:</span>
                    {["সকাল ৮:০০ ঘটিকা", "সকাল ৯:০০ ঘটিকা", "বাদ ফজর", "বাদ মাগরিব", "সকাল ১০:০০ ঘটিকা", "বাদ আসর"].map((timeChip) => (
                      <button
                        key={timeChip}
                        type="button"
                        onClick={() => setFormData({ ...formData, reopen_time: timeChip })}
                        className={`text-[11px] px-2 py-0.5 rounded-md border transition ${
                          formData.reopen_time === timeChip
                            ? "bg-indigo-50 border-indigo-300 text-indigo-800 font-bold"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {timeChip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  প্রযোজ্য বিভাগ / জামাত
                </label>
                <select
                  value={formData.applicable_to}
                  onChange={(e) => {
                    const val = e.target.value;
                    let newClasses = [...formData.applicable_classes];
                    if (val === "all") {
                      newClasses = [];
                    } else if (val === "hifz") {
                      newClasses = classes.filter(c => c.name.includes("হিফজ") || c.name.includes("নাজেরা")).map(c => c.id);
                    } else if (val === "nurani") {
                      newClasses = classes.filter(c => c.name.includes("নূরানী") || c.name.includes("মক্তব")).map(c => c.id);
                    } else if (val === "kitab") {
                      newClasses = classes.filter(c => !c.name.includes("হিফজ") && !c.name.includes("নূরানী") && !c.name.includes("মক্তব")).map(c => c.id);
                    }
                    setFormData({ ...formData, applicable_to: val, applicable_classes: newClasses });
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="all">সকল বিভাগ ও জামাতের জন্য প্রযোজ্য</option>
                  <option value="specific_classes">নির্দিষ্ট জামাতসমূহ (বাছাই করুন)</option>
                  <option value="kitab">শুধু কিতাব বিভাগ</option>
                  <option value="hifz">শুধু হিফজুল কুরআন বিভাগ</option>
                  <option value="najera">শুধু নাজেরা বিভাগ</option>
                  <option value="nurani">শুধু নূরানী ও মক্তব বিভাগ</option>
                </select>
              </div>

              {/* Class Selection Box */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                    মাদরাসার জামাতসমূহ নির্বাচন ({classes.length}টি জামাত উপলব্ধ):
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, applicable_to: "specific_classes", applicable_classes: classes.map(c => c.id) })}
                      className="text-emerald-700 hover:underline font-semibold"
                    >
                      সকল জামাত
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, applicable_classes: [] })}
                      className="text-slate-500 hover:underline"
                    >
                      ক্লিয়ার করুন
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200">
                  {classes.map((cls) => {
                    const isChecked = formData.applicable_classes.includes(cls.id);
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => {
                          const next = isChecked
                            ? formData.applicable_classes.filter((id) => id !== cls.id)
                            : [...formData.applicable_classes, cls.id];
                          setFormData({
                            ...formData,
                            applicable_to: next.length > 0 && next.length < classes.length ? "specific_classes" : formData.applicable_to,
                            applicable_classes: next,
                          });
                        }}
                        className={`flex items-center gap-1.5 p-1.5 rounded text-left transition text-xs border ${
                          isChecked
                            ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold"
                            : "bg-white border-slate-100 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 pointer-events-none shrink-0"
                        />
                        <span className="truncate">{cls.name}</span>
                      </button>
                    );
                  })}
                </div>
                {formData.applicable_classes.length > 0 && (
                  <div className="text-[11px] text-emerald-800 font-medium">
                    ✓ নির্বাচিত জামাত: {toBanglaNumber(formData.applicable_classes.length)}টি
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  বিস্তারিত নোটিশ ও নির্দেশনাবলী (শিক্ষার্থী ও অভিভাবকদের জন্য)
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="উদা: নির্ধারিত ছুটি শেষে সকল শিক্ষার্থীকে সকাল ৮:০০ ঘটিকার মধ্যে মাদরাসায় উপস্থিত থাকার নির্দেশ দেওয়া হলো।"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="portal_pub"
                  checked={formData.publish_to_portal}
                  onChange={(e) => setFormData({ ...formData, publish_to_portal: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <label htmlFor="portal_pub" className="text-xs text-slate-700 cursor-pointer font-medium">
                  প্যারেন্ট ও স্টুডেন্ট পোর্টালে ছুটির নোটিশ ও ক্যালেন্ডারে প্রকাশ করুন
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      সংরক্ষণ হচ্ছে...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      {editingHoliday ? "হালনাগাদ সম্পন্ন করুন" : "ছুটি সংরক্ষণ করুন"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Official Vacation Notice for Printing */}
      {noticeHoliday && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 my-8 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-800">
                  ছুটির অফিসিয়াল নোটিশ ও বিজ্ঞপ্তি প্রিন্ট
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintNotice}
                  className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                >
                  <Printer className="w-3.5 h-3.5" />
                  প্রিন্ট / PDF ডাউনলোড
                </button>
                <button
                  type="button"
                  onClick={() => setNoticeHoliday(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Live Adjustment of Reopen Time and Memo Number before printing */}
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                {/* Reopen Time */}
                {noticeHoliday.reopen_date && (
                  <div className="flex items-center gap-2 text-amber-900">
                    <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                    <span className="font-semibold">মাদরাসা খোলার সময়:</span>
                    <input
                      type="text"
                      value={noticeHoliday.reopen_time || "সকাল ৮:০০ ঘটিকা"}
                      onChange={(e) => setNoticeHoliday({ ...noticeHoliday, reopen_time: e.target.value })}
                      className="px-2.5 py-1 text-xs border border-amber-300 rounded-lg bg-white font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-36"
                      placeholder="উপস্থিতির সময়"
                    />
                  </div>
                )}

                {/* Memo Number */}
                <div className="flex items-center gap-2 text-amber-900">
                  <span className="font-semibold">স্মারক নম্বর:</span>
                  <input
                    type="text"
                    value={noticeHoliday.notice_number || ""}
                    onChange={(e) => setNoticeHoliday({ ...noticeHoliday, notice_number: e.target.value })}
                    className="px-2.5 py-1 text-xs border border-amber-300 rounded-lg bg-white font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44"
                    placeholder="উদা: মাদ/ছুটি/২০২৬/০১"
                  />
                </div>
              </div>

              {/* Time Presets */}
              {noticeHoliday.reopen_date && (
                <div className="flex items-center gap-1">
                  {["সকাল ৮:০০ ঘটিকা", "সকাল ৯:০০ ঘটিকা", "বাদ ফজর", "বাদ মাগরিব"].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setNoticeHoliday({ ...noticeHoliday, reopen_time: chip })}
                      className={`text-[10px] px-2 py-0.5 rounded transition border cursor-pointer ${
                        (noticeHoliday.reopen_time || "সকাল ৮:০০ ঘটিকা") === chip
                          ? "bg-amber-200 border-amber-400 text-amber-950 font-bold"
                          : "bg-white border-amber-200 text-slate-700 hover:bg-amber-100"
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Official Letterhead Notice Body */}
            <div id="printable-holiday-notice" className="border border-slate-200 rounded-xl p-6 bg-white">
              <PrintLetterpad
                madrasaInfo={madrasaInfo}
                title="ছুটির বিজ্ঞপ্তি"
                memoNumber={noticeHoliday.notice_number || "মাদ/ছুটি/২০২৬/০১"}
              >
                <div className="space-y-6 pt-4 text-slate-800 font-serif">
                  {/* Subject Headline */}
                  <div className="text-center space-y-1.5 py-2">
                    <h2 className="text-lg sm:text-xl font-bold underline decoration-2 underline-offset-4 text-slate-900">
                      বিষয়: {noticeHoliday.title}
                    </h2>
                    <span className="text-xs text-slate-600 font-sans">
                      (প্রযোজ্য:{" "}
                      {noticeHoliday.applicable_to === "all"
                        ? "মাদরাসার সকল বিভাগ ও জামাত"
                        : noticeHoliday.applicable_to === "specific_classes" && noticeHoliday.applicable_classes && noticeHoliday.applicable_classes.length > 0
                        ? `নির্দিষ্ট জামাতসমূহ (${noticeHoliday.applicable_classes.map(cid => classes.find(c => c.id === cid)?.name || cid).join(", ")})`
                        : noticeHoliday.applicable_to === "hifz"
                        ? "হিফজুল কুরআন বিভাগ"
                        : noticeHoliday.applicable_to === "kitab"
                        ? "কিতাব বিভাগ"
                        : noticeHoliday.applicable_to === "nurani"
                        ? "নূরানী ও মক্তব বিভাগ"
                        : noticeHoliday.applicable_to === "najera"
                        ? "নাজেরা বিভাগ"
                        : "নির্ধারিত বিভাগ"}
                      )
                    </span>
                  </div>

                  {/* Body Paragraph */}
                  <div className="text-sm leading-relaxed text-slate-800 space-y-4 text-justify">
                    <p>
                      এতদ্বারা মাদরাসার সম্মানিত শিক্ষকমণ্ডলী, অভিভাবকবৃন্দ এবং সকল শিক্ষার্থীদের অবগতির জন্য জানানো যাচ্ছে যে,{" "}
                      <strong>{noticeHoliday.title}</strong> উপলক্ষে আগামী{" "}
                      <strong>{noticeHoliday.start_date}</strong> খ্রিষ্টাব্দ হতে{" "}
                      <strong>{noticeHoliday.end_date}</strong> খ্রিষ্টাব্দ পর্যন্ত মোট{" "}
                      <strong>{toBanglaNumber(noticeHoliday.total_days || 1)} দিন</strong> মাদরাসার যাবতীয় পাঠদান ও শ্রেণি কার্যক্রম বন্ধ থাকবে।
                    </p>

                    {noticeHoliday.reopen_date && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center font-sans font-bold text-slate-900 text-sm">
                        ছুটি শেষে মাদরাসা পুনরায় খোলার তারিখ:{" "}
                        <span className="text-emerald-700 underline underline-offset-2">
                          {noticeHoliday.reopen_date} খ্রিষ্টাব্দ ({noticeHoliday.reopen_time || "সকাল ৮:০০ ঘটিকা"})
                        </span>
                      </div>
                    )}

                    {noticeHoliday.description && (
                      <p className="p-3 bg-slate-50/60 rounded-xl border border-slate-100 text-xs sm:text-sm italic">
                        <strong>বিশেষ নির্দেশনাবলী:</strong> {noticeHoliday.description}
                      </p>
                    )}

                    <p>
                      ছুটিকালীন সময়ে শিক্ষার্থীদের নিয়মিত নামায আদায়, কুরআন তিলাওয়াত এবং দৈনন্দিন পাঠ রিভিশন বজায় রাখার জন্য সম্মানিত অভিভাবকদের বিশেষভাবে অনুরোধ করা হলো।
                    </p>
                  </div>

                  {/* Signatures */}
                  <div className="pt-12 flex items-end justify-between text-xs sm:text-sm">
                    <div className="text-center space-y-1">
                      <div className="w-32 border-b border-slate-400 mx-auto"></div>
                      <span className="block font-semibold">নাজেমে তা'লীমাত</span>
                      <span className="text-[11px] text-slate-500">শিক্ষা বিভাগ</span>
                    </div>

                    <div className="text-center space-y-1">
                      <div className="w-36 border-b border-slate-400 mx-auto"></div>
                      <span className="block font-bold">মুহতামিম / অধ্যক্ষ</span>
                      <span className="text-[11px] text-slate-500">{madrasaInfo?.name || "মাদরাসা কর্তৃপক্ষ"}</span>
                    </div>
                  </div>
                </div>
              </PrintLetterpad>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
