"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Printer, X, FileSpreadsheet, Layers, FileText } from "lucide-react";
import type { HifzBundle } from "@/lib/hifz-utils";
import { inferWeekNumberFromDate, WEEK_ORDINALS_BN } from "@/lib/hifz-khata";
import { toDhakaDateString } from "@/lib/date-utils";
import { toBanglaNumber } from "@/lib/numberToBangla";
import WeeklyKhataReport, { type KhataInstitutionInfo } from "./WeeklyKhataReport";
import MonthlyKhataReport from "./MonthlyKhataReport";

const INSTITUTION_CACHE_KEY = "qawmi_khata_institution_v1";

export type KhataPrintMode = "weekly_a5" | "weekly_2up_a4" | "monthly_a4";
export type KhataPrintScope = "single" | "batch" | "blank";

interface HifzReportPrintModalProps {
  open: boolean;
  onClose: () => void;
  students: any[];
  bundle: HifzBundle;
  classes?: any[];
  defaultStudentId?: string;
  initialMode?: KhataPrintMode;
  institution?: KhataInstitutionInfo | null;
}

export default function HifzReportPrintModal({
  open,
  onClose,
  students,
  bundle,
  classes = [],
  defaultStudentId,
  initialMode = "weekly_a5",
  institution: initialInstitution,
}: HifzReportPrintModalProps) {
  const today = toDhakaDateString();
  const [mode, setMode] = useState<KhataPrintMode>(initialMode);
  const [scope, setScope] = useState<KhataPrintScope>(
    defaultStudentId ? "single" : students.length === 1 ? "single" : "batch",
  );
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    defaultStudentId || students[0]?.id || "",
  );
  const [monthKey, setMonthKey] = useState<string>(today.slice(0, 7));
  const [weekNumber, setWeekNumber] = useState<number>(inferWeekNumberFromDate(today));
  const [hijriMonthLabel, setHijriMonthLabel] = useState<string>("");
  const [institution, setInstitution] = useState<KhataInstitutionInfo | null>(() => {
    if (initialInstitution) return initialInstitution;
    if (typeof window !== "undefined") {
      try {
        const cached = window.localStorage.getItem(INSTITUTION_CACHE_KEY);
        if (cached) return JSON.parse(cached) as KhataInstitutionInfo;
      } catch {
        // ignore storage errors
      }
    }
    return null;
  });

  useEffect(() => {
    if (!open || initialInstitution) return;
    let active = true;
    fetch("/api/institution-profile", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (!active || !res?.madrasa) return;
        const info: KhataInstitutionInfo = {
          name: res.madrasa.name || "",
          address: res.madrasa.address || "",
          logoUrl: res.logoUrl || null,
        };
        setInstitution(info);
        try {
          window.localStorage.setItem(INSTITUTION_CACHE_KEY, JSON.stringify(info));
        } catch {
          // ignore storage quota errors
        }
      })
      .catch(() => {
        // Offline or unavailable: keep cached institution info
      });
    return () => {
      active = false;
    };
  }, [open, initialInstitution]);

  const profileMap = useMemo(
    () => new Map((bundle.hifz_profiles || []).map((p) => [p.student_id, p])),
    [bundle.hifz_profiles],
  );

  const classMap = useMemo(
    () => new Map((classes || []).map((c: any) => [c.id, c.name])),
    [classes],
  );

  const targetStudents = useMemo(() => {
    if (scope === "blank") return [null];
    if (scope === "single") {
      const found = students.find((s) => s.id === selectedStudentId) || students[0];
      return found ? [found] : [];
    }
    return students;
  }, [scope, students, selectedStudentId]);

  // Pair students into groups of 2 for 2-Up on A4 Portrait (210mm x 297mm)
  const pairedStudents = useMemo(() => {
    if (scope === "blank") return [[null, null]];
    const pairs: Array<[any | null, any | null]> = [];
    for (let i = 0; i < targetStudents.length; i += 2) {
      pairs.push([targetStudents[i] || null, targetStudents[i + 1] || null]);
    }
    return pairs;
  }, [targetStudents, scope]);

  if (!open) return null;

  const pageCss =
    mode === "weekly_a5"
      ? `@media print {
          @page { size: 210mm 148mm; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          #khata-print-root, #khata-print-root * {
            visibility: visible !important;
            font-family: 'SolaimanLipi', 'Hind Siliguri', sans-serif !important;
          }
          #khata-print-root {
            position: fixed !important;
            inset: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            overflow: visible !important;
          }
          .khata-weekly-sheet {
            page-break-after: always !important;
            break-after: page !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
        }`
      : `@media print {
          @page { size: 210mm 297mm; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          #khata-print-root, #khata-print-root * {
            visibility: visible !important;
            font-family: 'SolaimanLipi', 'Hind Siliguri', sans-serif !important;
          }
          #khata-print-root {
            position: fixed !important;
            inset: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            overflow: visible !important;
          }
          .khata-2up-page, .khata-monthly-sheet {
            page-break-after: always !important;
            break-after: page !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
        }`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex flex-col overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: pageCss }} />

      {/* Top Controls Bar (hidden in print) */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex flex-col gap-3 print:hidden shrink-0 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              কওমী খাতা স্টাইল হিফজ রিপোর্ট প্রিন্ট (A5 / A4 PDF)
            </h2>
            <p className="text-xs text-slate-500">
              সাপ্তাহিক A5 ল্যান্ডস্কেপ (২১০×১৪৮ মিমি), ২-আপ A4 এবং মাসিক পূর্ণ A4 খাতা প্রিন্ট ও PDF জেনারেটর
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              প্রিন্ট / PDF সেভ করুন
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
              aria-label="বন্ধ করুন"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mode, Scope & Period Controls */}
        <div className="flex flex-wrap items-end gap-3 text-xs">
          {/* Format Mode */}
          <div>
            <div className="font-bold text-slate-600 mb-1">খাতার ফরম্যাট:</div>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setMode("weekly_a5")}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer ${
                  mode === "weekly_a5"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-700 hover:bg-white"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                সাপ্তাহিক (A5)
              </button>
              <button
                type="button"
                onClick={() => setMode("weekly_2up_a4")}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer ${
                  mode === "weekly_2up_a4"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-700 hover:bg-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                ২-আপ সাপ্তাহিক (A4)
              </button>
              <button
                type="button"
                onClick={() => setMode("monthly_a4")}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer ${
                  mode === "monthly_a4"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-700 hover:bg-white"
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                মাসিক (Full A4)
              </button>
            </div>
          </div>

          {/* Scope */}
          <div>
            <div className="font-bold text-slate-600 mb-1">প্রিন্টের ধরন:</div>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setScope("single")}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  scope === "single"
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-white"
                }`}
              >
                একজন শিক্ষার্থী
              </button>
              {students.length > 1 && (
                <button
                  type="button"
                  onClick={() => setScope("batch")}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    scope === "batch"
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-white"
                  }`}
                >
                  সকল ({toBanglaNumber(students.length)} জন)
                </button>
              )}
              <button
                type="button"
                onClick={() => setScope("blank")}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  scope === "blank"
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-white"
                }`}
              >
                ফাঁকা খাতা টেমপ্লেট
              </button>
            </div>
          </div>

          {/* Single Student Dropdown */}
          {scope === "single" && students.length > 1 && (
            <div>
              <label className="block font-bold text-slate-600 mb-1">শিক্ষার্থী:</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.roll_number ? `${toBanglaNumber(s.roll_number)} · ` : ""}
                    {s.first_name} {s.last_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Month Picker */}
          <div>
            <label className="block font-bold text-slate-600 mb-1">মাস (ইংরেজি):</label>
            <input
              type="month"
              value={monthKey}
              onChange={(e) => e.target.value && setMonthKey(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold"
            />
          </div>

          {/* Week Selector (for Weekly modes) */}
          {mode !== "monthly_a4" && (
            <div>
              <div className="font-bold text-slate-600 mb-1">সপ্তাহ নং:</div>
              <div className="inline-flex gap-1">
                {[1, 2, 3, 4, 5].map((wk) => (
                  <button
                    key={wk}
                    type="button"
                    onClick={() => setWeekNumber(wk)}
                    className={`px-2.5 py-1.5 rounded-lg font-bold border transition cursor-pointer ${
                      weekNumber === wk
                        ? "bg-emerald-600 text-white border-emerald-700"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {WEEK_ORDINALS_BN[wk - 1]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Optional Hijri Month Label */}
          <div>
            <label className="block font-bold text-slate-600 mb-1">আরবি / হিজরি মাস (ঐচ্ছিক):</label>
            <input
              type="text"
              value={hijriMonthLabel}
              onChange={(e) => setHijriMonthLabel(e.target.value)}
              placeholder="যেমন: জুমাদাল উলা ১৪৪৮ হি."
              className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white w-48"
            />
          </div>
        </div>
      </div>

      {/* Scrollable Live Preview & Print Root */}
      <div className="flex-1 overflow-auto bg-slate-200/80 p-4 sm:p-6">
        <div
          id="khata-print-root"
          className="flex flex-col items-center gap-6 print:block print:gap-0"
        >
          {mode === "weekly_a5" &&
            targetStudents.map((stu, idx) => (
              <div key={stu?.id || `blank-a5-${idx}`} className="shadow-lg print:shadow-none">
                <WeeklyKhataReport
                  student={stu}
                  profile={stu ? profileMap.get(stu.id) : null}
                  logs={bundle.hifz_logs}
                  weeklySabinas={bundle.hifz_weekly_sabina}
                  monthKey={monthKey}
                  weekNumber={weekNumber}
                  hijriMonthLabel={hijriMonthLabel}
                  institution={institution}
                  blankTemplate={scope === "blank"}
                />
              </div>
            ))}

          {mode === "weekly_2up_a4" &&
            pairedStudents.map(([topStu, bottomStu], pIdx) => (
              <div
                key={`2up-${pIdx}`}
                className="khata-2up-page bg-white shadow-lg print:shadow-none flex flex-col justify-between"
                style={{
                  width: "210mm",
                  height: "297mm",
                  boxSizing: "border-box",
                  overflow: "hidden",
                }}
              >
                <WeeklyKhataReport
                  student={topStu}
                  profile={topStu ? profileMap.get(topStu.id) : null}
                  logs={bundle.hifz_logs}
                  weeklySabinas={bundle.hifz_weekly_sabina}
                  monthKey={monthKey}
                  weekNumber={weekNumber}
                  hijriMonthLabel={hijriMonthLabel}
                  institution={institution}
                  blankTemplate={scope === "blank"}
                />
                {/* Dashed Cut Line between the two 148mm sheets on A4 (297mm) */}
                <div
                  style={{
                    height: "1mm",
                    borderTop: "1px dashed #64748b",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                />
                {bottomStu || scope === "blank" ? (
                  <WeeklyKhataReport
                    student={bottomStu}
                    profile={bottomStu ? profileMap.get(bottomStu.id) : null}
                    logs={bundle.hifz_logs}
                    weeklySabinas={bundle.hifz_weekly_sabina}
                    monthKey={monthKey}
                    weekNumber={weekNumber}
                    hijriMonthLabel={hijriMonthLabel}
                    institution={institution}
                    blankTemplate={scope === "blank"}
                  />
                ) : (
                  <div style={{ width: "210mm", height: "148mm" }} />
                )}
              </div>
            ))}

          {mode === "monthly_a4" &&
            targetStudents.map((stu, idx) => (
              <div key={stu?.id || `blank-a4-${idx}`} className="shadow-lg print:shadow-none">
                <MonthlyKhataReport
                  student={stu}
                  classNameLabel={stu?.class_id ? classMap.get(stu.class_id) || "" : ""}
                  profile={stu ? profileMap.get(stu.id) : null}
                  logs={bundle.hifz_logs}
                  weeklySabinas={bundle.hifz_weekly_sabina}
                  monthKey={monthKey}
                  hijriMonthLabel={hijriMonthLabel}
                  institution={institution}
                  blankTemplate={scope === "blank"}
                />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
