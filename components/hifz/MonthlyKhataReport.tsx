"use client";

import React from "react";
import type { HifzProfile, WeeklySabina } from "@/lib/hifz-utils";
import {
  findWeeklySabinaForWeek,
  formatSabinaParaRangeBn,
  getKhataMonthDays,
  getMonthLabelBn,
  mapLogToKhataRow,
  WEEK_ORDINALS_BN,
} from "@/lib/hifz-khata";
import { toBanglaNumber } from "@/lib/numberToBangla";

export interface MonthlyKhataReportProps {
  student?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    roll_number?: string | number | null;
  } | null;
  classNameLabel?: string;
  profile?: HifzProfile | null;
  logs?: any[];
  weeklySabinas?: WeeklySabina[];
  monthKey: string; // YYYY-MM
  hijriMonthLabel?: string;
  blankTemplate?: boolean;
  className?: string;
}

export default function MonthlyKhataReport({
  student,
  classNameLabel = "",
  profile,
  logs = [],
  weeklySabinas = [],
  monthKey,
  hijriMonthLabel = "",
  blankTemplate = false,
  className = "",
}: MonthlyKhataReportProps) {
  const days = getKhataMonthDays(monthKey);
  const { monthName, yearBn } = getMonthLabelBn(monthKey);

  const studentName = blankTemplate
    ? ""
    : `${student?.first_name || ""} ${student?.last_name || ""}`.trim();

  const studentLogs =
    blankTemplate || !student
      ? []
      : logs.filter((l) => l.student_id === student.id);

  const logByDate = new Map<string, any>();
  for (const l of studentLogs) {
    if (l.log_date) logByDate.set(String(l.log_date).slice(0, 10), l);
  }

  const isKhatmi = !blankTemplate && profile?.hifz_category === "khatmi";

  const weeklySummaries = [1, 2, 3, 4, 5].map((wk) => {
    const rec =
      blankTemplate || !student
        ? undefined
        : findWeeklySabinaForWeek(weeklySabinas, student.id, monthKey, wk);
    return {
      wk,
      label: `${WEEK_ORDINALS_BN[wk - 1]} সপ্তাহ`,
      assigned: rec
        ? formatSabinaParaRangeBn(rec.assigned_para_from, rec.assigned_para_to)
        : "",
      recited:
        rec && rec.status === "completed" && rec.para_breakdown?.length
          ? `${toBanglaNumber(rec.total_paras_recited)} পারা (${formatSabinaParaRangeBn(
              rec.para_breakdown[0]?.para,
              rec.para_breakdown[rec.para_breakdown.length - 1]?.para,
            )})`
          : "",
      mistakes:
        rec && rec.status === "completed" ? `${toBanglaNumber(rec.total_mistakes)} টি` : "",
    };
  });

  const cellBase: React.CSSProperties = {
    border: "1px solid #0f172a",
    padding: "1px 2.5px",
    fontSize: "7.5pt",
    lineHeight: 1.15,
    textAlign: "center",
    height: "20.5px",
    verticalAlign: "middle",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  };

  const thBase: React.CSSProperties = {
    border: "1px solid #0f172a",
    padding: "2px",
    fontSize: "7.5pt",
    fontWeight: 700,
    lineHeight: 1.15,
    textAlign: "center",
    verticalAlign: "middle",
    backgroundColor: "#f8fafc",
    color: "#0f172a",
  };

  return (
    <div
      className={`khata-monthly-sheet bg-white text-slate-950 ${className}`}
      style={{
        width: "210mm",
        height: "297mm",
        padding: "9mm",
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        pageBreakAfter: "always",
        breakAfter: "page",
        fontFamily: "'Noto Sans Bengali', 'Hind Siliguri', sans-serif",
        backgroundColor: "#ffffff",
        color: "#0f172a",
      }}
    >
      {/* Double Khata Border Frame */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          border: "1.5px solid #0f172a",
          outline: "1.5px solid #0f172a",
          outlineOffset: "2px",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            border: "0.5px solid #334155",
            margin: "1.5px",
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          {/* TOP METADATA HEADER */}
          <div
            style={{
              height: "28px",
              display: "flex",
              alignItems: "stretch",
              borderBottom: "1px solid #0f172a",
            }}
          >
            <div
              style={{
                width: "38%",
                padding: "2px 6px",
                fontSize: "8.5pt",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              <strong>নাম :</strong>
              <span>{studentName || "........................................"}</span>
            </div>

            <div
              style={{
                width: "28%",
                borderLeft: "1px solid #0f172a",
                borderRight: "1px solid #0f172a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12pt",
                fontWeight: 800,
              }}
            >
              মাসিক হিফজ খাতা
            </div>

            <div
              style={{
                width: "34%",
                padding: "1px 5px",
                fontSize: "7.5pt",
                lineHeight: 1.2,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <div>
                <strong>মাস:</strong> {blankTemplate ? "............" : `${monthName} ${yearBn}`}{" "}
                {hijriMonthLabel ? `(${hijriMonthLabel})` : ""}
              </div>
              <div>
                <strong>রোল:</strong>{" "}
                {blankTemplate || !student?.roll_number
                  ? "......"
                  : toBanglaNumber(student.roll_number)}{" "}
                · <strong>জামাত:</strong> {classNameLabel || "............"} ·{" "}
                <strong>স্তর:</strong> {blankTemplate ? "......" : isKhatmi ? "খতমী" : "সবকী"}
              </div>
            </div>
          </div>

          {/* 30/31 UNIFORM DAILY ROWS TABLE */}
          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              <col style={{ width: "12%" }} />
              <col style={{ width: "6.5%" }} />
              <col style={{ width: "6.5%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "7%" }} />
            </colgroup>
            <thead>
              <tr style={{ height: "15px" }}>
                <th rowSpan={2} style={{ ...thBase, borderTop: "none", borderLeft: "none" }}>
                  বার
                </th>
                <th colSpan={2} style={{ ...thBase, borderTop: "none" }}>
                  {isKhatmi ? "ধরন" : "সবক"}
                </th>
                <th colSpan={4} style={{ ...thBase, borderTop: "none" }}>
                  {isKhatmi ? "সকালের দাওর" : "সাত সবক"}
                </th>
                <th colSpan={4} style={{ ...thBase, borderTop: "none" }}>
                  {isKhatmi ? "বিকেলের দাওর" : "আমুখতা"}
                </th>
                <th rowSpan={2} style={{ ...thBase, borderTop: "none" }}>
                  দৈনিক তিলাওয়াত
                </th>
                <th rowSpan={2} style={{ ...thBase, borderTop: "none" }}>
                  শিক্ষকের স্বাক্ষর
                </th>
                <th rowSpan={2} style={{ ...thBase, borderTop: "none", borderRight: "none" }}>
                  তারিখ
                </th>
              </tr>
              <tr style={{ height: "15px" }}>
                <th style={thBase}>পারা</th>
                <th style={thBase}>পৃষ্ঠা</th>
                <th style={thBase}>পারা</th>
                <th style={thBase}>পৃষ্ঠা</th>
                <th style={thBase}>পরিমাণ</th>
                <th style={thBase}>ভুল</th>
                <th style={thBase}>পারা</th>
                <th style={thBase}>পৃষ্ঠা</th>
                <th style={thBase}>পরিমাণ</th>
                <th style={thBase}>ভুল</th>
              </tr>
            </thead>
            <tbody>
              {days.map((slot) => {
                const rowData = blankTemplate
                  ? mapLogToKhataRow(null)
                  : mapLogToKhataRow(logByDate.get(slot.date));
                return (
                  <tr key={slot.date} style={{ height: "20.5px" }}>
                    <td style={{ ...cellBase, fontWeight: 700, borderLeft: "none" }}>
                      {slot.dayBn}
                    </td>
                    <td style={cellBase}>{rowData.sabakPara}</td>
                    <td style={cellBase}>{rowData.sabakPage}</td>
                    <td style={cellBase}>{rowData.satPara}</td>
                    <td style={cellBase}>{rowData.satPage}</td>
                    <td style={cellBase}>{rowData.satAmount}</td>
                    <td style={cellBase}>{rowData.satMistakes}</td>
                    <td style={cellBase}>{rowData.amukhtaPara}</td>
                    <td style={cellBase}>{rowData.amukhtaPage}</td>
                    <td style={cellBase}>{rowData.amukhtaAmount}</td>
                    <td style={cellBase}>{rowData.amukhtaMistakes}</td>
                    <td style={cellBase}></td>
                    <td style={{ ...cellBase, fontSize: "7pt", color: "#64748b" }}>
                      {rowData.hasLog ? "✓" : ""}
                    </td>
                    <td style={{ ...cellBase, borderRight: "none" }}>
                      {blankTemplate ? "" : slot.ddmmBn}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* BOTTOM 4/5-WEEK SABINA SUMMARY GRID */}
          <div style={{ marginTop: "auto", borderTop: "1.5px solid #0f172a" }}>
            <div
              style={{
                backgroundColor: "#f1f5f9",
                fontSize: "8pt",
                fontWeight: 800,
                textAlign: "center",
                padding: "2px 4px",
                borderBottom: "1px solid #0f172a",
              }}
            >
              মাসিক সাপ্তাহিক সবিনা সারসংক্ষেপ (১ম – ৫ম সপ্তাহ)
            </div>
            <table
              style={{
                borderCollapse: "collapse",
                width: "100%",
                tableLayout: "fixed",
              }}
            >
              <thead>
                <tr style={{ height: "18px" }}>
                  <th style={{ ...thBase, width: "16%", borderLeft: "none" }}>সপ্তাহ</th>
                  <th style={{ ...thBase, width: "30%" }}>বণ্টনকৃত পারাসমূহ</th>
                  <th style={{ ...thBase, width: "36%" }}>তিলাওয়াতকৃত পারাসমূহ</th>
                  <th style={{ ...thBase, width: "18%", borderRight: "none" }}>মোট লোকমা / ভুল</th>
                </tr>
              </thead>
              <tbody>
                {weeklySummaries.map((w) => (
                  <tr key={w.wk} style={{ height: "19px" }}>
                    <td style={{ ...cellBase, height: "19px", fontWeight: 700, borderLeft: "none" }}>
                      {w.label}
                    </td>
                    <td style={{ ...cellBase, height: "19px" }}>{w.assigned}</td>
                    <td style={{ ...cellBase, height: "19px" }}>{w.recited}</td>
                    <td style={{ ...cellBase, height: "19px", borderRight: "none" }}>
                      {w.mistakes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 3 Signature Lines */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "12px",
                padding: "22px 14px 8px 14px",
                fontSize: "8pt",
                fontWeight: 700,
                textAlign: "center",
              }}
            >
              <div style={{ borderTop: "1px solid #0f172a", paddingTop: "3px" }}>
                শ্রেণি উস্তাদের স্বাক্ষর
              </div>
              <div style={{ borderTop: "1px solid #0f172a", paddingTop: "3px" }}>
                অভিভাবকের স্বাক্ষর
              </div>
              <div style={{ borderTop: "1px solid #0f172a", paddingTop: "3px" }}>
                হিফজ বিভাগীয় প্রধানের স্বাক্ষর
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
