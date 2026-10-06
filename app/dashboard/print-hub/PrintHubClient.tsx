"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Printer,
  FileText,
  CreditCard,
  Award,
  Settings2,
  Sparkles,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Type,
  Layers,
  BookOpen,
  UserCheck,
  CheckSquare,
  HelpCircle,
  Copy,
  Scissors,
} from "lucide-react";
import BlankAdmissionForm from "@/components/print-hub/BlankAdmissionForm";
import BlankMoneyReceipt from "@/components/print-hub/BlankMoneyReceipt";
import ExaminerEvaluationSheet from "@/components/print-hub/ExaminerEvaluationSheet";
import CustomTableSheetBuilder from "@/components/print-hub/CustomTableSheetBuilder";
import PresetMadrasaSheets from "@/components/print-hub/PresetMadrasaSheets";
import { printElementIsolated } from "@/lib/printUtils";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { sortStudentsByRoll } from "@/lib/student-utils";

interface PrintHubClientProps {
  madrasaInfo: any;
  classes: any[];
  allStudents: any[];
}

type TabType = "admission" | "receipt" | "examiner" | "custom_builder" | "preset_sheets";

export default function PrintHubClient({
  madrasaInfo,
  classes,
  allStudents,
}: PrintHubClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>("admission");
  const [selectedFont, setSelectedFont] = useState("font-solaiman");

  // Tab 1: Admission Form States
  const [admissionSession, setAdmissionSession] = useState("১৪৪৭-৪৮ হিজরি (২০২৬-২৭ খ্রি.)");
  const [admissionFormNo, setAdmissionFormNo] = useState("");
  const [admissionCategory, setAdmissionCategory] = useState<"all" | "general" | "hifz" | "kitab">("all");
  const [admissionPaperSize, setAdmissionPaperSize] = useState<"a4" | "letter">("letter");
  const [admissionShowHeader, setAdmissionShowHeader] = useState(true);

  // Tab 2: Money Receipt States
  const [receiptLayout, setReceiptLayout] = useState<"dual" | "student" | "office">("dual");
  const [receiptPrefix, setReceiptPrefix] = useState(madrasaInfo?.prefix || "MR");
  const [defaultFeeType, setDefaultFeeType] = useState("");

  // Tab 3: Examiner Sheet States
  const [examinerExamTitle, setExaminerExamTitle] = useState("বার্ষিক পরীক্ষা — পরীক্ষক মূল্যায়ন ও নম্বর ফর্দ");
  const [examinerSubject, setExaminerSubject] = useState("কুরআন মাজিদ ও তাজবীদ");
  const [examinerClassId, setExaminerClassId] = useState("");
  const [examinerExaminerName, setExaminerExaminerName] = useState("");
  const [examinerRoomNo, setExaminerRoomNo] = useState("");
  const [examinerDate, setExaminerDate] = useState("");
  const [examinerRowCount, setExaminerRowCount] = useState(20);

  // Tab 5: Preset Sheets States
  const [presetType, setPresetType] = useState<
    "attendance_monthly" | "leave_form" | "hifz_tracker" | "hostel_meal" | "due_slip"
  >("attendance_monthly");
  const [presetClassId, setPresetClassId] = useState("");
  const [presetMonth, setPresetMonth] = useState("মুহাররম / মে");

  // Filtered and sorted Students for Examiner Sheet (ascending by Roll 1, 2, 3...)
  const examinerStudents = examinerClassId
    ? sortStudentsByRoll(
        allStudents.filter(
          (s) =>
            s.class_id === examinerClassId ||
            s.classes?.id === examinerClassId ||
            s.classes?.name === examinerClassId
        )
      )
    : [];

  const examinerClassName =
    classes.find((c) => c.id === examinerClassId)?.name || "সকল জামাত / উন্মুক্ত";

  // Filtered and sorted Students for Preset Sheets (ascending by Roll 1, 2, 3...)
  const presetStudents = presetClassId
    ? sortStudentsByRoll(
        allStudents.filter(
          (s) =>
            s.class_id === presetClassId ||
            s.classes?.id === presetClassId ||
            s.classes?.name === presetClassId
        )
      )
    : [];

  const presetClassName =
    classes.find((c) => c.id === presetClassId)?.name || "সকল জামাত";

  // Quick Print Current View
  const handlePrintCurrent = () => {
    let title = "মাদরাসা প্রিন্ট ডকুমেন্ট";
    let orientation: "portrait" | "landscape" = "portrait";
    let pageSize: "A4" | "Letter" | "auto" = "auto";

    if (activeTab === "admission") {
      title = "মাদরাসা ভর্তি আবেদন ফরম";
      orientation = "portrait";
      pageSize = admissionPaperSize === "a4" ? "A4" : "Letter";
      printElementIsolated("blank-admission-form-printable", title, orientation, pageSize);
    } else if (activeTab === "receipt") {
      title = "মাদরাসা মানি রিসিট";
      orientation = "portrait";
      printElementIsolated("blank-receipt-printable", title, orientation);
    } else if (activeTab === "examiner") {
      title = examinerExamTitle || "পরীক্ষক মূল্যায়ন শিট";
      orientation = "portrait";
      printElementIsolated("examiner-sheet-printable", title, orientation);
    } else if (activeTab === "preset_sheets") {
      title = "মাদরাসা রেজিস্টার ও ফরম";
      orientation =
        presetType === "attendance_monthly" || presetType === "hostel_meal"
          ? "landscape"
          : "portrait";
      printElementIsolated("preset-sheets-printable", title, orientation);
    }
  };

  return (
    <div className={`space-y-6 pb-16 ${selectedFont}`}>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5 print:hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Link href="/dashboard" className="hover:text-slate-800 transition">
              ড্যাশবোর্ড
            </Link>
            <span>/</span>
            <span className="text-emerald-700">প্রিন্ট ও ফরম হাব</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Printer className="w-7 h-7 text-emerald-700" />
            <span>প্রিন্ট ও ফরম হাব (Print Module Hub)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            মাদরাসার খালি ভর্তি ফরম, মানি রিসিট, পরীক্ষক মূল্যায়ন শিট ও কাস্টম ডায়নামিক টেবিল প্রিন্ট করুন
          </p>
        </div>

        {/* Global Action Tools */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Font Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-3 py-2 shadow-2xs">
            <Type className="w-4 h-4 text-slate-500 shrink-0" />
            <select
              value={selectedFont}
              onChange={(e) => setSelectedFont(e.target.value)}
              className="text-xs font-medium text-slate-700 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="font-solaiman">ফন্ট: সোলাইমান লিপি</option>
              <option value="font-shorif">ফন্ট: শরীফ শিশির</option>
              <option value="font-hindsiliguri">ফন্ট: হিন্দ শিলিগুড়ি</option>
            </select>
          </div>

          {activeTab !== "custom_builder" && (
            <button
              type="button"
              onClick={handlePrintCurrent}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer active:scale-98"
            >
              <Printer className="w-4 h-4" />
              <span>প্রিন্ট করুন (Print Now)</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 overflow-x-auto print:hidden">
        <button
          type="button"
          onClick={() => setActiveTab("admission")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer ${
            activeTab === "admission"
              ? "bg-white text-emerald-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          }`}
        >
          <FileText className="w-4 h-4 text-emerald-600" />
          <span>১. ভর্তি ফরম (Admission Form)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("receipt")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer ${
            activeTab === "receipt"
              ? "bg-white text-emerald-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          }`}
        >
          <CreditCard className="w-4 h-4 text-emerald-600" />
          <span>২. মানি রিসিট (Money Receipt)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("examiner")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer ${
            activeTab === "examiner"
              ? "bg-white text-emerald-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          }`}
        >
          <Award className="w-4 h-4 text-emerald-600" />
          <span>৩. পরীক্ষক মূল্যায়ন শিট (Examiner Sheet)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("custom_builder")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer ${
            activeTab === "custom_builder"
              ? "bg-white text-emerald-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          }`}
        >
          <Settings2 className="w-4 h-4 text-emerald-600" />
          <span>৪. কাস্টম টেবিল ও রো বিল্ডার (Custom Table Builder)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("preset_sheets")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer ${
            activeTab === "preset_sheets"
              ? "bg-white text-emerald-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          }`}
        >
          <Layers className="w-4 h-4 text-emerald-600" />
          <span>৫. প্রিসেট মাদরাসা ফরম ও শিট</span>
        </button>
      </div>

      {/* TAB 1: BLANK ADMISSION FORM */}
      {activeTab === "admission" && (
        <div className="space-y-6">
          {/* Controls */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4 print:hidden">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {/* Paper Size Selector */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setAdmissionPaperSize("letter")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    admissionPaperSize === "letter"
                      ? "bg-white text-emerald-950 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  📃 লেটার সাইজ (Letter)
                </button>
                <button
                  type="button"
                  onClick={() => setAdmissionPaperSize("a4")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    admissionPaperSize === "a4"
                      ? "bg-white text-emerald-950 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  📄 A4 সাইজ
                </button>
              </div>

              {/* Header / Pad Option */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setAdmissionShowHeader(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    admissionShowHeader
                      ? "bg-white text-emerald-950 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  🏢 প্যাড হেডার সহ
                </button>
                <button
                  type="button"
                  onClick={() => setAdmissionShowHeader(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    !admissionShowHeader
                      ? "bg-white text-emerald-950 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  📄 প্যাড ছাড়া (ছাপানো প্যাড)
                </button>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">শিক্ষাবর্ষ</label>
                <input
                  type="text"
                  value={admissionSession}
                  onChange={(e) => setAdmissionSession(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">ফরম নং প্রিফিক্স (ঐচ্ছিক)</label>
                <input
                  type="text"
                  placeholder="যেমন: ২০২৬-"
                  value={admissionFormNo}
                  onChange={(e) => setAdmissionFormNo(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrintCurrent}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer active:scale-98"
              >
                <Printer className="w-4 h-4" />
                <span>ভর্তি ফরম প্রিন্ট করুন ({admissionPaperSize === "a4" ? "A4" : "Letter"})</span>
              </button>
            </div>
          </div>

          {/* Printable Container */}
          <div className="bg-slate-100 p-4 sm:p-8 rounded-2xl border border-slate-300 shadow-inner overflow-x-auto flex justify-center">
            <div id="blank-admission-form-printable" className="bg-white rounded-xl shadow-md p-1 sm:p-2 w-full max-w-[216mm]">
              <BlankAdmissionForm
                madrasaInfo={madrasaInfo}
                customSession={admissionSession}
                customFormNo={admissionFormNo}
                formType={admissionCategory}
                paperSize={admissionPaperSize}
                showHeader={admissionShowHeader}
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BLANK MONEY RECEIPT */}
      {activeTab === "receipt" && (
        <div className="space-y-6">
          {/* Controls */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4 print:hidden">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setReceiptLayout("dual")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    receiptLayout === "dual"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  A4 ২ কপি (স্টুডেন্ট + অফিস)
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptLayout("student")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    receiptLayout === "student"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  ১ম কপি (স্টুডেন্ট)
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptLayout("office")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    receiptLayout === "office"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  ২য় কপি (অফিস)
                </button>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="রিসিট প্রিফিক্স (যেমন: MR)"
                  value={receiptPrefix}
                  onChange={(e) => setReceiptPrefix(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="ডিফল্ট ফি খাত (ঐচ্ছিক)"
                  value={defaultFeeType}
                  onChange={(e) => setDefaultFeeType(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrintCurrent}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>মানি রিসিট প্রিন্ট করুন</span>
              </button>
            </div>
          </div>

          {/* Printable Container */}
          <div className="bg-slate-100 p-4 sm:p-8 rounded-2xl border border-slate-300 shadow-inner overflow-x-auto">
            <div id="blank-receipt-printable" className="bg-white rounded-xl shadow-md p-4 max-w-3xl mx-auto">
              <BlankMoneyReceipt
                madrasaInfo={madrasaInfo}
                receiptType={receiptLayout}
                customReceiptPrefix={receiptPrefix}
                defaultFeeType={defaultFeeType}
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: EXAMINER EVALUATION SHEET */}
      {activeTab === "examiner" && (
        <div className="space-y-6">
          {/* Controls */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 print:hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">পরীক্ষার নাম/শিরোনাম</label>
                <input
                  type="text"
                  value={examinerExamTitle}
                  onChange={(e) => setExaminerExamTitle(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">বিষয়</label>
                <input
                  type="text"
                  value={examinerSubject}
                  onChange={(e) => setExaminerSubject(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">জামাত / শ্রেণি (ছাত্র লোড)</label>
                <select
                  value={examinerClassId}
                  onChange={(e) => setExaminerClassId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                >
                  <option value="">-- সম্পূর্ণ খালি রো প্রিন্ট --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({allStudents.filter((s) => s.class_id === c.id || s.classes?.id === c.id).length} জন)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">পরীক্ষক / শিক্ষকের নাম</label>
                <input
                  type="text"
                  placeholder="যেমন: মুফতি আব্দুল্লাহ সাহেব"
                  value={examinerExaminerName}
                  onChange={(e) => setExaminerExaminerName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-3">
                {!examinerClassId && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-medium">খালি রো সংখ্যা:</span>
                    <select
                      value={examinerRowCount}
                      onChange={(e) => setExaminerRowCount(Number(e.target.value))}
                      className="px-2 py-1 border border-slate-300 rounded font-bold"
                    >
                      <option value={15}>১৫টি রো</option>
                      <option value={20}>২০টি রো</option>
                      <option value={25}>২৫টি রো</option>
                      <option value={30}>৩০টি রো</option>
                      <option value={40}>৪০টি রো</option>
                    </select>
                  </div>
                )}
                {examinerClassId && (
                  <span className="text-emerald-700 font-semibold">
                    ✓ {examinerClassName} হতে মোট {toBanglaNumber(examinerStudents.length)} জন ছাত্রের তালিকা প্রস্তুত
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handlePrintCurrent}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>মূল্যায়ন শিট প্রিন্ট করুন</span>
              </button>
            </div>
          </div>

          {/* Printable Container */}
          <div className="bg-slate-100 p-4 sm:p-8 rounded-2xl border border-slate-300 shadow-inner overflow-x-auto">
            <div id="examiner-sheet-printable" className="bg-white rounded-xl shadow-md p-2">
              <ExaminerEvaluationSheet
                madrasaInfo={madrasaInfo}
                examTitle={examinerExamTitle}
                subjectName={examinerSubject}
                className={examinerClassName}
                examinerName={examinerExaminerName}
                roomNo={examinerRoomNo}
                dateStr={examinerDate}
                students={
                  examinerClassId
                    ? examinerStudents.map((s) => ({
                        roll: s.roll_number,
                        name: `${s.first_name || ""} ${s.last_name || ""}`.trim(),
                        father_name: s.guardian_name || s.father_name || "",
                      }))
                    : []
                }
                blankRowCount={examinerRowCount}
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DYNAMIC CUSTOM TABLE & ROW BUILDER */}
      {activeTab === "custom_builder" && (
        <CustomTableSheetBuilder
          madrasaInfo={madrasaInfo}
          classes={classes}
          allStudents={allStudents}
        />
      )}

      {/* TAB 5: PRESET MADRASA SHEETS */}
      {activeTab === "preset_sheets" && (
        <div className="space-y-6">
          {/* Preset Selector */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 print:hidden">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPresetType("attendance_monthly")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  presetType === "attendance_monthly"
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                মাসিক হাজিরা রেজিস্টার (Attendance Grid)
              </button>
              <button
                type="button"
                onClick={() => setPresetType("leave_form")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  presetType === "leave_form"
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                ছুটির আবেদন ফরম (Leave Form - ২ কপি)
              </button>
              <button
                type="button"
                onClick={() => setPresetType("hifz_tracker")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  presetType === "hifz_tracker"
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                হিফজ দৈনিক সবক ও আমুক্তা ট্র্যাকার
              </button>
              <button
                type="button"
                onClick={() => setPresetType("hostel_meal")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  presetType === "hostel_meal"
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                বোর্ডিং ও মিল রেজিস্টার
              </button>
              <button
                type="button"
                onClick={() => setPresetType("due_slip")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  presetType === "due_slip"
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                বকেয়া ফি তাগাদা স্লিপ (Due Slips - ৩ কপি)
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-3">
                <div>
                  <select
                    value={presetClassId}
                    onChange={(e) => setPresetClassId(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                  >
                    <option value="">-- জামাত নির্বাচন করুন (ঐচ্ছিক) --</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <input
                    type="text"
                    value={presetMonth}
                    onChange={(e) => setPresetMonth(e.target.value)}
                    placeholder="মাসের নাম"
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-semibold"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handlePrintCurrent}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>প্রিন্ট করুন</span>
              </button>
            </div>
          </div>

          {/* Printable Container */}
          <div className="bg-slate-100 p-4 sm:p-8 rounded-2xl border border-slate-300 shadow-inner overflow-x-auto">
            <div id="preset-sheets-printable" className="bg-white rounded-xl shadow-md p-2">
              <PresetMadrasaSheets
                madrasaInfo={madrasaInfo}
                sheetType={presetType}
                className={presetClassName}
                monthName={presetMonth}
                students={presetStudents}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
