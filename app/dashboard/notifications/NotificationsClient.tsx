"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
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
} from "lucide-react";
import {
  GlobalNotificationItem,
  NotificationStats,
  NotificationCategory,
  createSystemNotification,
} from "@/app/actions/notifications";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface NotificationsClientProps {
  initialNotifications: GlobalNotificationItem[];
  initialStats: NotificationStats;
}

export default function NotificationsClient({
  initialNotifications,
  initialStats,
}: NotificationsClientProps) {
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

  // Filtered notifications
  const filteredList = useMemo(() => {
    return notifications.filter((item) => {
      // Category filter
      if (selectedCategory !== "ALL" && item.category !== selectedCategory) {
        return false;
      }

      // Status filter
      if (selectedStatus !== "ALL") {
        if (selectedStatus === "PENDING" && item.status !== "PENDING") return false;
        if (selectedStatus === "RESOLVED" && item.status !== "RESOLVED") return false;
      }

      // Search query
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

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <Bell className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              বিজ্ঞপ্তি ও অ্যাক্টিভিটি লগ (Notifications & Logs)
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            মাদরাসার সকল গুরুত্বপূর্ণ ইভেন্ট, ছুটির দরখাস্ত, অভিভাবকের অভিযোগ ও সিস্টেমের লাইভ অডিট লগ।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition print:hidden cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>প্রিন্ট / রিপোর্ট</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-xs print:hidden cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন সিস্টেম নোটিশ পাঠান</span>
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedbackMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-2xl flex items-center gap-2 text-xs sm:text-sm font-semibold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* KPI Stats Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 print:grid-cols-4">
        {/* Total Events */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>মোট ইভেন্ট / লগ</span>
            <Bell className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">
            {toBanglaNumber(stats.total)}
          </div>
          <p className="text-[11px] text-slate-400">সর্বমোট নিবন্ধিত কার্যক্রম</p>
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
            লগ ও নোটিফিকেশন তালিকা ({toBanglaNumber(filteredList.length)} টি প্রদর্শিত)
          </span>
          <span className="text-xs text-slate-500 font-medium">লাইভ সিংক সক্রিয়</span>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredList.length > 0 ? (
            filteredList.map((item) => (
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
              <p className="text-sm font-bold text-slate-700">কোনো নোটিফিকেশন বা লগ পাওয়া যায়নি</p>
              <p className="text-xs text-slate-400">আপনার ফিল্টার বা সার্চ অনুযায়ী কোনো রেকর্ড বিদ্যমান নেই।</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create System Broadcast Notice */}
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
