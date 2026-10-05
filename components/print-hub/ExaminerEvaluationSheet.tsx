"use client";

import React from "react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { sortStudentsByRoll } from "@/lib/student-utils";

export interface EvaluationColumn {
  id: string;
  label: string;
  maxMarks?: number | string;
  width?: string;
  align?: "left" | "center" | "right";
}

interface ExaminerEvaluationSheetProps {
  madrasaInfo: any;
  examTitle?: string;
  subjectName?: string;
  className?: string;
  sessionName?: string;
  examinerName?: string;
  roomNo?: string;
  dateStr?: string;
  students?: { roll?: string | number; name: string; father_name?: string }[];
  blankRowCount?: number;
  columns?: EvaluationColumn[];
}

export default function ExaminerEvaluationSheet({
  madrasaInfo,
  examTitle = "বার্ষিক পরীক্ষা — পরীক্ষক মূল্যায়ন ও নম্বর ফর্দ",
  subjectName = "কুরআন মাজিদ ও তাজবীদ",
  className = "হিফজুল কুরআন বিভাগ",
  sessionName = "১৪৪৭-৪৮ হিজরি (২০২৬-২৭)",
  examinerName = "",
  roomNo = "",
  dateStr = "",
  students = [],
  blankRowCount = 20,
  columns,
}: ExaminerEvaluationSheetProps) {
  const mName = madrasaInfo?.name || "মাদরাসা";
  const mAddress = madrasaInfo?.address || "";
  const logoUrl = madrasaInfo?.logo_url || "";

  // Default examination evaluation columns if not provided
  const defaultColumns: EvaluationColumn[] = [
    { id: "sl", label: "ক্রম", width: "w-10", align: "center" },
    { id: "roll", label: "রোল নং", width: "w-16", align: "center" },
    { id: "name", label: "শিক্ষার্থীর পূর্ণ নাম", width: "w-48", align: "left" },
    { id: "father", label: "পিতার নাম", width: "w-36", align: "left" },
    { id: "written", label: "লিখিত (৫০)", maxMarks: 50, width: "w-16", align: "center" },
    { id: "oral", label: "মৌখিক (৩০)", maxMarks: 30, width: "w-16", align: "center" },
    { id: "tilawat", label: "তিলাওয়াত (২০)", maxMarks: 20, width: "w-16", align: "center" },
    { id: "total", label: "মোট (১০০)", maxMarks: 100, width: "w-16", align: "center" },
    { id: "remarks", label: "মন্তব্য ও স্বাক্ষর", width: "w-32", align: "center" },
  ];

  const activeColumns = columns && columns.length > 0 ? columns : defaultColumns;

  // Sort students ascending by roll number (1, 2, 3...)
  const sortedStudents = sortStudentsByRoll(students || []);

  // Generate display rows based on provided students or blank rows
  const displayRows =
    sortedStudents && sortedStudents.length > 0
      ? sortedStudents.map((s: any, idx: number) => ({
          sl: toBanglaNumber(idx + 1),
          roll: s.roll || s.roll_number ? toBanglaNumber(s.roll || s.roll_number) : toBanglaNumber(idx + 1),
          name: s.name || `${s.first_name || ""} ${s.last_name || ""}`.trim() || `ছাত্র ${idx + 1}`,
          father: s.father_name || "",
        }))
      : Array.from({ length: blankRowCount }).map((_, idx) => ({
          sl: toBanglaNumber(idx + 1),
          roll: "",
          name: "",
          father: "",
        }));

  return (
    <div className="bg-white text-slate-900 w-full max-w-[210mm] mx-auto p-4 sm:p-5 border border-slate-300 print:border-none print:p-0 print:m-0 text-xs">
      {/* Header */}
      <div className="text-center border-b-2 border-slate-800 pb-2 mb-2 space-y-0.5">
        <p className="text-[10px] font-serif text-slate-600">
          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
        </p>

        <div className="flex items-center justify-center gap-2.5">
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Logo"
              className="w-10 h-10 object-contain"
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
            {examTitle}
          </span>
        </div>

        {/* Sub-meta Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] font-semibold text-slate-700 pt-1.5 border-t border-slate-200 mt-1.5">
          <div className="text-left">
            জামাত: <span className="text-slate-900 font-bold">{className}</span>
          </div>
          <div>
            বিষয়: <span className="text-slate-900 font-bold">{subjectName}</span>
          </div>
          <div>
            শিক্ষাবর্ষ: <span>{sessionName}</span>
          </div>
          <div className="text-right">
            তারিখ: <span>{dateStr || "...../...../২০২৬"}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-600 pt-0.5">
          <div className="text-left">
            পরীক্ষক / ওস্তাদের নাম: <span className="font-semibold text-slate-900">{examinerName || "................................................"}</span>
          </div>
          <div className="text-right">
            কক্ষ নং: <span className="font-semibold text-slate-900">{roomNo || ".........."}</span> • মোট পরীক্ষার্থী: <span className="font-bold text-slate-900">{toBanglaNumber(displayRows.length)} জন</span>
          </div>
        </div>
      </div>

      {/* Main Examination Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[10px] border-collapse border-2 border-slate-800">
          <thead className="bg-slate-100 font-bold text-slate-900">
            <tr>
              {activeColumns.map((col) => (
                <th
                  key={col.id}
                  className={`border border-slate-400 p-1 text-${col.align || "center"} ${col.width || ""}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, idx) => (
              <tr
                key={idx}
                className={idx % 2 === 1 ? "bg-slate-50/60" : "bg-white"}
              >
                {activeColumns.map((col) => {
                  if (col.id === "sl") {
                    return (
                      <td
                        key={col.id}
                        className="border border-slate-400 p-1 text-center font-mono font-medium text-slate-600"
                      >
                        {row.sl}
                      </td>
                    );
                  }
                  if (col.id === "roll") {
                    return (
                      <td
                        key={col.id}
                        className="border border-slate-400 p-1 text-center font-mono font-bold text-slate-900"
                      >
                        {row.roll}
                      </td>
                    );
                  }
                  if (col.id === "name") {
                    return (
                      <td
                        key={col.id}
                        className="border border-slate-400 p-1 font-bold text-slate-900"
                      >
                        {row.name}
                      </td>
                    );
                  }
                  if (col.id === "father") {
                    return (
                      <td
                        key={col.id}
                        className="border border-slate-400 p-1 text-slate-700"
                      >
                        {row.father}
                      </td>
                    );
                  }
                  return (
                    <td
                      key={col.id}
                      className="border border-slate-400 p-1 text-center font-mono"
                    >
                      {/* Blank cell for handwriting */}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Signatures */}
      <div className="pt-5 flex items-center justify-between text-xs text-slate-800 font-semibold">
        <div className="text-center w-36">
          <div className="border-t border-slate-500 pt-0.5">পরীক্ষকের স্বাক্ষর</div>
          <p className="text-[9px] text-slate-500 font-normal">তারিখ সহ</p>
        </div>
        <div className="text-center w-40">
          <div className="border-t border-slate-500 pt-0.5">নাজেমে তা'লীমাত (শিক্ষা সচিব)</div>
        </div>
        <div className="text-center w-36">
          <div className="border-t border-slate-500 pt-0.5 font-bold text-slate-900">মুহতামিম / প্রিন্সিপাল</div>
        </div>
      </div>
    </div>
  );
}
