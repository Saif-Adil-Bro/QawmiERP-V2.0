"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Settings2,
  Users,
  Printer,
  Save,
  RotateCcw,
  Sparkles,
  ArrowUpDown,
  MoveUp,
  MoveDown,
  Layout,
  FileSpreadsheet,
  Check,
  CheckCircle2,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { printElementIsolated } from "@/lib/printUtils";
import { sortStudentsByRoll } from "@/lib/student-utils";

export interface CustomColumn {
  id: string;
  header: string;
  width: "narrow" | "medium" | "wide" | "extra-wide";
  align: "left" | "center" | "right";
  type: "blank" | "checkbox" | "signature" | "marks";
}

export interface CustomRow {
  id: string;
  label: string; // Row name / Student name / Item
  subLabel?: string; // Roll / ID / Details
}

interface CustomTableSheetBuilderProps {
  madrasaInfo: any;
  classes: any[];
  allStudents: any[];
}

const PRESET_TEMPLATES = [
  {
    id: "examiner_viva",
    name: "মৌখিক ও কিতাব পরীক্ষা মূল্যায়ন শিট",
    title: "মাদরাসা কেন্দ্রীয় পরীক্ষা — মৌখিক ও কিতাব মূল্যায়ন ফর্দ",
    subtitle: "শিক্ষাবর্ষ: ১৪৪৭-৪৮ হিজরি (২০২৬-২৭)",
    orientation: "portrait" as const,
    columns: [
      { id: "col_1", header: "রোল", width: "narrow" as const, align: "center" as const, type: "blank" as const },
      { id: "col_2", header: "শিক্ষার্থীর নাম", width: "wide" as const, align: "left" as const, type: "blank" as const },
      { id: "col_3", header: "ইবারত পাঠ (৩০)", width: "medium" as const, align: "center" as const, type: "marks" as const },
      { id: "col_4", header: "তাহকীক ও তরজমা (৩০)", width: "medium" as const, align: "center" as const, type: "marks" as const },
      { id: "col_5", header: "মাসআলা ও ফিকহ (২০)", width: "medium" as const, align: "center" as const, type: "marks" as const },
      { id: "col_6", header: "মোট নম্বর (৮০)", width: "narrow" as const, align: "center" as const, type: "marks" as const },
      { id: "col_7", header: "স্বাক্ষর ও মন্তব্য", width: "wide" as const, align: "center" as const, type: "signature" as const },
    ],
  },
  {
    id: "hifz_daily",
    name: "হিফজুল কুরআন দৈনিক সবক ও আমুক্তা যাচাই শিট",
    title: "হিফজুল কুরআন বিভাগ — দৈনিক সবক, আমুক্তা ও তাজবীদ শিট",
    subtitle: "মাসিক নিয়মিত নিরীক্ষণ ও মূল্যায়ন",
    orientation: "landscape" as const,
    columns: [
      { id: "col_1", header: "রোল", width: "narrow" as const, align: "center" as const, type: "blank" as const },
      { id: "col_2", header: "ছাত্রের নাম", width: "wide" as const, align: "left" as const, type: "blank" as const },
      { id: "col_3", header: "বর্তমান পারা", width: "medium" as const, align: "center" as const, type: "blank" as const },
      { id: "col_4", header: "দৈনিক নতুন সবক", width: "medium" as const, align: "center" as const, type: "blank" as const },
      { id: "col_5", header: "সবকপারা মান", width: "medium" as const, align: "center" as const, type: "marks" as const },
      { id: "col_6", header: "আমুক্তা মান", width: "medium" as const, align: "center" as const, type: "marks" as const },
      { id: "col_7", header: "তাজবীদ ও মাখরাজ", width: "medium" as const, align: "center" as const, type: "marks" as const },
      { id: "col_8", header: "উস্তাদের মন্তব্য ও স্বাক্ষর", width: "extra-wide" as const, align: "center" as const, type: "signature" as const },
    ],
  },
  {
    id: "kitab_mutalaa",
    name: "কিতাব মুতালাআ ও দরস উপস্থিতি চেকলিস্ট",
    title: "দরসে নিজামী — কিতাব মুতালাআ ও তাকরার নিরীক্ষণ শিট",
    subtitle: "দৈনিক ও সাপ্তাহিক অগ্রগতি প্রতিবেদন",
    orientation: "landscape" as const,
    columns: [
      { id: "col_1", header: "ক্রম", width: "narrow" as const, align: "center" as const, type: "blank" as const },
      { id: "col_2", header: "শিক্ষার্থীর নাম", width: "wide" as const, align: "left" as const, type: "blank" as const },
      { id: "col_3", header: "পঠিত কিতাব", width: "wide" as const, align: "left" as const, type: "blank" as const },
      { id: "col_4", header: "শনিবার", width: "narrow" as const, align: "center" as const, type: "checkbox" as const },
      { id: "col_5", header: "রবিবার", width: "narrow" as const, align: "center" as const, type: "checkbox" as const },
      { id: "col_6", header: "সোমবার", width: "narrow" as const, align: "center" as const, type: "checkbox" as const },
      { id: "col_7", header: "মঙ্গলবার", width: "narrow" as const, align: "center" as const, type: "checkbox" as const },
      { id: "col_8", header: "বুধবার", width: "narrow" as const, align: "center" as const, type: "checkbox" as const },
      { id: "col_9", header: "বৃহস্পতিবার", width: "narrow" as const, align: "center" as const, type: "checkbox" as const },
      { id: "col_10", header: "মন্তব্য", width: "medium" as const, align: "center" as const, type: "blank" as const },
    ],
  },
];

