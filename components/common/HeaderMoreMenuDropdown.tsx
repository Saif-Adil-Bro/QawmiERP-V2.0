"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  MoreVertical,
  Scale,
  Calendar,
  Sun,
  Moon,
  BookOpen,
  Search,
  Shield,
  ChevronRight,
  Sparkles,
  Zap,
  Rocket,
  LayoutGrid,
  LogOut,
  Check,
  ChevronDown,
  Palette,
} from "lucide-react";
import { usePermissions } from "@/components/permissions/PermissionContext";
import { useSession } from "@/components/sessions/SessionContext";
import { useTheme, QawmiTheme } from "./ThemeContext";
import { useAppMode } from "@/components/mode/ModeContext";
import { logout } from "@/app/actions/auth";

interface HeaderMoreMenuDropdownProps {
  onOpenExecutiveSummary: () => void;
  onOpenCommandPalette: () => void;
}

export function HeaderMoreMenuDropdown({
  onOpenExecutiveSummary,
  onOpenCommandPalette,
}: HeaderMoreMenuDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionDropdownOpen, setSessionDropdownOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { profile, summary } = usePermissions();
  const { mode, setMode, openStartMenu } = useAppMode();
  const { theme, setTheme } = useTheme();
  const {
    sessions,
    selectedSession,
    changeSelectedSession,
    currentSession,
  } = useSession();

  const isBasic = mode === "basic";

  const roleId = summary?.primaryRole || profile?.primaryRole || "super_admin";
  const roleNameMap: Record<string, string> = {
    super_admin: "সুপার অ্যাডমিন",
    admin: "অ্যাডমিন",
    muhtamim: "মুহতামিম",
    naib_muhtamim: "নায়েবে মুহতামিম",
    education_secretary: "শিক্ষা সচিব",
    exam_manager: "পরীক্ষা নিয়ন্ত্রক",
    teacher: "শিক্ষক",
    accountant: "হিসাবরক্ষক",
    hifz_teacher: "হিফজ উস্তাদ",
    parent: "অভিভাবক",
    student: "শিক্ষার্থী",
    staff: "স্টাফ",
  };
  const displayName = profile?.fullName || "ব্যবহারকারী";
  const roleLabel = roleNameMap[roleId] || roleId;

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSessionDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
    } catch (e) {
      console.error(e);
      setLoggingOut(false);
    }
  };

  const themes: { id: QawmiTheme; label: string; icon: any; color: string }[] = [
    { id: "light", label: "কওমি লাইট", icon: Sun, color: "text-amber-500" },
    { id: "dark", label: "নাইট মোড", icon: Moon, color: "text-indigo-400" },
    { id: "sepia", label: "মুতালা'আ", icon: BookOpen, color: "text-amber-700" },
  ];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Mobile Backdrop overlay when menu is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs transition-opacity duration-200 xl:hidden"
          onClick={() => {
            setIsOpen(false);
            setSessionDropdownOpen(false);
          }}
          aria-hidden="true"
        />
      )}

      {/* Modern Interactive 3-Dot Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl transition-all duration-200 border shrink-0 cursor-pointer shadow-2xs ${
          isOpen
            ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-500/20 scale-105"
            : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/90 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 active:scale-95"
        }`}
        title="কুইক মেনু, থিম ও সেটিংস"
        aria-label="More options"
        aria-expanded={isOpen}
      >
        <MoreVertical className={`w-4 h-4 sm:w-4.5 sm:h-4.5 transition-transform duration-200 ${isOpen ? "rotate-90 text-emerald-600 dark:text-emerald-400" : ""}`} />
      </button>

      {/* Responsive Glassmorphic Dropdown Sheet */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-88 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 py-3 z-50 animate-in fade-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100 divide-y divide-slate-100 dark:divide-slate-800/80">
          {/* User Profile Header Card */}
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-black text-sm shadow-md shrink-0">
                    {displayName.charAt(0)}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold truncate flex items-center gap-1 mt-0.5">
                    <Shield className="w-3 h-3 shrink-0" />
                    <span>{roleLabel}</span>
                  </p>
                </div>
              </div>

              {/* Mode indicator pill inside header */}
              <div className="shrink-0">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                    isBasic
                      ? "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300"
                      : "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300"
                  }`}
                >
                  {isBasic ? (
                    <>
                      <Zap className="w-3 h-3 fill-amber-500 text-amber-500" />
                      <span>সহজ মোড</span>
                    </>
                  ) : (
                    <>
                      <Rocket className="w-3 h-3 fill-emerald-600 text-emerald-600" />
                      <span>অ্যাডভান্সড</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Mode Quick Switcher Strip inside Profile */}
            <div className="mt-2.5 flex items-center justify-between bg-slate-100/90 dark:bg-slate-800/80 p-1 rounded-xl text-xs">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 px-2">
                সিস্টেম মোড:
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMode("basic")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    isBasic
                      ? "bg-amber-500 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  }`}
                >
                  সহজ
                </button>
                <button
                  type="button"
                  onClick={() => setMode("advanced")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    !isBasic
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  }`}
                >
                  অ্যাডভান্সড
                </button>
              </div>
            </div>
          </div>

          {/* Quick Action Interactive Cards Grid */}
          <div className="p-3">
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-2 px-1 uppercase tracking-wider">
              কুইক অ্যাকশন ও সামারি
            </span>

            <div className="grid grid-cols-2 gap-2">
              {/* Universal Search Card */}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenCommandPalette();
                }}
                className="group flex flex-col items-start p-2.5 rounded-2xl bg-slate-50 hover:bg-emerald-50/70 border border-slate-200/80 hover:border-emerald-300 dark:bg-slate-800/50 dark:hover:bg-emerald-950/30 dark:border-slate-700/80 dark:hover:border-emerald-700 transition-all duration-150 cursor-pointer text-left shadow-2xs hover:scale-102"
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                    <Search className="w-4 h-4" />
                  </div>
                  <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-500 font-semibold">
                    Ctrl+K
                  </kbd>
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                  খুঁজুন বা কমান্ড
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5 leading-tight">
                  কমান্ড প্যালেট
                </span>
              </button>

              {/* Executive Summary Card */}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenExecutiveSummary();
                }}
                className="group flex flex-col items-start p-2.5 rounded-2xl bg-amber-50/60 hover:bg-amber-100/70 border border-amber-200/80 hover:border-amber-300 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 dark:border-amber-800/80 dark:hover:border-amber-700 transition-all duration-150 cursor-pointer text-left shadow-2xs hover:scale-102"
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                    <Scale className="w-4 h-4" />
                  </div>
                  <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-200/70 text-amber-900 dark:bg-amber-900/60 dark:text-amber-300 rounded-md">
                    এক নজরে
                  </span>
                </div>
                <span className="text-xs font-bold text-amber-950 dark:text-amber-300">
                  নির্বাহী সামারি
                </span>
                <span className="text-[10px] text-amber-700/80 dark:text-amber-400 mt-0.5 leading-tight">
                  মাদরাসার সার্বিক চিত্র
                </span>
              </button>
            </div>

            {/* If in Basic Mode: Windows Start Screen Full Trigger */}
            {isBasic && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  openStartMenu();
                }}
                className="mt-2 w-full flex items-center justify-between p-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer group hover:scale-101 active:scale-98"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1 rounded-lg bg-white/20">
                    <LayoutGrid className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="leading-tight">উইন্ডোজ স্টার্ট মেনু খুলুন</div>
                    <div className="text-[10px] text-amber-100 font-normal mt-0.5">
                      সব রঙিন মেট্রো কার্ড ও মডিউল
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 opacity-75 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>

          {/* Interactive Theme Switcher Section */}
          <div className="p-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-3 h-3 text-slate-400" />
                <span>মাদরাসা থিম ও ডিসপ্লে</span>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {themes.map((t) => {
                const Icon = t.icon;
                const isSelected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-2xl border transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? "bg-emerald-50 border-emerald-400 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-600 dark:text-emerald-200 shadow-2xs scale-102 font-bold ring-1 ring-emerald-500/20"
                        : "bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-700 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-300 font-medium hover:border-slate-300"
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-1 ${t.color}`} />
                    <span className="text-[11px] leading-tight text-center">{t.label}</span>
                    {isSelected && (
                      <Check className="w-3 h-3 mt-1 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Academic Session Selector Section */}
          <div className="p-3">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>সক্রিয় শিক্ষাবর্ষ</span>
              </span>
              {selectedSession?.is_current && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                  চলতি সেশন
                </span>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setSessionDropdownOpen(!sessionDropdownOpen)}
                className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 dark:bg-slate-800/50 dark:hover:bg-slate-800 dark:border-slate-700 transition cursor-pointer text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {selectedSession?.name || "শিক্ষাবর্ষ লোড হচ্ছে..."}
                    </p>
                    {selectedSession?.hijri_year && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-400">
                        হিজরী: {selectedSession.hijri_year}
                      </p>
                    )}
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    sessionDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Session Picker List */}
              {sessionDropdownOpen && (
                <div className="mt-1.5 max-h-40 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 p-1 space-y-0.5 shadow-lg">
                  {sessions.map((s) => {
                    const isSelected = selectedSession?.id === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          changeSelectedSession(s.id);
                          setSessionDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition cursor-pointer ${
                          isSelected
                            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold"
                            : "hover:bg-slate-50 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        }`}
                      >
                        <div>
                          <div className="font-semibold">{s.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {s.hijri_year ? `হিজরী: ${s.hijri_year}` : s.academic_year || ""}
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Logout Footer */}
          <div className="px-3 pt-2 pb-1">
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full flex items-center justify-center gap-2 p-2 rounded-2xl text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 transition text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{loggingOut ? "লগআউট হচ্ছে..." : "সিস্টেম থেকে লগআউট"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
