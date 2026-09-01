"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, User, X, Check, GraduationCap, ChevronDown, Sparkles, Plus, RefreshCw } from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";

export interface StudentItem {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  roll_number?: string | number | null;
  roll?: string | number | null;
  student_id?: string | null;
  class_id?: string | null;
  class_name?: string | null;
  classes?: { id?: string; name?: string } | null;
  father_name?: string | null;
  parent_phone?: string | null;
  phone?: string | null;
  [key: string]: any;
}

interface StudentSearchSelectorProps {
  students: StudentItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (studentId: string, student?: StudentItem | null) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  name?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  label?: string;
  className?: string;
}

// Convert English numbers to Bangla and Bangla to English for flexible searching
function normalizeSearchText(text: string | number | null | undefined): string {
  if (!text) return "";
  const str = String(text).toLowerCase().trim();
  const banglaToEng: Record<string, string> = {
    "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
    "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
  };
  const engToBangla: Record<string, string> = {
    "0": "০", "1": "১", "2": "২", "3": "৩", "4": "৪",
    "5": "৫", "6": "৬", "7": "৭", "8": "৮", "9": "৯",
  };
  const engForm = str.replace(/[০-৯]/g, (ch) => banglaToEng[ch] || ch);
  const bngForm = str.replace(/[0-9]/g, (ch) => engToBangla[ch] || ch);
  return `${str} ${engForm} ${bngForm}`;
}