export default function CustomTableSheetBuilder({
  madrasaInfo,
  classes,
  allStudents,
}: CustomTableSheetBuilderProps) {
  // Document Configuration
  const [docTitle, setDocTitle] = useState("মাদরাসা পরীক্ষা ও শিক্ষাদান মূল্যায়ন শিট");
  const [docSubtitle, setDocSubtitle] = useState("শিক্ষাবর্ষ: ১৪৪৭-৪৮ হিজরি (২০২৬-২৭)");
  const [className, setClassName] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [notesText, setNotesText] = useState("");

  // Signatures
  const [sig1, setSig1] = useState("সংশ্লিষ্ট শিক্ষক / পরীক্ষকের স্বাক্ষর");
  const [sig2, setSig2] = useState("নাজেমে তা'লীমাত (শিক্ষা সচিব)");
  const [sig3, setSig3] = useState("মুহতামিম / প্রিন্সিপাল");

  // Dynamic Columns
  const [columns, setColumns] = useState<CustomColumn[]>([
    { id: "c1", header: "ক্রম", width: "narrow", align: "center", type: "blank" },
    { id: "c2", header: "রোল নং", width: "narrow", align: "center", type: "blank" },
    { id: "c3", header: "শিক্ষার্থীর নাম / শিরোনাম", width: "wide", align: "left", type: "blank" },
    { id: "c4", header: "লিখিত (৫০)", width: "medium", align: "center", type: "marks" },
    { id: "c5", header: "মৌখিক (৩০)", width: "medium", align: "center", type: "marks" },
    { id: "c6", header: "তিলাওয়াত (২০)", width: "medium", align: "center", type: "marks" },
    { id: "c7", header: "মোট (১০০)", width: "medium", align: "center", type: "marks" },
    { id: "c8", header: "মন্তব্য ও স্বাক্ষর", width: "wide", align: "center", type: "signature" },
  ]);

  // Dynamic Rows
  const [rows, setRows] = useState<CustomRow[]>(
    Array.from({ length: 15 }).map((_, idx) => ({
      id: `row_${idx + 1}`,
      label: "",
      subLabel: "",
    }))
  );

  const [selectedClassForImport, setSelectedClassForImport] = useState("");
  const [saveToast, setSaveToast] = useState(false);

  // Load custom saved builder state on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("custom_print_sheet_builder_data");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.docTitle) setDocTitle(parsed.docTitle);
          if (parsed.docSubtitle) setDocSubtitle(parsed.docSubtitle);
          if (parsed.columns) setColumns(parsed.columns);
          if (parsed.rows) setRows(parsed.rows);
          if (parsed.orientation) setOrientation(parsed.orientation);
          if (parsed.sig1) setSig1(parsed.sig1);
          if (parsed.sig2) setSig2(parsed.sig2);
          if (parsed.sig3) setSig3(parsed.sig3);
        } catch {}
      }
    }
  }, []);

  // Save to LocalStorage
  const handleSaveTemplate = () => {
    if (typeof window !== "undefined") {
      const payload = {
        docTitle,
        docSubtitle,
        columns,
        rows,
        orientation,
        sig1,
        sig2,
        sig3,
      };
      localStorage.setItem("custom_print_sheet_builder_data", JSON.stringify(payload));
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    }
  };

  // Load Preset
  const handleLoadPreset = (presetId: string) => {
    const preset = PRESET_TEMPLATES.find((p) => p.id === presetId);
    if (!preset) return;
    setDocTitle(preset.title);
    setDocSubtitle(preset.subtitle);
    setOrientation(preset.orientation);
    setColumns(preset.columns);
  };

  // Column Actions
  const handleAddColumn = () => {
    const newCol: CustomColumn = {
      id: `col_${Date.now()}`,
      header: `নতুন কলাম ${toBanglaNumber(columns.length + 1)}`,
      width: "medium",
      align: "center",
      type: "blank",
    };
    setColumns([...columns, newCol]);
  };

  const handleUpdateColumn = (id: string, updates: Partial<CustomColumn>) => {
    setColumns(columns.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const handleDeleteColumn = (id: string) => {
    if (columns.length <= 1) return;
    setColumns(columns.filter((c) => c.id !== id));
  };

  const handleMoveColumn = (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= columns.length) return;
    const newCols = [...columns];
    const [moved] = newCols.splice(index, 1);
    newCols.splice(targetIdx, 0, moved);
    setColumns(newCols);
  };

  // Row Actions
  const handleAddRow = () => {
    const newRow: CustomRow = {
      id: `row_${Date.now()}`,
      label: "",
      subLabel: "",
    };
    setRows([...rows, newRow]);
  };

  const handleBulkAddRows = (count: number) => {
    const newRows: CustomRow[] = Array.from({ length: count }).map((_, idx) => ({
      id: `row_${Date.now()}_${idx}`,
      label: "",
      subLabel: "",
    }));
    setRows([...rows, ...newRows]);
  };

  const handleUpdateRow = (id: string, updates: Partial<CustomRow>) => {
    setRows(rows.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const handleDeleteRow = (id: string) => {
    setRows(rows.filter((r) => r.id !== id));
  };

  const handleClearAllRows = () => {
    setRows([
      { id: `row_${Date.now()}_1`, label: "", subLabel: "" },
      { id: `row_${Date.now()}_2`, label: "", subLabel: "" },
      { id: `row_${Date.now()}_3`, label: "", subLabel: "" },
    ]);
  };

  // Import Students from Selected Class (Ascending by Roll Number 1, 2, 3...)
  const handleImportStudents = () => {
    if (!selectedClassForImport) return;
    const rawClassStudents = allStudents.filter(
      (s) =>
        s.class_id === selectedClassForImport ||
        s.classes?.id === selectedClassForImport ||
        s.classes?.name === selectedClassForImport
    );

    const classStudents = sortStudentsByRoll(rawClassStudents);

    if (classStudents.length === 0) {
      alert("এই জামাতে কোনো নিবন্ধিত শিক্ষার্থী পাওয়া যায়নি।");
      return;
    }

    const importedRows: CustomRow[] = classStudents.map((s, idx) => ({
      id: `std_${s.id || idx}`,
      label: `${s.first_name || ""} ${s.last_name || ""}`.trim() || `ছাত্র ${idx + 1}`,
      subLabel: s.roll_number ? String(s.roll_number) : String(idx + 1),
    }));

    setRows(importedRows);
    const selClassObj = classes.find((c) => c.id === selectedClassForImport);
    if (selClassObj) {
      setClassName(selClassObj.name);
    }
  };

  // Print Isolated
  const handlePrint = () => {
    printElementIsolated("custom-table-sheet-printable", docTitle, orientation);
  };

  // Helpers for styling
  const getColWidthClass = (w: CustomColumn["width"]) => {
    switch (w) {
      case "narrow":
        return "w-14 min-w-[50px]";
      case "medium":
        return "w-24 min-w-[90px]";
      case "wide":
        return "w-44 min-w-[150px]";
      case "extra-wide":
        return "w-64 min-w-[200px]";
      default:
        return "w-24";
    }
  };

  const mName = madrasaInfo?.name || "মাদরাসা";
  const mAddress = madrasaInfo?.address || "";
  const logoUrl = madrasaInfo?.logo_url || "";

  return (
    <div className="space-y-6">
      {/* Top Action Bar & Settings Accordion */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-6 print:hidden">
        {/* Preset Loader & Save Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>রেডিমেড প্রিসেট:</span>
            </span>
            {PRESET_TEMPLATES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleLoadPreset(p.id)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition cursor-pointer"
              >
                {p.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveTemplate}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-slate-600" />
              <span>{saveToast ? "টেমপ্লেট সংরক্ষিত!" : "সেভ করুন"}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>এই শিট প্রিন্ট করুন</span>
            </button>
          </div>
        </div>

        {/* Form Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Col 1: Titles & Orientation */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Layout className="w-4 h-4 text-slate-600" />
              <span>১. পেজ ও হেডার সেটিংস</span>
            </h3>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                শিটের প্রধান শিরোনাম
              </label>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                উপ-শিরোনাম / শিক্ষাবর্ষ
              </label>
              <input
                type="text"
                value={docSubtitle}
                onChange={(e) => setDocSubtitle(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                প্রিন্ট ওরিয়েন্টেশন
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOrientation("portrait")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${
                    orientation === "portrait"
                      ? "bg-emerald-700 text-white border-emerald-700"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  লম্বালম্বি (Portrait)
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation("landscape")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${
                    orientation === "landscape"
                      ? "bg-emerald-700 text-white border-emerald-700"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  আড়াআড়ি (Landscape)
                </button>
              </div>
            </div>
          </div>

          {/* Col 2: Metadata Fields */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-slate-600" />
              <span>২. জামাত, বিষয় ও পরীক্ষক</span>
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">জামাত / শ্রেণি</label>
                <input
                  type="text"
                  placeholder="যেমন: শরহে বেকায়া"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">বিষয়</label>
                <input
                  type="text"
                  placeholder="যেমন: ফিকহ ও উসুল"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">ওস্তাদ / পরীক্ষকের নাম</label>
                <input
                  type="text"
                  placeholder="নাম লিখুন"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">তারিখ</label>
                <input
                  type="text"
                  placeholder="২০২৬-০৫-১৫"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">কক্ষ নম্বর / স্থান</label>
              <input
                type="text"
                placeholder="যেমন: ১০২ নম্বর হলরুম"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800"
              />
            </div>
          </div>

          {/* Col 3: Signatures & Notes */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Settings2 className="w-4 h-4 text-slate-600" />
              <span>৩. স্বাক্ষরের পদবী ও নোট</span>
            </h3>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">১ম স্বাক্ষর পদবী</label>
              <input
                type="text"
                value={sig1}
                onChange={(e) => setSig1(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 text-[11px]"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">২য় স্বাক্ষর পদবী</label>
              <input
                type="text"
                value={sig2}
                onChange={(e) => setSig2(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 text-[11px]"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">৩য় স্বাক্ষর পদবী</label>
              <input
                type="text"
                value={sig3}
                onChange={(e) => setSig3(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 text-[11px]"
              />
            </div>
          </div>
        </div>

        {/* Column Configurator (Add / Rename Columns) */}
        <div className="border-t border-slate-200 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-emerald-600" />
              <span>কলাম ব্যবস্থাপনা (কলামের নাম ও মাপ নির্ধারণ করুন) — মোট {toBanglaNumber(columns.length)}টি কলাম</span>
            </h4>
            <button
              type="button"
              onClick={handleAddColumn}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ কলাম যোগ করুন</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {columns.map((col, idx) => (
              <div
                key={col.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">কলাম {toBanglaNumber(idx + 1)}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveColumn(idx, "up")}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      title="বামে সরান"
                    >
                      <MoveUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === columns.length - 1}
                      onClick={() => handleMoveColumn(idx, "down")}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      title="ডানে সরান"
                    >
                      <MoveDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteColumn(col.id)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                      title="কলাম মুছুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={col.header}
                  onChange={(e) => handleUpdateColumn(col.id, { header: e.target.value })}
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-900 text-xs"
                  placeholder="কলামের নাম"
                />

                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    value={col.width}
                    onChange={(e) => handleUpdateColumn(col.id, { width: e.target.value as any })}
                    className="px-1.5 py-1 bg-white border border-slate-300 rounded text-[11px]"
                  >
                    <option value="narrow">ছোট (Narrow)</option>
                    <option value="medium">মাঝারি (Medium)</option>
                    <option value="wide">প্রশস্ত (Wide)</option>
                    <option value="extra-wide">অতিরিক্ত প্রশস্ত</option>
                  </select>

                  <select
                    value={col.type}
                    onChange={(e) => handleUpdateColumn(col.id, { type: e.target.value as any })}
                    className="px-1.5 py-1 bg-white border border-slate-300 rounded text-[11px]"
                  >
                    <option value="blank">ফাঁকা ঘর</option>
                    <option value="marks">নম্বর ঘর</option>
                    <option value="checkbox">চেকবক্স</option>
                    <option value="signature">স্বাক্ষর লাইন</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Row Configurator (Add / Load Student List / Bulk Blank Rows) */}
        <div className="border-t border-slate-200 pt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>রো ও ছাত্রদের তালিকা (মোট {toBanglaNumber(rows.length)}টি রো)</span>
            </h4>

            <div className="flex flex-wrap items-center gap-2">
              {/* Import from Class */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <select
                  value={selectedClassForImport}
                  onChange={(e) => setSelectedClassForImport(e.target.value)}
                  className="text-xs bg-white border border-slate-300 rounded px-2 py-1"
                >
                  <option value="">-- জামাত নির্বাচন করুন --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleImportStudents}
                  disabled={!selectedClassForImport}
                  className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded text-xs font-semibold transition cursor-pointer"
                >
                  ছাত্র লোড করুন
                </button>
              </div>

              {/* Bulk Blank Rows */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold transition cursor-pointer"
                >
                  + ১টি রো
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAddRows(10)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold transition cursor-pointer"
                >
                  + ১০টি খালি রো
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAddRows(20)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold transition cursor-pointer"
                >
                  + ২০টি খালি রো
                </button>
                <button
                  type="button"
                  onClick={handleClearAllRows}
                  className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-xs font-semibold transition cursor-pointer"
                >
                  সব খালি করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Printable Sheet Canvas */}
      <div className="bg-slate-100 p-4 sm:p-8 rounded-2xl border border-slate-300 shadow-inner overflow-x-auto">
        <div
          id="custom-table-sheet-printable"
          className={`bg-white text-slate-900 border border-slate-400 p-4 sm:p-5 print:border-none print:p-0 print:m-0 rounded-xl shadow-md mx-auto ${
            orientation === "landscape" ? "max-w-[297mm]" : "max-w-[210mm]"
          } text-xs`}
        >
          {/* Header */}
          <div className="text-center border-b-2 border-slate-800 pb-2 mb-2 space-y-0.5">
            <p className="text-[10px] font-serif text-slate-600 mb-0.5">
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </p>

            <div className="flex items-center justify-center gap-2.5">
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="w-10 h-10 object-cover rounded-full border border-slate-200"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
              <div>
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight">
                  {mName}
                </h1>
                {mAddress && <p className="text-[10px] text-slate-600">{mAddress}</p>}
              </div>
            </div>

            <div className="pt-1">
              <span className="inline-block bg-slate-900 text-white px-3.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider print:bg-black">
                {docTitle}
              </span>
            </div>

            {docSubtitle && (
              <p className="text-[11px] font-semibold text-slate-700 pt-0.5">{docSubtitle}</p>
            )}

            {/* Meta Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] font-semibold text-slate-700 pt-1.5 border-t border-slate-200 mt-1.5">
              <div className="text-left">
                জামাত: <span className="text-slate-900 font-bold">{className || "............................"}</span>
              </div>
              <div>
                বিষয়: <span className="text-slate-900 font-bold">{subjectName || "............................"}</span>
              </div>
              <div>
                শিক্ষক/পরীক্ষক: <span className="text-slate-900">{teacherName || "............................"}</span>
              </div>
              <div className="text-right">
                তারিখ: <span>{examDate || "...../...../২০২৬"}</span>
              </div>
            </div>

            {roomNumber && (
              <div className="text-right text-[9px] text-slate-500 pt-0.5">
                কক্ষ নং / স্থান: <span className="font-semibold text-slate-800">{roomNumber}</span> • মোট ছাত্র/সারি: <span className="font-bold text-slate-900">{toBanglaNumber(rows.length)} জন</span>
              </div>
            )}
          </div>

          {/* Main Custom Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[10px] border-collapse border-2 border-slate-800">
              <thead className="bg-slate-100 font-bold text-slate-900">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.id}
                      className={`border border-slate-400 p-1 text-${col.align} ${getColWidthClass(
                        col.width
                      )}`}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr
                    key={row.id || rIdx}
                    className={rIdx % 2 === 1 ? "bg-slate-50/60" : "bg-white"}
                  >
                    {columns.map((col, cIdx) => {
                      // First column: auto serial if no custom content
                      if (cIdx === 0 && col.header.includes("ক্রম")) {
                        return (
                          <td
                            key={col.id}
                            className="border border-slate-400 p-1 text-center font-mono font-medium text-slate-600"
                          >
                            {toBanglaNumber(rIdx + 1)}
                          </td>
                        );
                      }

                      // Roll column
                      if (col.header.includes("রোল")) {
                        return (
                          <td
                            key={col.id}
                            className="border border-slate-400 p-0.5 text-center font-mono font-bold text-slate-900"
                          >
                            <input
                              type="text"
                              value={row.subLabel ? toBanglaNumber(row.subLabel) : ""}
                              onChange={(e) => handleUpdateRow(row.id, { subLabel: e.target.value })}
                              placeholder=""
                              className="w-full text-center bg-transparent border-none p-0.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:bg-emerald-50 focus:ring-1 focus:ring-emerald-400 rounded"
                            />
                          </td>
                        );
                      }

                      // Name / Label column
                      if (col.header.includes("নাম") || col.header.includes("শিরোনাম") || col.header.includes("ছাত্র")) {
                        return (
                          <td
                            key={col.id}
                            className="border border-slate-400 p-0.5 font-bold text-slate-900"
                          >
                            <input
                              type="text"
                              value={row.label || ""}
                              onChange={(e) => handleUpdateRow(row.id, { label: e.target.value })}
                              placeholder="নাম/বিবরণ লিখুন..."
                              className="w-full bg-transparent border-none p-0.5 text-[11px] font-bold text-slate-900 focus:outline-none focus:bg-emerald-50 focus:ring-1 focus:ring-emerald-400 rounded placeholder:text-slate-300 print:placeholder:text-transparent"
                            />
                          </td>
                        );
                      }

                      // Checkbox type column
                      if (col.type === "checkbox") {
                        return (
                          <td
                            key={col.id}
                            className="border border-slate-400 p-1 text-center"
                          >
                            <div className="w-3.5 h-3.5 border border-slate-400 rounded mx-auto" />
                          </td>
                        );
                      }

                      // Signature type column
                      if (col.type === "signature") {
                        return (
                          <td
                            key={col.id}
                            className="border border-slate-400 p-1 text-center"
                          >
                            <div className="w-16 border-b border-dotted border-slate-400 mx-auto" />
                          </td>
                        );
                      }

                      // Blank/marks cell
                      return (
                        <td
                          key={col.id}
                          className="border border-slate-400 p-1 text-center font-mono"
                        >
                          {/* Blank for manual handwriting */}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Notes / Instructions if any */}
          {notesText && (
            <div className="mt-2 p-1.5 bg-slate-50 border border-slate-200 rounded text-[9px] text-slate-600">
              <span className="font-bold text-slate-800">বিশেষ দ্রষ্টব্য: </span>
              {notesText}
            </div>
          )}

          {/* Footer Signatures */}
          <div className="pt-5 flex items-center justify-between text-xs text-slate-800 font-semibold">
            <div className="text-center w-36">
              <div className="border-t border-slate-500 pt-0.5">{sig1}</div>
            </div>
            <div className="text-center w-40">
              <div className="border-t border-slate-500 pt-0.5">{sig2}</div>
            </div>
            <div className="text-center w-36">
              <div className="border-t border-slate-500 pt-0.5 font-bold text-slate-900">{sig3}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
