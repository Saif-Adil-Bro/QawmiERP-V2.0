"use client";

import React, { useState } from "react";
import {
  X,
  Plus,
  Check,
  Search,
  Sparkles,
  RotateCcw,
  Layers,
} from "lucide-react";
import { ALL_BASIC_TILES, BasicTileItem } from "./menuCatalog";
import { useAppMode } from "./ModeContext";

interface BasicTileLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BasicTileLibraryModal({ isOpen, onClose }: BasicTileLibraryModalProps) {
  const { pinnedTileIds, addTile, removeTile, resetTiles } = useAppMode();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  if (!isOpen) return null;

  const categories = [
    { id: "all", label: "সকল অপশন" },
    { id: "academic", label: "একাডেমিক ও হিফজ" },
    { id: "finance", label: "হিসাব ও অনুদান" },
    { id: "services", label: "সেবা ও বোর্ডিং" },
    { id: "management", label: "প্রশাসন ও অন্যান্য" },
  ];

  const filteredTiles = ALL_BASIC_TILES.filter((tile) => {
    const matchesCat =
      selectedCategory === "all" || tile.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === "" ||
      tile.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tile.subtitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden text-slate-800 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                বেসিক ড্যাশবোর্ডে নতুন মেনু ও কার্ড যোগ করুন
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                আপনার প্রয়োজনমতো যেকোনো কার্ড স্ক্রিনে যুক্ত করুন বা বাদ দিন
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Filter Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0 bg-white dark:bg-slate-900">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="মেনু খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tiles Grid Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 overscroll-contain">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {filteredTiles.map((tile) => {
              const Icon = tile.icon;
              const isPinned = pinnedTileIds.includes(tile.id);

              return (
                <div
                  key={tile.id}
                  className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                    isPinned
                      ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/50 shadow-xs"
                      : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    {/* Tile Mini Graphic Icon */}
                    <div
                      className={`w-11 h-11 rounded-xl bg-gradient-to-br ${tile.gradient} text-white flex items-center justify-center shrink-0 shadow-md`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {tile.title}
                        </h4>
                        {tile.badge && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold shrink-0 border ${
                              tile.badgeColor || "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {tile.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {tile.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-400">
                      {isPinned ? "ড্যাশবোর্ডে সচল আছে" : "যুক্ত করতে ক্লিক করুন"}
                    </span>

                    {isPinned ? (
                      <button
                        type="button"
                        onClick={() => removeTile(tile.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold transition cursor-pointer"
                        title="ড্যাশবোর্ড থেকে সরান"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>সরিয়ে নিন</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addTile(tile.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>যোগ করুন</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={resetTiles}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>ডিফল্ট মেনুতে ফেরত যান</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs sm:text-sm rounded-xl shadow-md hover:opacity-90 transition cursor-pointer"
          >
            সম্পন্ন
          </button>
        </div>
      </div>
    </div>
  );
}
