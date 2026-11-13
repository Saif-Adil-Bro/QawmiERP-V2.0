"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  X,
  Plus,
  ArrowUpRight,
  Sparkles,
  Settings2,
  Calendar,
  Layers,
  LayoutGrid,
  LayoutDashboard,
} from "lucide-react";
import { useAppMode } from "./ModeContext";
import { BasicTileLibraryModal } from "./BasicTileLibraryModal";

interface WindowsStartScreenProps {
  stats?: {
    studentsCount?: number;
    todayPresent?: number;
    todayAbsent?: number;
    todayIncome?: number;
    totalIncome?: number;
  };
}

export function WindowsStartScreen({ stats }: WindowsStartScreenProps) {
  const { isStartMenuOpen, closeStartMenu, pinnedTiles, removeTile } = useAppMode();
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  if (!isStartMenuOpen) return null;

  const todayStr = new Intl.DateTimeFormat("bn-BD", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/85 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200 select-none overflow-y-auto overscroll-contain text-white"
      onClick={closeStartMenu}
    >
      {/* Inner Container */}
      <div
        className="w-full max-w-6xl mx-auto min-h-screen p-4 sm:p-6 lg:p-8 flex flex-col justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Windows 10 Start Menu Header Bar */}
        <header className="flex items-center justify-between pb-6 border-b border-white/10 shrink-0">
          {/* Brand & Mode Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 border border-white/20">
              <LayoutGrid className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                  <span>স্টার্ট মেনু</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    সহজ মোড
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>{todayStr}</span>
              </p>
            </div>
          </div>

          {/* Quick Metrics & Close Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {stats && (
              <div className="hidden md:flex items-center gap-3 bg-white/5 border border-white/10 px-3 py-1.5 rounded-2xl backdrop-blur-md">
                <div className="text-center px-2">
                  <span className="block text-[10px] text-slate-400">মোট ছাত্র</span>
                  <span className="text-xs font-bold text-white">
                    {stats.studentsCount ?? 0}
                  </span>
                </div>
                <div className="text-center px-2 border-l border-white/10">
                  <span className="block text-[10px] text-emerald-400">উপস্থিত</span>
                  <span className="text-xs font-bold text-emerald-400">
                    {stats.todayPresent ?? 0}
                  </span>
                </div>
                <div className="text-center px-2 border-l border-white/10">
                  <span className="block text-[10px] text-amber-400">আজকের জমা</span>
                  <span className="text-xs font-bold text-amber-400">
                    ৳{(stats.todayIncome ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Direct Back to Main Dashboard Home Link */}
            <Link
              href="/dashboard"
              onClick={closeStartMenu}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/40 shadow-sm transition cursor-pointer active:scale-95"
              title="মূল ড্যাশবোর্ডে ফিরে যান"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>মূল ড্যাশবোর্ড</span>
            </Link>

            {/* Customization Edit Mode */}
            <button
              type="button"
              onClick={() => setEditMode(!editMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                editMode
                  ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md"
                  : "bg-white/10 hover:bg-white/15 text-slate-200 border-white/10"
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {editMode ? "সম্পাদনা শেষ" : "কার্ড সাজান"}
              </span>
            </button>

            {/* Windows 10 Red Close [X] Button */}
            <button
              type="button"
              onClick={closeStartMenu}
              className="group flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-rose-600 text-white rounded-xl transition-all duration-150 border border-white/15 shadow-md cursor-pointer"
              title="স্টার্ট মেনু বন্ধ করুন (Esc)"
            >
              <span className="text-xs font-bold hidden sm:inline text-slate-300 group-hover:text-white">
                বন্ধ করুন (Esc)
              </span>
              <div className="w-5 h-5 flex items-center justify-center">
                <X className="w-4 h-4" />
              </div>
            </button>
          </div>
        </header>

        {/* Center Tiles Grid Area */}
        <main className="my-auto py-8 sm:py-12">
          {/* Subtitle / Hints */}
          <div className="flex items-center justify-between mb-5 px-1">
            <h2 className="text-base sm:text-lg font-bold text-slate-200 flex items-center gap-2">
              <span>প্রধান সেবাসমূহ ও কাজ</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-normal">
                {pinnedTiles.length} টি অপশন
              </span>
            </h2>

            <button
              type="button"
              onClick={() => setLibraryModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ অপশন যোগ</span>
            </button>
          </div>

          {/* Windows Metro Style Tiles Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {pinnedTiles.map((tile) => {
              const Icon = tile.icon;

              return (
                <div
                  key={tile.id}
                  className="relative group transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl rounded-3xl"
                >
                  {/* Remove button in edit mode */}
                  {editMode && (
                    <button
                      type="button"
                      onClick={() => removeTile(tile.id)}
                      className="absolute -top-2 -right-2 z-20 w-7 h-7 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition cursor-pointer"
                      title="এই কার্ডটি রিমুভ করুন"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  <Link
                    href={tile.href}
                    onClick={closeStartMenu}
                    className={`relative block h-44 sm:h-48 p-5 rounded-3xl overflow-hidden bg-gradient-to-br ${tile.gradient} text-white shadow-lg ${tile.shadowColor} border border-white/20 flex flex-col justify-between group-hover:ring-2 group-hover:ring-white/50 transition-all`}
                  >
                    {/* Background Graphic Accent */}
                    <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-15 group-hover:opacity-25 transition-opacity pointer-events-none">
                      <Icon className="w-36 h-36" />
                    </div>

                    {/* Top Section */}
                    <div className="relative z-10 flex items-start justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner group-hover:scale-105 transition-transform">
                        <Icon className="w-6 h-6 text-white" />
                      </div>

                      <div className="flex items-center gap-1.5">
                        {tile.badge && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-black/25 backdrop-blur-md border border-white/20 text-white">
                            {tile.badge}
                          </span>
                        )}
                        <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <ArrowUpRight className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    </div>

                    {/* Bottom Section */}
                    <div className="relative z-10 space-y-1 mt-auto">
                      <h3 className="text-base sm:text-lg font-black tracking-tight leading-snug drop-shadow-xs text-white">
                        {tile.title}
                      </h3>
                      <p className="text-xs text-white/80 line-clamp-2 font-medium leading-relaxed">
                        {tile.subtitle}
                      </p>
                    </div>

                    {/* Gloss Shimmer */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/10 pointer-events-none" />
                  </Link>
                </div>
              );
            })}

            {/* The Final BIG (+) PLUS Tile */}
            <button
              type="button"
              onClick={() => setLibraryModalOpen(true)}
              className="relative h-44 sm:h-48 p-5 rounded-3xl border-2 border-dashed border-white/25 hover:border-amber-400 bg-white/5 hover:bg-amber-500/10 backdrop-blur-md flex flex-col items-center justify-center text-center gap-3 group transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all shadow-md">
                <Plus className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <span className="font-extrabold text-sm sm:text-base text-white group-hover:text-amber-300 transition-colors block">
                  নতুন অপশন যোগ করুন
                </span>
                <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed">
                  ক্লিক করে আপনার প্রয়োজনীয় যেকোনো মেনু বা ফিচার এখানে যুক্ত করুন
                </p>
              </div>
            </button>
          </div>
        </main>

        {/* Footer Hint */}
        <footer className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>উইন্ডোজ স্টার্ট মেনু স্টাইল ফুল স্ক্রিন ভিউ</span>
          </div>
          <div>
            <span>বাহিরে ক্লিক করুন বা কীবোর্ডের </span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-white font-mono text-[11px]">
              Esc
            </kbd>
            <span> চাপুন</span>
          </div>
        </footer>
      </div>

      {/* Tile Library Modal */}
      <BasicTileLibraryModal
        isOpen={libraryModalOpen}
        onClose={() => setLibraryModalOpen(false)}
      />
    </div>
  );
}
