"use client";

import React from "react";
import type { HifzProfile, WeeklySabina } from "@/lib/hifz-utils";
import {
  findWeeklySabinaForWeek,
  formatSabinaBreakdownBn,
  formatSabinaParaRangeBn,
  getActiveParaGroupTier,
  getKhataWeekDays,
  getMonthLabelBn,
  GROUP1_TIERS,
  GROUP2_TIERS,
  mapLogToKhataRow,
  WEEK_ORDINALS_BN,
} from "@/lib/hifz-khata";
import { toBanglaNumber } from "@/lib/numberToBangla";

export interface KhataInstitutionInfo {
  name?: string | null;
  address?: string | null;
  logoUrl?: string | null;
}

export interface WeeklyKhataReportProps {
  student?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    roll_number?: string | number | null;
  } | null;
  profile?: HifzProfile | null;
  logs?: any[];
  weeklySabinas?: WeeklySabina[];
  monthKey: string; // YYYY-MM
  weekNumber: number; // 1..5
  hijriMonthLabel?: string;
  institution?: KhataInstitutionInfo | null;
  blankTemplate?: boolean;
  className?: string;
}

export default function WeeklyKhataReport({
  student,
  profile,
  logs = [],
  weeklySabinas = [],
  monthKey,
  weekNumber,
  hijriMonthLabel,
  institution,
  blankTemplate = false,
  className = "",
}: WeeklyKhataReportProps) {
  const [logoFailed, setLogoFailed] = React.useState(false);
  const { days } = getKhataWeekDays(monthKey, weekNumber);
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

  const weeklySabina =
    blankTemplate || !student
      ? undefined
      : findWeeklySabinaForWeek(weeklySabinas, student.id, monthKey, weekNumber);

  const activeTier =
    blankTemplate || !student
      ? null
      : getActiveParaGroupTier(profile, studentLogs);

  const effectiveHijri = hijriMonthLabel || weeklySabina?.hijri_month_label || "";

  const assignedRangeText = weeklySabina
    ? formatSabinaParaRangeBn(weeklySabina.assigned_para_from, weeklySabina.assigned_para_to)
    : "";

  const recitedRangeText =
    weeklySabina && weeklySabina.status === "completed" && weeklySabina.para_breakdown?.length
      ? formatSabinaParaRangeBn(
          weeklySabina.para_breakdown[0]?.para,
          weeklySabina.para_breakdown[weeklySabina.para_breakdown.length - 1]?.para,
        )
      : "";

  const totalParasRecitedText =
    weeklySabina && weeklySabina.status === "completed"
      ? `${toBanglaNumber(weeklySabina.total_paras_recited)} পারা`
      : "";

  const paraBreakdownText =
    weeklySabina && weeklySabina.status === "completed"
      ? formatSabinaBreakdownBn(weeklySabina)
      : "";

  const totalMistakesText =
    weeklySabina && weeklySabina.status === "completed"
      ? `${toBanglaNumber(weeklySabina.total_mistakes)} টি`
      : "";

  const isKhatmi = !blankTemplate && profile?.hifz_category === "khatmi";

  const cellBase: React.CSSProperties = {
    border: "1px solid #0f172a",
    padding: "4px 4px",
    fontSize: "10pt",
    fontWeight: 500,
    lineHeight: 1.3,
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
    lineHeight: 1.25,
    textAlign: "center",
    verticalAlign: "middle",
    backgroundColor: "#f8fafc",
    color: "#0f172a",
  };

  return (
    <div
      className={`khata-weekly-sheet bg-white text-slate-950 ${className}`}
      style={{
        width: "210mm",
        height: "148mm",
        padding: "6mm",
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
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
              gap: "8px",
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
                  width: "30px",
                  height: "30px",
                  objectFit: "contain",
                  flexShrink: 0,
                  borderRadius: "4px",
                }}
              />
            )}
            <div style={{ textAlign: "center", minWidth: 0, overflow: "hidden" }}>
              <div
                style={{
                  fontSize: "13pt",
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
                  fontSize: "8.5pt",
                  lineHeight: 1.2,
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

          {/* TOP METADATA HEADER GRID */}
          {/* Row 1 */}
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "stretch",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            {/* Left 42%: Name */}
            <div
              style={{
                width: "42%",
                padding: "3px 6px",
                fontSize: "9.5pt",
                lineHeight: 1.3,
                display: "flex",
                alignItems: "center",
                gap: "4px",
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontWeight: 700 }}>নাম :</span>
              <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
                {studentName || "............................................"}
              </span>
            </div>

            {/* Center 22%: Bold Title "সাপ্তাহিক" */}
            <div
              style={{
                width: "22%",
                fontSize: "15pt",
                fontWeight: 800,
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderLeft: "1px solid #0f172a",
                borderRight: "1px solid #0f172a",
                padding: "2px 4px",
                lineHeight: 1.15,
                letterSpacing: "0.02em",
              }}
            >
              সাপ্তাহিক
            </div>

            {/* Right 36%: Split box for মাস (আরবি / ইংরেজি) and সন */}
            <div
              style={{
                width: "36%",
                display: "flex",
                alignItems: "stretch",
                fontSize: "8.5pt",
                lineHeight: 1.25,
              }}
            >
              <div
                style={{
                  flex: 1,
                  padding: "2px 6px",
                  borderRight: "1px solid #0f172a",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <strong>মাস (আরবি):</strong> {effectiveHijri || ".............."}
                </div>
                <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <strong>ইংরেজি:</strong> {blankTemplate ? ".............." : monthName}
                </div>
              </div>
              <div
                style={{
                  width: "33%",
                  padding: "2px 5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "9pt",
                  whiteSpace: "nowrap",
                }}
              >
                সন: {blankTemplate ? "......." : yearBn}
              </div>
            </div>
          </div>

          {/* Row 2: Group & Week Selector Bar */}
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              fontSize: "8.5pt",
              lineHeight: 1.3,
              padding: "3px 6px",
              borderTop: "1px solid #0f172a",
              borderBottom: "1px solid #0f172a",
              boxSizing: "border-box",
            }}
          >
            {/* Left 34%: 1st Group */}
            <div style={{ width: "34%", display: "flex", alignItems: "center", gap: "3px", whiteSpace: "nowrap" }}>
              <strong>১ম গ্রুপ :</strong>
              {GROUP1_TIERS.map((tier, idx) => {
                const active = activeTier === tier;
                return (
                  <React.Fragment key={tier}>
                    {idx > 0 && <span style={{ opacity: 0.45 }}>|</span>}
                    <span
                      style={
                        active
                          ? {
                              border: "1px solid #0f172a",
                              borderRadius: "999px",
                              padding: "0 5px",
                              fontWeight: 800,
                              backgroundColor: "#e2e8f0",
                            }
                          : undefined
                      }
                    >
                      {toBanglaNumber(tier)} পারা
                    </span>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Center 32%: Week Selector */}
            <div
              style={{
                width: "32%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "3px",
                whiteSpace: "nowrap",
              }}
            >
              <strong>সপ্তাহ :</strong>
              {WEEK_ORDINALS_BN.map((ord, idx) => {
                const active = !blankTemplate && weekNumber === idx + 1;
                return (
                  <React.Fragment key={ord}>
                    {idx > 0 && <span style={{ opacity: 0.45 }}>|</span>}
                    <span
                      style={
                        active
                          ? {
                              border: "1px solid #0f172a",
                              borderRadius: "999px",
                              padding: "0 5px",
                              fontWeight: 800,
                              backgroundColor: "#e2e8f0",
                            }
                          : undefined
                      }
                    >
                      {ord}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Right 34%: 2nd Group */}
            <div
              style={{
                width: "34%",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "3px",
                whiteSpace: "nowrap",
              }}
            >
              <strong>২য় গ্রুপ :</strong>
              {GROUP2_TIERS.map((tier, idx) => {
                const active = activeTier === tier;
                return (
                  <React.Fragment key={tier}>
                    {idx > 0 && <span style={{ opacity: 0.45 }}>|</span>}
                    <span
                      style={
                        active
                          ? {
                              border: "1px solid #0f172a",
                              borderRadius: "999px",
                              padding: "0 5px",
                              fontWeight: 800,
                              backgroundColor: "#e2e8f0",
                            }
                          : undefined
                      }
                    >
                      {toBanglaNumber(tier)} পারা
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* MAIN 7-DAY WEEKLY KHATA TABLE (fills 100% of remaining vertical space — zero white gap) */}
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
                <col style={{ width: "10%" }} />
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
                <col style={{ width: "9%" }} />
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
                {days.map((slot, rowIdx) => {
                  const rowData = blankTemplate
                    ? mapLogToKhataRow(null)
                    : mapLogToKhataRow(logByDate.get(slot.date));
                  const isLast = rowIdx === days.length - 1;
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
                      {/* Open blank printable cell for daily tilawat pen entry */}
                      <td style={rowCell}></td>
                      {/* Open cell for Ustad's signature */}
                      <td style={{ ...rowCell, fontSize: "9pt", color: "#475569" }}>
                        {rowData.hasLog ? "✓" : ""}
                      </td>
                      <td style={{ ...rowCell, borderRight: "none", fontSize: "9.5pt" }}>
                        {blankTemplate ? "" : slot.ddmmBn}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* BOTTOM WEEKLY SABINA SUMMARY FOOTER BOX */}
          <div style={{ flexShrink: 0, borderTop: "1px solid #0f172a" }}>
            {/* Upper Split Strip (height: 28px) */}
            <div
              style={{
                height: "28px",
                padding: "4px 8px",
                fontSize: "9pt",
                lineHeight: 1.3,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                borderBottom: "1px solid #0f172a",
                boxSizing: "border-box",
              }}
            >
              <div style={{ flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                <strong>বণ্টনকৃত সাপ্তাহিক সবিনার পারাসমূহ :</strong>{" "}
                <span>{assignedRangeText || ".............................."}</span>
              </div>
              <div
                style={{
                  flex: 1,
                  textAlign: "right",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
              >
                <strong>তিলাওয়াতকৃত সাপ্তাহিক সবিনার পারাসমূহ :</strong>{" "}
                <span>{recitedRangeText || ".............................."}</span>
              </div>
            </div>

            {/* Lower 3-Part Summary Strip (height: 28px) */}
            <div
              style={{
                height: "28px",
                fontSize: "9pt",
                lineHeight: 1.3,
                display: "grid",
                gridTemplateColumns: "22% 52% 26%",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  padding: "4px 8px",
                  borderRight: "1px solid #0f172a",
                  display: "flex",
                  alignItems: "center",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                }}
              >
                <strong>মোট :</strong>&nbsp;{totalParasRecitedText || "............"}
              </div>
              <div
                style={{
                  padding: "4px 8px",
                  borderRight: "1px solid #0f172a",
                  display: "flex",
                  alignItems: "center",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
              >
                <strong>কোন কোন পারা :</strong>&nbsp;
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {paraBreakdownText || ".............................................."}
                </span>
              </div>
              <div
                style={{
                  padding: "4px 8px",
                  display: "flex",
                  alignItems: "center",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                }}
              >
                <strong>মোট লোকমার সংখ্যা :</strong>&nbsp;{totalMistakesText || "........."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
