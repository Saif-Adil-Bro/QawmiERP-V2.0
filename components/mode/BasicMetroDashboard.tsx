"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Plus,
  ArrowUpRight,
  Sparkles,
  Layers,
  X,
  Settings2,
  Calendar,
  CheckCircle2,
  Wallet,
  Users,
} from "lucide-react";
import { useAppMode } from "./ModeContext";
import { BasicTileLibraryModal } from "./BasicTileLibraryModal";
import { toDhakaDateString } from "@/lib/date-utils";

interface BasicMetroDashboardProps {
  stats?: {
    studentsCount?: number;
    todayPresent?: number;
    todayAbsent?: number;
    totalIncome?: number;
    totalExpense?: number;
  };
}

export function BasicMetroDashboard({ stats }: BasicMetroDashboardProps) {
  const { pinnedTiles, removeTile, mode } = useAppMode();
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const todayStr = new Intl.DateTimeFormat("bn-BD", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Tile Library Modal */}
      <BasicTileLibraryModal
        isOpen={libraryModalOpen}
        onClose={() => setLibraryModalOpen(false)}
      />

      {/* Hero Welcome & Quick Glance Bar */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-6 sm:p-8 text-white shadow-xl border border-slate-700/50">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5" />
              <span>সহজ বেসিক মোড সক্রিয়</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              আস-সালামু আলাইকুম, স্বাগতম!
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm flex items-center gap-1.5 font-medium">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>আজকের দিন: {todayStr}</span>
            </p>
          </div>

          {/* Quick Metrics Capsule */}
          {stats && (
            <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-white/10 backdrop-blur-md p-2.5 sm:p-3 rounded-2xl border border-white/15">
              <div className="text-center px-2 py-1">
                <span className="block text-[11px] text-slate-300 font-medium">মোট ছাত্র</span>
                <span className="text-base sm:text-xl font-black text-white">
                  {stats.studentsCount ?? 0}
                </span>
              </div>
              <div className="text-center px-2 py-1 border-x border-white/10">
                <span className="block text-[11px] text-emerald-300 font-medium">উপস্থিত</span>
                <span className="text-base sm:text-xl font-black text-emerald-300">
                  {stats.todayPresent ?? 0}
                </span>
              </div>
              <div className="text-center px-2 py-1">
                <span className="block text-[11px] text-amber-300 font-medium">আজকের জমা</span>
                <span className="text-base sm:text-xl font-black text-amber-300">
                  ৳{(stats.totalIncome ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Decorative Backdrop Glow */}
        <div className="absolute -right-20 -bottom-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Header with Title and Customization Actions */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>প্রধান কাজ ও সেবাসমূহ</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
              {pinnedTiles.length} টি অপশন
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            প্রয়োজনীয় ফিচারে ক্লিক করে সরাসরি কাজ শুরু করুন
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tile Management / Edit mode toggle */}
          <button
            type="button"
            onClick={() => setEditMode(!editMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
              editMode
                ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-700"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-750"
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>{editMode ? "সম্পাদনা শেষ" : "কার্ড সাজান"}</span>
          </button>

          {/* Quick Add Button */}
          <button
            type="button"
            onClick={() => setLibraryModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>নতুন যোগ করুন</span>
          </button>
        </div>
      </div>

      {/* Windows Metro Style Tiles Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
        {pinnedTiles.map((tile) => {
          const Icon = tile.icon;

          return (
            <div
              key={tile.id}
              className="relative group transition-all duration-200 hover:-translate-y-1 hover:shadow-xl rounded-3xl"
            >
              {/* Optional Remove button in edit mode */}
              {editMode && (
                <button
                  type="button"
                  onClick={() => removeTile(tile.id)}
                  className="absolute -top-2 -right-2 z-20 w-7 h-7 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition"
                  title="এই কার্ডটি রিমুভ করুন"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              <Link
                href={tile.href}
                className={`relative block h-48 sm:h-52 p-5 rounded-3xl overflow-hidden bg-gradient-to-br ${tile.gradient} text-white shadow-lg ${tile.shadowColor} border border-white/20 flex flex-col justify-between group-hover:ring-2 group-hover:ring-white/40 transition-all`}
              >
                {/* Background Geometric Accent / Windows Metro Feel */}
                <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-15 group-hover:opacity-25 transition-opacity pointer-events-none">
                  <Icon className="w-36 h-36" />
                </div>

                {/* Top Section: Icon & Badge */}
                <div className="relative z-10 flex items-start justify-between">
                  <div className="w-13 h-13 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner group-hover:scale-105 transition-transform">
                    <Icon className="w-7 h-7 text-white" />
                  </div>

                  <div className="flex items-center gap-1.5">
                    {tile.badge && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-black/20 backdrop-blur-md border border-white/25 text-white">
                        {tile.badge}
                      </span>
                    )}
                    <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowUpRight className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>

                {/* Bottom Section: Title & Subtitle */}
                <div className="relative z-10 space-y-1 mt-auto">
                  <h3 className="text-lg sm:text-xl font-black tracking-tight leading-snug drop-shadow-xs">
                    {tile.title}
                  </h3>
                  <p className="text-xs text-white/80 line-clamp-2 font-medium leading-relaxed">
                    {tile.subtitle}
                  </p>
                </div>

                {/* Subtle Glass Shimmer Effect */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/10 pointer-events-none" />
              </Link>
            </div>
          );
        })}

        {/* The Final BIG (+) PLUS Tile (Windows Add Tile Style) */}
        <button
          type="button"
          onClick={() => setLibraryModalOpen(true)}
          className="relative h-48 sm:h-52 p-5 rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-400 bg-white/70 dark:bg-slate-900/60 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 backdrop-blur-md flex flex-col items-center justify-center text-center gap-3 group transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer"
        >
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-md group-hover:shadow-amber-500/30">
            <Plus className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <span className="font-extrabold text-base sm:text-lg text-slate-800 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors block">
              নতুন অপশন যোগ করুন
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px] leading-relaxed">
              ক্লিক করে আপনার প্রয়োজনীয় যেকোনো মেনু বা ফিচার এখানে যুক্ত করুন
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
