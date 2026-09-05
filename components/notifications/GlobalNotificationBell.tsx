"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Calendar,
  MessageSquare,
  UserPlus,
  AlertCircle,
  Clock,
  RotateCw,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Info,
} from "lucide-react";
import {
  getGlobalNotifications,
  GlobalNotificationItem,
  NotificationStats,
  NotificationCategory,
} from "@/app/actions/notifications";
import { toBanglaNumber } from "@/lib/numberToBangla";

export default function GlobalNotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"ALL" | NotificationCategory>("ALL");
  const [notifications, setNotifications] = useState<GlobalNotificationItem[]>([]);
  const [stats, setStats] = useState<NotificationStats>({
    total: 0,
    unread: 0,
    pendingLeaves: 0,
    pendingComplaints: 0,
    pendingAdmissions: 0,
  });
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load read notification IDs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("qawmi_read_notification_ids");
      if (stored) {
        setReadIds(new Set(JSON.parse(stored)));
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch notifications
  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await getGlobalNotifications(35);
      if (res && res.notifications) {
        setNotifications(res.notifications);
        setStats(res.stats);
      }
    } catch (err) {
      console.warn("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();

    // Poll every 60 seconds
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click or escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Compute unread count considering local readIds
  const effectiveUnreadCount = notifications.filter((n) => {
    if (readIds.has(n.id)) return false;
    return n.status === "PENDING" || n.status === "UNREAD";
  }).length;

  const handleMarkAllAsRead = () => {
    const allIds = new Set(notifications.map((n) => n.id));
    setReadIds(allIds);
    try {
      localStorage.setItem("qawmi_read_notification_ids", JSON.stringify(Array.from(allIds)));
    } catch {
      // ignore
    }
  };

  const handleNotificationClick = (item: GlobalNotificationItem) => {
    const nextReadIds = new Set(readIds);
    nextReadIds.add(item.id);
    setReadIds(nextReadIds);
    try {
      localStorage.setItem("qawmi_read_notification_ids", JSON.stringify(Array.from(nextReadIds)));
    } catch {
      // ignore
    }
    setIsOpen(false);
    router.push(item.link);
  };

  // Filter items based on active tab
  const filteredItems = notifications.filter((item) => {
    if (activeTab === "ALL") return true;
    return item.category === activeTab;
  });

  // Relative time helper
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const now = new Date();
      const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
      if (diffMin < 1) return "এইমাত্র";
      if (diffMin < 60) return `${toBanglaNumber(diffMin)} মিনিট আগে`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${toBanglaNumber(diffHours)} ঘণ্টা আগে`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return "গতকাল";
      if (diffDays < 7) return `${toBanglaNumber(diffDays)} দিন আগে`;
      return `${toBanglaNumber(d.getDate())}/${toBanglaNumber(d.getMonth() + 1)}`;
    } catch {
      return "";
    }
  };

  const getCategoryIcon = (category: NotificationCategory, severity: string) => {
    switch (category) {
      case "LEAVE":
        return (
          <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0">
            <Clock className="w-4 h-4" />
          </div>
        );
      case "COMPLAINT":
        return (
          <div className={`p-2 rounded-xl shrink-0 ${severity === "CRITICAL" ? "bg-red-100 text-red-800" : "bg-purple-100 text-purple-800"}`}>
            <MessageSquare className="w-4 h-4" />
          </div>
        );
      case "ADMISSION":
        return (
          <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl shrink-0">
            <UserPlus className="w-4 h-4" />
          </div>
        );
      case "ACADEMIC":
        return (
          <div className="p-2 bg-blue-100 text-blue-800 rounded-xl shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="p-2 bg-slate-100 text-slate-700 rounded-xl shrink-0">
            <Info className="w-4 h-4" />
          </div>
        );
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            loadNotifications();
          }
        }}
        className={`relative p-2 sm:p-2.5 rounded-xl border transition flex items-center justify-center cursor-pointer ${
          isOpen
            ? "bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-500/20"
            : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200/80 shadow-xs"
        }`}
        aria-label="বিজ্ঞপ্তি ও আপডেট"
        title="বিজ্ঞপ্তি ও আপডেট"
      >
        <Bell className="w-4 h-4 sm:w-5 sm:h-5" />

        {/* Unread Badge with Ping */}
        {effectiveUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-600 text-white text-[10px] font-extrabold shadow-xs">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative z-10">
              {effectiveUnreadCount > 9 ? "৯+" : toBanglaNumber(effectiveUnreadCount)}
            </span>
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2.5 w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
          style={{ maxHeight: "calc(88vh - 4rem)" }}
        >
          {/* Header */}
          <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">বিজ্ঞপ্তি ও আপডেট</span>
              {effectiveUnreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  {toBanglaNumber(effectiveUnreadCount)} টি নতুন
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={loadNotifications}
                disabled={loading}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition"
                title="রিফ্রেশ করুন"
              >
                <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
              </button>

              {effectiveUnreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition flex items-center gap-1 text-xs font-semibold"
                  title="সব পড়া হয়েছে হিসেবে মার্ক করুন"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline text-[11px]">পড়া হয়েছে</span>
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="p-2 border-b border-slate-100 bg-white flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("ALL")}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs whitespace-nowrap transition ${
                activeTab === "ALL"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              সব ({toBanglaNumber(notifications.length)})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("LEAVE")}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs whitespace-nowrap transition flex items-center gap-1 ${
                activeTab === "LEAVE"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60"
              }`}
            >
              <span>ছুটি</span>
              {stats.pendingLeaves > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-200 text-amber-950 font-black">
                  {toBanglaNumber(stats.pendingLeaves)}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("COMPLAINT")}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs whitespace-nowrap transition flex items-center gap-1 ${
                activeTab === "COMPLAINT"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/60"
              }`}
            >
              <span>অভিযোগ</span>
              {stats.pendingComplaints > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-200 text-rose-950 font-black">
                  {toBanglaNumber(stats.pendingComplaints)}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("ADMISSION")}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs whitespace-nowrap transition flex items-center gap-1 ${
                activeTab === "ADMISSION"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60"
              }`}
            >
              <span>ভর্তি</span>
              {stats.pendingAdmissions > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-200 text-emerald-950 font-black">
                  {toBanglaNumber(stats.pendingAdmissions)}
                </span>
              )}
            </button>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100 max-h-[380px]">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <RotateCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                <span>লোড হচ্ছে...</span>
              </div>
            ) : filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const isItemUnread = !readIds.has(item.id) && (item.status === "PENDING" || item.status === "UNREAD");

                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`p-3 sm:p-3.5 hover:bg-slate-50 transition cursor-pointer flex items-start gap-3 text-left relative ${
                      isItemUnread ? "bg-emerald-50/40" : ""
                    }`}
                  >
                    {/* Unread indicator dot */}
                    {isItemUnread && (
                      <span className="absolute left-1.5 top-5 w-1.5 h-1.5 bg-emerald-600 rounded-full" />
                    )}

                    {getCategoryIcon(item.category, item.severity)}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {item.title}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          {formatTime(item.timestamp)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-1.5">
                        {item.description}
                      </p>

                      <div className="flex items-center justify-between text-[10px]">
                        <span className="px-2 py-0.5 rounded-md font-semibold bg-slate-100 text-slate-600">
                          {item.sourceModule}
                        </span>

                        {item.status === "PENDING" ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            অমীমাংসিত
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            নিষ্পন্ন
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-400 space-y-1">
                <CheckCheck className="w-8 h-8 mx-auto text-emerald-500 mb-1" />
                <p className="text-xs font-bold text-slate-700">কোনো নোটিফিকেশন নেই</p>
                <p className="text-[11px] text-slate-400">এই ক্যাটাগরিতে কোনো অমীমাংসিত আপডেট নেই।</p>
              </div>
            )}
          </div>

          {/* Footer view all link */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center shrink-0">
            <Link
              href="/dashboard/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 transition flex items-center justify-center gap-1.5 py-1"
            >
              <span>সকল নোটিফিকেশন ও অ্যাক্টিভিটি লগ দেখুন</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
