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
import type { KhataInstitutionInfo } from "./WeeklyKhataReport";

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
  institution?: KhataInstitutionInfo | null;
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
  institution,
  blankTemplate = false,
  className = "",
}: MonthlyKhataReportProps) {
  const [logoFailed, setLogoFailed] = React.useState(false);
  const days = getKhataMonthDays(monthKey);
  const { monthName, yearBn } = getMonthLabelBn(monthKey);

  const madrasaName = institution?.name?.trim() || "";
  const madrasaAddress = institution?.address?.trim() || "";
  const showLogo = Boolean(institution?.logoUrl && !logoFailed);

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
    padding: "2px 3px",
    fontSize: "8.5pt",
    fontWeight: 500,
    lineHeight: 1.2,
    textAlign: "center",
    verticalAlign: "middle",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  };

  const thBase: React.CSSProperties = {
    border: "1px solid #0f172a",
    padding: "4px 3px",
    fontSize: "8.5pt",
    fontWeight: 700,
    lineHeight: 1.2,
    textAlign: "center",
    verticalAlign: "middle",
    backgroundColor: "#f8fafc",
    color: "#0f172a",
  };

  const sabinaCell: React.CSSProperties = {
    border: "1px solid #0f172a",
    padding: "3.5px 6px",
    fontSize: "8.5pt",
    lineHeight: 1.25,
    textAlign: "center",
    verticalAlign: "middle",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  };

  return (
    <div
      className={`khata-monthly-sheet bg-white text-slate-950 ${className}`}
      style={{
        width: "210mm",
        height: "297mm",
        padding: "8mm",
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
          minHeight: 0,
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
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            border: "0.5px solid #334155",
            margin: "1.5px",
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          {/* DYNAMIC MADRASAH LETTERHEAD HEADER */}
          <div
            style={{
              flexShrink: 0,
              padding: "4px 10px",
              borderBottom: "1px solid #0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              boxSizing: "border-box",
              backgroundColor: "#ffffff",
            }}
          >
            {showLogo && (
              <img
                src={institution!.logoUrl!}
                alt={madrasaName || "মাদরাসা লোগো"}
                onError={() => setLogoFailed(true)}
                style={{
                  width: "36px",
                  height: "36px",
                  objectFit: "contain",
                  flexShrink: 0,
                  borderRadius: "4px",
                }}
              />
            )}
            <div style={{ textAlign: "center", minWidth: 0, overflow: "hidden" }}>
              <div
                style={{
                  fontSize: "15pt",
                  fontWeight: 800,
                  lineHeight: 1.25,
                  color: "#0f172a",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {madrasaName || "হিফজুল কুরআন বিভাগ"}
              </div>
              <div
                style={{
                  fontSize: "9.5pt",
                  lineHeight: 1.25,
                  color: "#334155",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {madrasaAddress
                  ? `${madrasaAddress} · বিভাগ: হিফজুল কুরআন`
                  : "বিভাগ: হিফজুল কুরআন"}
              </div>
            </div>
          </div>

          {/* TOP METADATA HEADER */}
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "stretch",
              borderBottom: "1px solid #0f172a",
            }}
          >
            <div
              style={{
                width: "37%",
                padding: "4px 8px",
                fontSize: "10pt",
                lineHeight: 1.35,
                display: "flex",
                alignItems: "center",
                gap: "4px",
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              <strong>নাম :</strong>
              <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
                {studentName || "......................................"}
              </span>
            </div>

            <div
              style={{
                width: "27%",
                borderLeft: "1px solid #0f172a",
                borderRight: "1px solid #0f172a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "13pt",
                fontWeight: 800,
                padding: "4px 6px",
              }}
            >
              মাসিক হিফজ খাতা
            </div>

            <div
              style={{
                width: "36%",
                padding: "3px 8px",
                fontSize: "8.5pt",
                lineHeight: 1.3,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                <strong>মাস:</strong> {blankTemplate ? "............" : `${monthName} ${yearBn}`}{" "}
                {hijriMonthLabel ? `(${hijriMonthLabel})` : ""}
              </div>
              <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                <strong>রোল:</strong>{" "}
                {blankTemplate || !student?.roll_number
                  ? "......"
                  : toBanglaNumber(student.roll_number)}{" "}
                · <strong>জামাত:</strong> {classNameLabel || ".........."} ·{" "}
                <strong>স্তর:</strong> {blankTemplate ? "....." : isKhatmi ? "খতমী" : "সবকী"}
              </div>
            </div>
          </div>

          {/* 30/31 UNIFORM DAILY ROWS TABLE (flex-filled — zero empty gap above footer) */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <table
              style={{
                borderCollapse: "collapse",
                width: "100%",
                height: "100%",
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
                <tr>
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
                <tr>
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
                {days.map((slot, idx) => {
                  const rowData = blankTemplate
                    ? mapLogToKhataRow(null)
                    : mapLogToKhataRow(logByDate.get(slot.date));
                  const isLast = idx === days.length - 1;
                  const rowCell: React.CSSProperties = isLast
                    ? { ...cellBase, borderBottom: "none" }
                    : cellBase;
                  return (
                    <tr key={slot.date}>
                      <td style={{ ...rowCell, fontWeight: 700, borderLeft: "none" }}>
                        {slot.dayBn}
                      </td>
                      <td style={rowCell}>{rowData.sabakPara}</td>
                      <td style={rowCell}>{rowData.sabakPage}</td>
                      <td style={rowCell}>{rowData.satPara}</td>
                      <td style={rowCell}>{rowData.satPage}</td>
                      <td style={rowCell}>{rowData.satAmount}</td>
                      <td style={rowCell}>{rowData.satMistakes}</td>
                      <td style={rowCell}>{rowData.amukhtaPara}</td>
                      <td style={rowCell}>{rowData.amukhtaPage}</td>
                      <td style={rowCell}>{rowData.amukhtaAmount}</td>
                      <td style={rowCell}>{rowData.amukhtaMistakes}</td>
                      <td style={rowCell}></td>
                      <td style={{ ...rowCell, fontSize: "8pt", color: "#475569" }}>
                        {rowData.hasLog ? "✓" : ""}
                      </td>
                      <td style={{ ...rowCell, borderRight: "none" }}>
                        {blankTemplate ? "" : slot.ddmmBn}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* BOTTOM 5-WEEK SABINA SUMMARY GRID & SIGNATURE ZONE */}
          <div style={{ flexShrink: 0, borderTop: "1.5px solid #0f172a" }}>
            <div
              style={{
                backgroundColor: "#f1f5f9",
                fontSize: "9pt",
                fontWeight: 800,
                textAlign: "center",
                padding: "3px 6px",
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
                <tr>
                  <th style={{ ...thBase, padding: "3px 4px", width: "16%", borderLeft: "none" }}>সপ্তাহ</th>
                  <th style={{ ...thBase, padding: "3px 4px", width: "30%" }}>বণ্টনকৃত পারাসমূহ</th>
                  <th style={{ ...thBase, padding: "3px 4px", width: "36%" }}>তিলাওয়াতকৃত পারাসমূহ</th>
                  <th style={{ ...thBase, padding: "3px 4px", width: "18%", borderRight: "none" }}>মোট লোকমা / ভুল</th>
                </tr>
              </thead>
              <tbody>
                {weeklySummaries.map((w) => (
                  <tr key={w.wk}>
                    <td style={{ ...sabinaCell, fontWeight: 700, borderLeft: "none" }}>
                      {w.label}
                    </td>
                    <td style={sabinaCell}>{w.assigned}</td>
                    <td style={sabinaCell}>{w.recited}</td>
                    <td style={{ ...sabinaCell, borderRight: "none" }}>
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
                gap: "16px",
                padding: "20px 16px 8px 16px",
                fontSize: "9.5pt",
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