export default function StudentSearchSelector({
  students = [],
  value,
  defaultValue,
  onChange,
  onRefresh,
  isRefreshing = false,
  name = "student_id",
  id,
  required = false,
  placeholder = "শিক্ষার্থী বেছে নিন...",
  label,
  className = "",
}: StudentSearchSelectorProps) {
  const [selectedId, setSelectedId] = useState<string>(value || defaultValue || "");
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("all");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync when controlled `value` changes
  useEffect(() => {
    if (value !== undefined) {
      setSelectedId(value);
    }
  }, [value]);

  // Extract unique classes for filter pills
  const availableClasses = useMemo(() => {
    const classSet = new Set<string>();
    students.forEach((s) => {
      const cName = s.class_name || s.classes?.name;
      if (cName && cName.trim()) {
        classSet.add(cName.trim());
      }
    });
    return Array.from(classSet);
  }, [students]);

  // Currently selected student object
  const currentStudent = useMemo(() => {
    return students.find((s) => s.id === selectedId) || null;
  }, [students, selectedId]);

  // Filter students based on query and class filter
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      // Class filter check
      const studentClass = (s.class_name || s.classes?.name || "").trim();
      if (selectedClassFilter !== "all" && studentClass !== selectedClassFilter) {
        return false;
      }

      if (!q) return true;

      // Full Name & Combined Name
      const fullName = `${s.first_name || ""} ${s.last_name || ""} ${s.name || ""}`.toLowerCase();
      const normQuery = q.toLowerCase();

      if (fullName.includes(normQuery)) return true;

      // Roll search (with Bangla/English digits)
      const rollNorm = normalizeSearchText(s.roll_number ?? s.roll);
      if (rollNorm.includes(normQuery)) return true;

      // Student ID / Reg ID search
      const studentIdNorm = normalizeSearchText(s.student_id || s.id);
      if (studentIdNorm.includes(normQuery)) return true;

      // Class Name search
      if (studentClass.toLowerCase().includes(normQuery)) return true;

      // Father's Name / Phone search
      if (s.father_name && s.father_name.toLowerCase().includes(normQuery)) return true;
      if (s.parent_phone && s.parent_phone.includes(normQuery)) return true;
      if (s.phone && s.phone.includes(normQuery)) return true;

      return false;
    });
  }, [students, searchQuery, selectedClassFilter]);

  // Open modal and focus search
  const handleOpen = () => {
    setIsOpen(true);
    setSearchQuery("");
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 80);
  };

  const handleSelect = (s: StudentItem) => {
    setSelectedId(s.id);
    setIsOpen(false);
    if (onChange) {
      onChange(s.id, s);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedId("");
    if (onChange) {
      onChange("", null);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Hidden input for HTML form submission */}
      <input type="hidden" name={name} id={id} value={selectedId} required={required} />

      {label && (
        <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <User className="w-4 h-4 text-slate-500" />
            <span>{label}</span>
            {required && <span className="text-red-500">*</span>}
          </span>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                title="শিক্ষার্থীর তালিকা রিফ্রেশ করুন"
                disabled={isRefreshing}
                className="text-[11px] font-medium text-slate-500 hover:text-emerald-700 flex items-center gap-1 cursor-pointer transition"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`} />
                <span>রিফ্রেশ</span>
              </button>
            )}
            {currentStudent && (
              <span className="text-[11px] font-normal text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                নির্বাচিত শিক্ষার্থী
              </span>
            )}
          </div>
        </label>
      )}

      {/* Trigger Button: Shows unselected placeholder or selected student summary */}
      {!currentStudent ? (
        <button
          type="button"
          onClick={handleOpen}
          className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white border border-slate-300 hover:border-slate-400 rounded-xl text-left transition focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-xs group cursor-pointer"
        >
          <div className="flex items-center gap-2.5 text-slate-500 group-hover:text-slate-700">
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:text-slate-600 group-hover:bg-slate-200 transition">
              <Search className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm text-slate-600 font-medium">{placeholder}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
              সার্চ করুন ({toBanglaNumber(students.length)})
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </div>
        </button>
      ) : (
        <div
          onClick={handleOpen}
          className="w-full p-2.5 sm:p-3 bg-emerald-50/60 border-2 border-emerald-400/80 hover:border-emerald-500 rounded-xl flex items-center justify-between cursor-pointer transition shadow-xs group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
              {(currentStudent.first_name || currentStudent.name || "শ")[0]}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 text-sm truncate">
                  {currentStudent.first_name ? `${currentStudent.first_name} ${currentStudent.last_name || ""}`.trim() : (currentStudent.name || "শিক্ষার্থী")}
                </span>
                {currentStudent.roll_number !== undefined && currentStudent.roll_number !== null && currentStudent.roll_number !== "" && (
                  <span className="text-[11px] font-bold text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-300">
                    রোল: {toBanglaNumber(currentStudent.roll_number)}
                  </span>
                )}
                {(currentStudent.class_name || currentStudent.classes?.name) && (
                  <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                    {currentStudent.class_name || currentStudent.classes?.name}
                  </span>
                )}
              </div>
              {(currentStudent.father_name || currentStudent.parent_phone || currentStudent.phone) && (
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {currentStudent.father_name ? `পিতা: ${currentStudent.father_name}` : ""}
                  {(currentStudent.parent_phone || currentStudent.phone) ? ` • মোবাইল: ${toBanglaNumber(currentStudent.parent_phone || currentStudent.phone)}` : ""}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <button
              type="button"
              onClick={handleClear}
              title="শিক্ষার্থী পরিবর্তন বা বাতিল করুন"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Search & Selection Modal Pop-up Box */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-4 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/10 rounded-lg">
                  <Search className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">শিক্ষার্থী নির্বাচন করুন</h3>
                  <p className="text-[11px] text-slate-300">নাম, রোল নম্বর বা জামাত লিখে খুঁজুন</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onRefresh && (
                  <button
                    type="button"
                    onClick={onRefresh}
                    title="রিফ্রেশ করুন"
                    disabled={isRefreshing}
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search Input Bar */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 shrink-0 space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="শিক্ষার্থীর নাম / রোল (যেমন: ১১ বা 11) / জামাত..."
                  className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition shadow-inner"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-md transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Class Filter Chips (if multiple classes exist) */}
              {availableClasses.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setSelectedClassFilter("all")}
                    className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition cursor-pointer ${
                      selectedClassFilter === "all"
                        ? "bg-slate-900 text-white"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    সকল জামাত ({toBanglaNumber(students.length)})
                  </button>
                  {availableClasses.map((cls) => {
                    const count = students.filter(
                      (s) => (s.class_name || s.classes?.name) === cls
                    ).length;
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => setSelectedClassFilter(cls)}
                        className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition cursor-pointer ${
                          selectedClassFilter === cls
                            ? "bg-slate-900 text-white"
                            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {cls} ({toBanglaNumber(count)})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Results Count Banner */}
            <div className="px-4 py-1.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-medium shrink-0">
              <span>পাওয়া গেছে: {toBanglaNumber(filteredStudents.length)} জন শিক্ষার্থী</span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedClassFilter("all");
                  }}
                  className="text-blue-600 hover:underline font-semibold"
                >
                  ফিল্টার মুছুন
                </button>
              )}
            </div>

            {/* Student List */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-3 divide-y divide-slate-100 space-y-1">
              {students.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
                    <User className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    আপনার মাদরাসায় এখনও কোনো শিক্ষার্থী যুক্ত করা হয়নি অথবা ডাটা লোড হতে সময় নিচ্ছে।
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    {onRefresh && (
                      <button
                        type="button"
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                        <span>পুনরায় লোড করুন</span>
                      </button>
                    )}
                    <Link
                      href="/dashboard/students/new"
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>নতুন শিক্ষার্থী যোগ করুন</span>
                    </Link>
                  </div>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <User className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-700 text-sm">কোন শিক্ষার্থী খুঁজে পাওয়া যায়নি</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    বানান বা রোল নম্বর সঠিক আছে কিনা যাচাই করুন
                  </p>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                    >
                      সার্চ রিসেট করুন
                    </button>
                  )}
                </div>
              ) : (
                filteredStudents.map((s) => {
                  const isSelected = s.id === selectedId;
                  const rollVal = s.roll_number !== undefined && s.roll_number !== null && s.roll_number !== "" ? s.roll_number : s.roll;
                  const rollStr = rollVal !== undefined && rollVal !== null && rollVal !== ""
                    ? toBanglaNumber(rollVal)
                    : null;
                  const classStr = s.class_name || s.classes?.name || "";
                  const displayName = s.first_name ? `${s.first_name} ${s.last_name || ""}`.trim() : (s.name || "শিক্ষার্থী");

                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelect(s)}
                      className={`p-2.5 sm:p-3 rounded-xl flex items-center justify-between cursor-pointer transition ${
                        isSelected
                          ? "bg-emerald-50 border border-emerald-300 text-emerald-950 font-bold"
                          : "hover:bg-slate-50 border border-transparent hover:border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            isSelected
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {(displayName || "শ")[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-bold text-slate-900 truncate">
                              {displayName}
                            </span>
                            {rollStr && (
                              <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.2 rounded border border-slate-200">
                                রোল: {rollStr}
                              </span>
                            )}
                            {classStr && (
                              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded">
                                {classStr}
                              </span>
                            )}
                          </div>
                          {(s.father_name || s.parent_phone || s.phone || s.student_id) && (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {s.father_name ? `পিতা: ${s.father_name}` : ""}
                              {(s.parent_phone || s.phone) ? ` • মোবা: ${toBanglaNumber(s.parent_phone || s.phone)}` : ""}
                              {s.student_id ? ` • আইডি: ${s.student_id}` : ""}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 ml-2">
                        {isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full border border-slate-300 flex items-center justify-center text-slate-300 hover:border-slate-500">
                            <span className="text-xs">✓</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500">
                {currentStudent ? `নির্বাচিত: ${currentStudent.first_name ? `${currentStudent.first_name} ${currentStudent.last_name || ""}`.trim() : (currentStudent.name || "শিক্ষার্থী")}` : "কোন শিক্ষার্থী নির্বাচিত হয়নি"}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                সম্পন্ন করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
