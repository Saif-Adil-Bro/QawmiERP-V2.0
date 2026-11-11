"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  MoreVertical,
  Scale,
  Calendar,
  Sun,
  Search,
  User,
  Shield,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { usePermissions } from "@/components/permissions/PermissionContext";
import SessionSelector from "@/components/sessions/SessionSelector";
import { ThemeSwitcher } from "./ThemeSwitcher";

interface HeaderMoreMenuDropdownProps {
  onOpenExecutiveSummary: () => void;
  onOpenCommandPalette: () => void;
}

export function HeaderMoreMenuDropdown({
  onOpenExecutiveSummary,
  onOpenCommandPalette,
}: HeaderMoreMenuDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { profile, summary } = usePermissions();

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
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* 3-Dot More Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-xl transition-all duration-150 border shrink-0 cursor-pointer ${
          isOpen
            ? "bg-slate-200 text-slate-900 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-slate-600 shadow-sm"
            : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700"
        }`}
        title="অতিরিক্ত অপশন ও টুলস"
        aria-label="More options"
      >
        <MoreVertical className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
      </button>

      {/* Responsive Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-slate-800 dark:text-slate-100">
          {/* User Profile Capsule inside Menu */}
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
              {displayName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                {displayName}
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold truncate flex items-center gap-1">
                <Shield className="w-3 h-3 shrink-0" />
                <span>{roleLabel}</span>
              </p>
            </div>
          </div>

          <div className="p-2 space-y-1">
            {/* Quick Search */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenCommandPalette();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>খুঁজুন বা কমান্ড দিন</span>
              </div>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-400">
                Ctrl+K
              </kbd>
            </button>

            {/* Executive Summary */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenExecutiveSummary();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-amber-900 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Scale className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>নির্বাহী সামারি</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
            </button>
          </div>

          {/* Session and Theme Section */}
          <div className="px-3 pt-2 pb-1 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div>
              <span className="block text-[10px] font-bold text-slate-400 mb-1.5 px-1 uppercase tracking-wider">
                শিক্ষাবর্ষ নির্বাচন
              </span>
              <div onClick={(e) => e.stopPropagation()}>
                <SessionSelector />
              </div>
            </div>

            <div className="pt-1">
              <span className="block text-[10px] font-bold text-slate-400 mb-1.5 px-1 uppercase tracking-wider">
                মাদরাসা থিম
              </span>
              <div onClick={(e) => e.stopPropagation()}>
                <ThemeSwitcher />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
