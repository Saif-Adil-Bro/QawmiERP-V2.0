"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Bell, Calendar, Tag } from "lucide-react";
import { seedPortalOfflineCache, type PortalSyncType } from "@/lib/portal-sync";
import { useOfflinePortalSnapshot } from "@/hooks/useOfflinePortalData";

interface PortalNoticesClientProps {
  portalType: PortalSyncType;
  title: string;
  subtitle: string;
  accent?: "indigo" | "rose";
  notices: any[];
  emptyTitle?: string;
  emptySubtitle?: string;
}

function formatBanglaNoticeDate(iso?: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("bn-BD", {
      timeZone: "Asia/Dhaka",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return String(iso).slice(0, 10);
  }
}

export default function PortalNoticesClient({
  portalType,
  title,
  subtitle,
  accent = "indigo",
  notices,
  emptyTitle = "বর্তমানে কোনো নতুন নোটিশ নেই",
  emptySubtitle = "মাদরাসা থেকে নতুন ঘোষণা দেওয়া হলে এখানে দেখতে পাবেন।",
}: PortalNoticesClientProps) {
  const offlineSnapshot = useOfflinePortalSnapshot();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!notices?.length) return;
    seedPortalOfflineCache(portalType, { notices });
  }, [portalType, notices]);

  const effectiveNotices = useMemo(() => {
    if (notices.length > 0) return notices;
    return offlineSnapshot?.notices || [];
  }, [notices, offlineSnapshot?.notices]);

  const isRose = accent === "rose";

  const resolveCategoryLabel = (n: any) => {
    if (n.category) return n.category;
    if (n.target_audience === "parents" || n.target_audience === "parent") {
      return "অভিভাবক বিজ্ঞপ্তি";
    }
    if (n.target_audience === "teachers" || n.target_audience === "teacher") {
      return "শিক্ষক বিজ্ঞপ্তি";
    }
    if (n.target_audience === "all" || n.target_audience === "All") {
      return "সার্বিক বিজ্ঞপ্তি";
    }
    return isRose ? "দাপ্তরিক নোটিশ" : "সাধারণ নোটিশ";
  };

  return (
    <div className="space-y-5 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl shrink-0 ${
              isRose ? "bg-rose-50 text-rose-700" : "bg-indigo-50 text-indigo-700"
            }`}
          >
            <Bell className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-slate-900">{title}</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Notices List */}
      <div className="space-y-3.5 sm:space-y-4">
        {effectiveNotices.length > 0 ? (
          effectiveNotices.map((n: any) => (
            <div
              key={n.id}
              className={`bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs transition space-y-3 ${
                isRose ? "hover:border-rose-300" : "hover:border-indigo-300"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-lg border inline-flex items-center gap-1.5 ${
                    isRose
                      ? "text-rose-700 bg-rose-50 border-rose-100"
                      : "text-indigo-700 bg-indigo-50 border-indigo-100"
                  }`}
                >
                  <Tag className="w-3.5 h-3.5 shrink-0" />
                  <span>{resolveCategoryLabel(n)}</span>
                </span>
                <span className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    {mounted && n.created_at
                      ? formatBanglaNoticeDate(n.created_at)
                      : n.created_at
                      ? String(n.created_at).slice(0, 10)
                      : "-"}
                  </span>
                </span>
              </div>

              <h2 className="text-base sm:text-lg font-bold text-slate-900 break-words">
                {n.title}
              </h2>
              <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed break-words">
                {n.content}
              </p>
            </div>
          ))
        ) : (
          <div className="p-10 sm:p-12 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
            <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="font-bold text-slate-700">{emptyTitle}</h4>
            <p className="text-xs text-slate-400 mt-1">{emptySubtitle}</p>
          </div>
        )}
      </div>
    </div>
  );
}
