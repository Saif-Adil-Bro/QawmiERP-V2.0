"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { StudentIDCard, normalizeStudentIdCode, IDCardFieldVisibility } from "@/lib/id-card-management";
import { IdCard, Phone } from "lucide-react";

export type IDCardTemplateType =
  | "classic_islamic"
  | "modern_minimal"
  | "premium_madrasa"
  | "classic"
  | "modern"
  | "minimal";

export interface StudentIdCardTemplateProps {
  card: StudentIDCard;
  side: "front" | "back";
  templateId?: IDCardTemplateType | string;
  themeColor?: string;
  madrasaNameSize?: string;
  customExpiryDate?: string;
  studentPhotoUrl?: string;
  fieldVisibility?: Partial<IDCardFieldVisibility>;
  madrasaInfo?: {
    name?: string;
    name_arabic?: string;
    address?: string;
    phone?: string;
    logo_url?: string;
    website?: string;
    principal_name?: string;
    signature_url?: string;
  };
  customInstructions?: string[];
  signatureTitle?: string;
  qrLabel?: string;
  qrDataUrl?: string;
  scale?: number;
}

type ThemeColorKey = "emerald" | "blue" | "indigo" | "rose" | "slate";

const getThemeClasses = (color?: string) => {
  const c = (color || "emerald") as ThemeColorKey;
  switch (c) {
    case "blue":
      return {
        headerBg: "bg-blue-900",
        headerBorder: "border-amber-400",
        headerText: "text-amber-100",
        headerSub: "text-blue-200/90",
        pillBg: "bg-blue-100/80",
        pillText: "text-blue-900",
        pillBorder: "border-blue-300",
        photoBorder: "border-amber-400",
        qrBorder: "border-blue-800/30",
        qrText: "text-blue-800",
        cardBg: "from-blue-50/40 via-white to-slate-50/30",
        accentLine: "from-blue-600 via-blue-800 to-blue-600",
        accentText: "text-blue-900",
        badgeBg: "bg-blue-50",
        badgeText: "text-blue-800",
        badgeBorder: "border-blue-200",
        bottomStrip: "bg-blue-900",
        darkBg: "bg-blue-950",
        darkHeader: "bg-blue-900",
        gridItemBg: "bg-blue-900/80",
        gridItemBorder: "border-blue-700/60",
        backHeaderBg: "bg-blue-900",
        backHeaderBorder: "border-amber-400",
        backHeaderText: "text-amber-300",
        backContactBg: "bg-blue-50/80",
        backContactBorder: "border-blue-200",
        backContactTitle: "text-blue-900",
        backContactIcon: "text-blue-700",
      };
    case "indigo":
      return {
        headerBg: "bg-indigo-900",
        headerBorder: "border-amber-400",
        headerText: "text-amber-100",
        headerSub: "text-indigo-200/90",
        pillBg: "bg-indigo-100/80",
        pillText: "text-indigo-900",
        pillBorder: "border-indigo-300",
        photoBorder: "border-amber-400",
        qrBorder: "border-indigo-800/30",
        qrText: "text-indigo-800",
        cardBg: "from-indigo-50/40 via-white to-slate-50/30",
        accentLine: "from-indigo-600 via-indigo-800 to-indigo-600",
        accentText: "text-indigo-900",
        badgeBg: "bg-indigo-50",
        badgeText: "text-indigo-800",
        badgeBorder: "border-indigo-200",
        bottomStrip: "bg-indigo-900",
        darkBg: "bg-indigo-950",
        darkHeader: "bg-indigo-900",
        gridItemBg: "bg-indigo-900/80",
        gridItemBorder: "border-indigo-700/60",
        backHeaderBg: "bg-indigo-900",
        backHeaderBorder: "border-amber-400",
        backHeaderText: "text-amber-300",
        backContactBg: "bg-indigo-50/80",
        backContactBorder: "border-indigo-200",
        backContactTitle: "text-indigo-900",
        backContactIcon: "text-indigo-700",
      };
    case "rose":
      return {
        headerBg: "bg-rose-900",
        headerBorder: "border-amber-400",
        headerText: "text-amber-100",
        headerSub: "text-rose-200/90",
        pillBg: "bg-rose-100/80",
        pillText: "text-rose-900",
        pillBorder: "border-rose-300",
        photoBorder: "border-amber-400",
        qrBorder: "border-rose-800/30",
        qrText: "text-rose-800",
        cardBg: "from-rose-50/40 via-white to-slate-50/30",
        accentLine: "from-rose-600 via-rose-800 to-rose-600",
        accentText: "text-rose-900",
        badgeBg: "bg-rose-50",
        badgeText: "text-rose-800",
        badgeBorder: "border-rose-200",
        bottomStrip: "bg-rose-900",
        darkBg: "bg-rose-950",
        darkHeader: "bg-rose-900",
        gridItemBg: "bg-rose-900/80",
        gridItemBorder: "border-rose-700/60",
        backHeaderBg: "bg-rose-900",
        backHeaderBorder: "border-amber-400",
        backHeaderText: "text-amber-300",
        backContactBg: "bg-rose-50/80",
        backContactBorder: "border-rose-200",
        backContactTitle: "text-rose-900",
        backContactIcon: "text-rose-700",
      };
    case "slate":
      return {
        headerBg: "bg-slate-900",
        headerBorder: "border-amber-400",
        headerText: "text-amber-100",
        headerSub: "text-slate-300/90",
        pillBg: "bg-slate-200/80",
        pillText: "text-slate-900",
        pillBorder: "border-slate-400",
        photoBorder: "border-amber-400",
        qrBorder: "border-slate-800/30",
        qrText: "text-slate-800",
        cardBg: "from-slate-100/50 via-white to-slate-50/30",
        accentLine: "from-slate-700 via-slate-900 to-slate-700",
        accentText: "text-slate-900",
        badgeBg: "bg-slate-100",
        badgeText: "text-slate-900",
        badgeBorder: "border-slate-300",
        bottomStrip: "bg-slate-900",
        darkBg: "bg-slate-950",
        darkHeader: "bg-slate-900",
        gridItemBg: "bg-slate-900/80",
        gridItemBorder: "border-slate-700/60",
        backHeaderBg: "bg-slate-900",
        backHeaderBorder: "border-amber-400",
        backHeaderText: "text-amber-300",
        backContactBg: "bg-slate-100",
        backContactBorder: "border-slate-300",
        backContactTitle: "text-slate-900",
        backContactIcon: "text-slate-700",
      };
    case "emerald":
    default:
      return {
        headerBg: "bg-emerald-900",
        headerBorder: "border-amber-400",
        headerText: "text-amber-100",
        headerSub: "text-emerald-200/90",
        pillBg: "bg-emerald-100/80",
        pillText: "text-emerald-900",
        pillBorder: "border-emerald-300",
        photoBorder: "border-amber-400",
        qrBorder: "border-emerald-800/30",
        qrText: "text-emerald-800",
        cardBg: "from-emerald-50/40 via-white to-slate-50/30",
        accentLine: "from-emerald-600 via-emerald-800 to-emerald-600",
        accentText: "text-emerald-900",
        badgeBg: "bg-emerald-50",
        badgeText: "text-emerald-800",
        badgeBorder: "border-emerald-200",
        bottomStrip: "bg-emerald-900",
        darkBg: "bg-emerald-950",
        darkHeader: "bg-emerald-900",
        gridItemBg: "bg-emerald-900/80",
        gridItemBorder: "border-emerald-700/60",
        backHeaderBg: "bg-emerald-900",
        backHeaderBorder: "border-amber-400",
        backHeaderText: "text-amber-300",
        backContactBg: "bg-emerald-50/80",
        backContactBorder: "border-emerald-200",
        backContactTitle: "text-emerald-900",
        backContactIcon: "text-emerald-700",
      };
  }
};

const getMadrasaNameFontSize = (size?: string) => {
  switch (size) {
    case "small":
      return "8px";
    case "large":
      return "11.5px";
    case "xlarge":
      return "13px";
    case "medium":
    default:
      return "9.5px";
  }
};

// Background Islamic Star SVG Watermark
const IslamicStarWatermark = () => (
  <svg
    className="absolute inset-0 w-full h-full opacity-[0.035] pointer-events-none select-none text-emerald-950"
    viewBox="0 0 200 200"
    fill="currentColor"
  >
    <pattern
      id="islamic-star-pattern"
      x="0"
      y="0"
      width="40"
      height="40"
      patternUnits="userSpaceOnUse"
    >
      <path d="M20 0 L25 15 L40 20 L25 25 L20 40 L15 25 L0 20 L15 15 Z" />
      <circle cx="20" cy="20" r="2.5" />
      <path d="M0 0 L10 10 M30 10 L40 0 M40 40 L30 30 M10 30 L0 40" stroke="currentColor" strokeWidth="0.5" />
    </pattern>
    <rect width="200" height="200" fill="url(#islamic-star-pattern)" />
  </svg>
);

export function formatDirectPhotoUrl(url?: string | null): string | undefined {
  if (!url || typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (trimmed.includes("drive.google.com")) {
    const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const dMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const fileId = (fileDMatch && fileDMatch[1]) || (idMatch && idMatch[1]) || (dMatch && dMatch[1]);
    if (fileId) {
      return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }
  }
  return trimmed;
}

export default function StudentIdCardTemplate({
  card,
  side,
  templateId = "classic_islamic",
  themeColor = "emerald",
  madrasaNameSize = "medium",
  customExpiryDate,
  studentPhotoUrl,
  fieldVisibility,
  madrasaInfo,
  customInstructions,
  signatureTitle = "মুহতামিম / অধ্যক্ষ",
  qrLabel = "যাচাই করুন",
  qrDataUrl: externalQrUrl,
  scale = 1,
}: StudentIdCardTemplateProps) {
  const [internalQrUrl, setInternalQrUrl] = useState<string>("");

  useEffect(() => {
    if (!externalQrUrl && card?.verification_id) {
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : "https://qawmierp.app";
      const verifyUrl = `${origin}/verify/${card.verification_id}`;
      QRCode.toDataURL(verifyUrl, {
        width: 240,
        margin: 1,
        color: { dark: "#0f172a", light: "#ffffff" },
      })
        .then((url) => setInternalQrUrl(url))
        .catch((err) => console.error("QR Code Error:", err));
    }
  }, [card?.verification_id, externalQrUrl]);

  const qrCodeUrl = externalQrUrl || internalQrUrl;
  const tc = getThemeClasses(themeColor);
  const nameFontSize = getMadrasaNameFontSize(madrasaNameSize);

  // Map backwards-compatible template IDs
  let resolvedTemplate: "classic_islamic" | "modern_minimal" | "premium_madrasa" =
    "classic_islamic";
  if (templateId === "modern_minimal" || templateId === "minimal") {
    resolvedTemplate = "modern_minimal";
  } else if (templateId === "premium_madrasa" || templateId === "modern") {
    resolvedTemplate = "premium_madrasa";
  } else {
    resolvedTemplate = "classic_islamic";
  }

  const snapshot = card.snapshot || {};
  const studentName = snapshot.student_name || "শিক্ষার্থীর নাম";
  const rawStudentId = snapshot.student_id_code || card.student_number || card.card_number || "480001";
  const cleanId = normalizeStudentIdCode(rawStudentId, 1);
  const studentIdCode = `QM-${cleanId}`;
  const className = snapshot.class_name || "—";
  const rollNumber = snapshot.roll_number || "—";
  const sessionName = snapshot.session_name || "—";
  const fatherName = snapshot.father_name;
  const parentPhone = snapshot.parent_phone;
  const bloodGroup = snapshot.blood_group && snapshot.blood_group !== "—" ? snapshot.blood_group : null;
  const rawPhoto = studentPhotoUrl || snapshot.photo_url || card.photo_url;
  const photoUrl = formatDirectPhotoUrl(rawPhoto);
  const isStatusActive = card.status === "ACTIVE";

  const madrasaName = madrasaInfo?.name || "মাদ্রাসাতুল মুসলিমীন";
  const madrasaAddress = madrasaInfo?.address || "কাটিয়ারচর, কিশোরগঞ্জ";
  const madrasaPhone = madrasaInfo?.phone || "01600989555";
  const madrasaWebsite = madrasaInfo?.website || "www.qawmierp.app";
  const mohtamimName = madrasaInfo?.principal_name?.trim() || "";
  const displayExpiryDate = customExpiryDate || card.expiry_date || "31-08-2027";

  const fv = fieldVisibility || {};
  const isFieldVisible = (key: keyof IDCardFieldVisibility, defaultVal: boolean = true) => {
    return fv[key] !== undefined ? !!fv[key] : defaultVal;
  };

  const getDynamicInfoGrid = () => {
    const items: { label: string; value: string; isHighlight?: boolean; colorClass?: string }[] = [];
    if (isFieldVisible("class", true) && className && className !== "—") {
      items.push({ label: "জামাত / শ্রেণি", value: className });
    }
    if (isFieldVisible("roll", true) && rollNumber && rollNumber !== "—") {
      items.push({ label: "রোল নম্বর", value: rollNumber });
    }
    if (isFieldVisible("session", true) && sessionName && sessionName !== "—") {
      items.push({ label: "শিক্ষাবর্ষ", value: sessionName });
    }
    if (isFieldVisible("blood_group", true) && bloodGroup) {
      items.push({ label: "রক্তের গ্রুপ", value: bloodGroup, colorClass: "text-rose-600 font-bold", isHighlight: true });
    }
    if (isFieldVisible("father_name", false) && fatherName) {
      items.push({ label: "পিতার নাম", value: fatherName });
    }
    if (isFieldVisible("phone", false) && parentPhone) {
      items.push({ label: "অভিভাবকের ফোন", value: parentPhone });
    }
    if (isFieldVisible("dob", false) && snapshot.date_of_birth) {
      items.push({ label: "জন্ম তারিখ", value: snapshot.date_of_birth });
    }
    if (isFieldVisible("address", false) && snapshot.address) {
      items.push({ label: "ঠিকানা", value: snapshot.address });
    }

    if (items.length === 0) {
      items.push({ label: "জামাত", value: className });
      items.push({ label: "রোল", value: rollNumber });
    } else if (items.length === 3 && !bloodGroup && !fatherName) {
      items.push({ label: "স্ট্যাটাস", value: "নিয়মিত", colorClass: "text-emerald-700 font-bold" });
    }

    return items;
  };

  const infoGridItems = getDynamicInfoGrid();

  const cardContent = (
    <div
      className="relative rounded-[12px] overflow-hidden bg-white text-slate-800 shadow-md border border-slate-200 select-none print:shadow-none print:border-slate-300 id-card-print-item shrink-0"
      style={{
        width: "2.125in",
        height: "3.375in",
        transform: scale && scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: "top left",
        boxSizing: "border-box",
      }}
    >
      <IslamicStarWatermark />

      {/* =========================================================================
          TEMPLATE 1: CLASSIC ISLAMIC (Dynamic Theme & Font Control)
         ========================================================================= */}
      {resolvedTemplate === "classic_islamic" && (
        <>
          {side === "front" ? (
            /* FRONT SIDE */
            <div className={`w-full h-full flex flex-col justify-between relative z-10 text-slate-900 bg-linear-to-b ${tc.cardBg}`}>
              {/* Header */}
              <div className={`${tc.headerBg} text-white pt-2 pb-1.5 px-1.5 text-center relative border-b-2 ${tc.headerBorder} shrink-0`}>
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  {madrasaInfo?.logo_url ? (
                    <img
                      src={madrasaInfo.logo_url}
                      alt="Logo"
                      className="w-4 h-4 object-contain rounded-full bg-white/10 p-0.5 border border-amber-300/40"
                    />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-white/20 border border-amber-400/60 flex items-center justify-center text-[7px] font-bold text-amber-300">
                      م
                    </div>
                  )}
                  <h3
                    className="font-bold leading-tight text-amber-100 tracking-tight line-clamp-1"
                    style={{ fontSize: nameFontSize }}
                  >
                    {madrasaName}
                  </h3>
                </div>
                <p className={`text-[7px] ${tc.headerSub} leading-none line-clamp-1`}>{madrasaAddress}</p>
                
                {/* Gold Subheader Banner */}
                <div className="mt-1 mx-auto max-w-[90%] bg-linear-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 text-[7px] font-black py-0.2 px-1.5 rounded-full uppercase tracking-wider shadow-2xs">
                  STUDENT ID CARD • ছাত্র পরিচয়পত্র
                </div>
              </div>

              {/* Photo & Identity Core */}
              <div className="flex-1 flex flex-col items-center px-2 pt-1 pb-0.5">
                {/* Photo frame with Border */}
                <div className="relative mb-0.5">
                  <div className={`w-[50px] h-[50px] rounded-lg border-2 ${tc.photoBorder} bg-slate-100 shadow-2xs overflow-hidden flex items-center justify-center`}>
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={studentName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <IdCard className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  {/* Status Indicator */}
                  <span
                    className={`absolute -bottom-1 left-1/2 transform -translate-x-1/2 px-1.5 py-0.1 rounded-full text-[6px] font-black text-white uppercase tracking-tighter shadow-2xs flex items-center gap-0.5 ${
                      isStatusActive ? "bg-emerald-600 border border-emerald-400" : "bg-rose-600 border border-rose-400"
                    }`}
                  >
                    <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                    {isStatusActive ? "সক্রিয়" : card.status}
                  </span>
                </div>

                {/* Student Name & ID Pill */}
                <h4 className="font-extrabold text-slate-900 text-[10.5px] leading-tight text-center line-clamp-1 mt-0.5">
                  {studentName}
                </h4>

                <div className={`mt-0.5 px-1.5 py-0.1 ${tc.pillBg} ${tc.pillText} rounded border ${tc.pillBorder} font-mono font-bold text-[8px]`}>
                  {studentIdCode}
                </div>

                {/* Structured Info Grid */}
                <div className="w-full mt-1.5 grid grid-cols-2 gap-1 text-[7.5px]">
                  {infoGridItems.map((item, idx) => (
                    <div key={idx} className="bg-white/90 p-0.5 px-1 rounded border border-slate-200/80 text-center">
                      <span className="text-slate-500 block text-[6.5px]">{item.label}</span>
                      <strong className={`block truncate leading-tight ${item.colorClass || "text-slate-800 font-bold"}`}>
                        {item.value}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Authorization & QR Section - 100% MATHEMATICALLY CENTERED SIGNATURE */}
              <div className="relative bg-slate-50/90 px-2 py-1 border-t border-slate-200 flex items-end justify-center min-h-[38px] shrink-0">
                {/* Center: Signature Block */}
                <div className="flex flex-col items-center justify-end text-center pb-0.5 mx-auto">
                  <div className="h-4 flex items-center justify-center mb-0.5 w-full">
                    {madrasaInfo?.signature_url ? (
                      <img src={madrasaInfo.signature_url} alt="Sign" className="h-4 max-w-[54px] object-contain" />
                    ) : (
                      /* Reserved Blank Space for manual pen signature/stamp */
                      <div className="h-3 w-full" />
                    )}
                  </div>
                  <div className="w-16 border-b border-slate-400 mb-0.5" />
                  <span className="font-extrabold text-[7px] text-slate-700 block leading-none">{signatureTitle}</span>
                  {mohtamimName ? (
                    <span className="text-[6px] text-slate-600 block leading-tight font-medium truncate max-w-[95px] mt-0.5">
                      {mohtamimName}
                    </span>
                  ) : null}
                </div>

                {/* Right: QR Code (Pinned absolute right so it NEVER offsets the signature) */}
                {isFieldVisible("qr_code", true) && (
                  <div className="absolute right-1.5 bottom-1 flex flex-col items-center justify-center shrink-0 text-center">
                    {qrCodeUrl ? (
                      <img
                        src={qrCodeUrl}
                        alt="QR"
                        className={`w-7 h-7 border ${tc.qrBorder} p-0.5 rounded bg-white shadow-2xs`}
                      />
                    ) : (
                      <div className="w-7 h-7 bg-slate-200 rounded animate-pulse" />
                    )}
                    <span className={`text-[5px] font-mono font-bold ${tc.qrText} mt-0.5 leading-none text-center block`}>{qrLabel}</span>
                  </div>
                )}
              </div>

              {/* Bottom Strip */}
              <div className={`h-1 ${tc.bottomStrip} w-full shrink-0`} />
            </div>
          ) : (
            /* BACK SIDE */
            <div className="w-full h-full flex flex-col justify-between relative z-10 text-slate-800 bg-white p-2">
              <div>
                {/* Back Header - ALWAYS CENTER ALIGNED */}
                <div className={`${tc.backHeaderBg} ${tc.backHeaderText} py-0.5 px-1.5 rounded-md text-center font-bold text-[8.5px] mb-1.5 shadow-2xs border-b ${tc.backHeaderBorder} w-full block`}>
                  জরুরি নির্দেশনাবলি
                </div>

                {/* Instructions List */}
                <ul className="space-y-0.5 text-[6.5px] text-slate-700 list-disc pl-3 leading-tight">
                  {customInstructions && customInstructions.length > 0 ? (
                    customInstructions.map((item, idx) => <li key={idx}>{item}</li>)
                  ) : (
                    <>
                      <li>মাদরাসায় অবস্থানকালে আইডি কার্ড ঝুলিয়ে রাখা বাধ্যতামূলক।</li>
                      <li>কার্ডটি হারিয়ে গেলে অবিলম্বে অফিসে অবহিত করুন।</li>
                      <li>এটি অফিশিয়াল সম্পদ এবং হস্তান্তরযোগ্য নয়।</li>
                    </>
                  )}
                </ul>

                {/* Emergency Contact Box */}
                <div className={`mt-1.5 p-1.5 ${tc.backContactBg} rounded-lg border ${tc.backContactBorder} space-y-0.5 text-[6.5px] text-center`}>
                  <div className={`flex items-center justify-center gap-1 font-bold ${tc.backContactTitle} border-b border-slate-200/60 pb-0.5 text-center`}>
                    <Phone className={`w-2 h-2 ${tc.backContactIcon}`} />
                    <span>জরুরী যোগাযোগ</span>
                  </div>
                  <p className="font-extrabold text-slate-900 text-[8.5px] truncate leading-tight mt-0.5 text-center">{madrasaName}</p>
                  <p className="text-slate-600 truncate leading-tight text-center">{madrasaAddress}</p>
                  {mohtamimName && (
                    <p className="text-slate-700 truncate leading-tight text-center">
                      <span className="text-slate-500 font-medium">মুহতামিম:</span> {mohtamimName}
                    </p>
                  )}
                  <p className="text-slate-700 truncate leading-tight font-mono font-bold text-center">
                    <span className="text-slate-500 font-sans font-normal">মোবাইল:</span> {madrasaPhone}
                  </p>
                </div>
              </div>

              {/* Footer Section */}
              <div className="border-t border-slate-200 pt-1 space-y-0.5 text-[6.5px] text-center">
                <p className="font-bold text-slate-800 text-[7px] truncate">{madrasaName}</p>
                <p className="text-slate-600 font-bold text-[6.5px]">
                  কার্ডের মেয়াদ: <span className="font-mono">{displayExpiryDate}</span>
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* =========================================================================
          TEMPLATE 2: MODERN MINIMAL
         ========================================================================= */}
      {resolvedTemplate === "modern_minimal" && (
        <>
          {side === "front" ? (
            <div className="w-full h-full flex flex-col justify-between relative z-10 bg-white text-slate-800">
              {/* Top Accent Line */}
              <div className={`h-1.5 bg-linear-to-r ${tc.accentLine} w-full shrink-0`} />

              {/* Header */}
              <div className="pt-1.5 px-1.5 text-center shrink-0">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  {madrasaInfo?.logo_url ? (
                    <img
                      src={madrasaInfo.logo_url}
                      alt="Logo"
                      className="w-4 h-4 object-contain rounded-full bg-slate-100 p-0.5 border border-slate-300"
                    />
                  ) : null}
                  <h3
                    className={`font-extrabold ${tc.accentText} leading-tight line-clamp-1`}
                    style={{ fontSize: nameFontSize }}
                  >
                    {madrasaName}
                  </h3>
                </div>
                <p className="text-[7px] text-slate-500 line-clamp-1 mt-0.5">{madrasaAddress}</p>
                <span className={`inline-block mt-0.5 px-1.5 py-0.1 ${tc.badgeBg} ${tc.badgeText} rounded-full text-[6.5px] font-bold border ${tc.badgeBorder}`}>
                  STUDENT IDENTITY CARD
                </span>
              </div>

              {/* Center Student Photo & Info */}
              <div className="flex-1 flex flex-col items-center px-2 pt-1">
                <div className={`w-[48px] h-[48px] rounded-xl border-2 ${tc.badgeBorder} bg-slate-50 shadow-2xs overflow-hidden flex items-center justify-center mb-0.5`}>
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={studentName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <IdCard className="w-5 h-5 text-slate-400" />
                  )}
                </div>

                <h4 className="font-bold text-slate-900 text-[10px] text-center line-clamp-1">
                  {studentName}
                </h4>

                <span className={`font-mono font-bold text-[7.5px] ${tc.badgeText} ${tc.badgeBg} px-1 py-0.1 rounded border ${tc.badgeBorder} mt-0.5`}>
                  ID: {studentIdCode}
                </span>

                {/* Info List */}
                <div className="w-full mt-1.5 space-y-0.5 text-[7.5px]">
                  {infoGridItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between border-b border-slate-100 pb-0.5">
                      <span className="text-slate-500">{item.label}:</span>
                      <span className={`truncate ${item.colorClass || "font-bold text-slate-800"}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Footer - 100% MATHEMATICALLY CENTERED SIGNATURE */}
              <div className="relative p-1.5 bg-slate-50 border-t border-slate-200 flex items-end justify-center min-h-[38px] shrink-0">
                <div className="flex flex-col items-center justify-end text-center pb-0.5 mx-auto">
                  <div className="h-4 flex items-center justify-center mb-0.5 w-full">
                    {madrasaInfo?.signature_url ? (
                      <img src={madrasaInfo.signature_url} alt="Sign" className="h-4 max-w-[54px] object-contain" />
                    ) : (
                      <div className="h-3 w-full" />
                    )}
                  </div>
                  <div className="w-16 border-b border-slate-400 mb-0.5" />
                  <span className="font-extrabold text-[7px] text-slate-700 block leading-none">{signatureTitle}</span>
                  {mohtamimName ? (
                    <span className="text-[6px] text-slate-600 block leading-tight font-medium truncate max-w-[95px] mt-0.5">
                      {mohtamimName}
                    </span>
                  ) : null}
                </div>
                {isFieldVisible("qr_code", true) && (
                  <div className="absolute right-1.5 bottom-1 flex flex-col items-center justify-center shrink-0 text-center">
                    {qrCodeUrl && (
                      <img src={qrCodeUrl} alt="QR" className={`w-7 h-7 rounded border ${tc.badgeBorder} p-0.5 bg-white shadow-2xs`} />
                    )}
                    <span className="text-[5px] font-mono font-bold text-slate-500 mt-0.5 leading-none text-center block">{qrLabel}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col justify-between relative z-10 bg-white p-2 text-slate-800">
              <div>
                <h4 className={`font-bold text-[9px] ${tc.accentText} border-b pb-0.5 mb-1.5 text-center w-full block`}>
                  জরুরি নির্দেশনাবলি
                </h4>
                <ul className="space-y-0.5 text-[6.5px] text-slate-600 list-disc pl-3 leading-tight">
                  {customInstructions && customInstructions.length > 0 ? (
                    customInstructions.map((item, idx) => <li key={idx}>{item}</li>)
                  ) : (
                    <>
                      <li>এই কার্ডটি সর্বাবস্থায় সাথে রাখুন।</li>
                      <li>হারিয়ে গেলে অবিলম্বে মাদরাসা অফিসে জানান।</li>
                    </>
                  )}
                </ul>

                <div className="mt-1.5 p-1.5 bg-slate-50 rounded-lg border border-slate-200 text-[6.5px] space-y-0.5 text-center">
                  <div className="flex items-center justify-center gap-1 font-bold text-slate-800 border-b border-slate-200 pb-0.5 text-center">
                    <Phone className="w-2 h-2 text-slate-600" />
                    <span>জরুরী যোগাযোগ</span>
                  </div>
                  <p className="font-extrabold text-slate-900 text-[8.5px] truncate leading-tight mt-0.5 text-center">{madrasaName}</p>
                  <p className="text-slate-600 truncate leading-tight text-center">{madrasaAddress}</p>
                  {mohtamimName && (
                    <p className="text-slate-700 truncate leading-tight text-center">
                      <span className="text-slate-500 font-medium">মুহতামিম:</span> {mohtamimName}
                    </p>
                  )}
                  <p className="text-slate-700 truncate leading-tight font-mono font-bold text-center">
                    <span className="text-slate-500 font-sans font-normal">মোবাইল:</span> {madrasaPhone}
                  </p>
                </div>
              </div>

              <div className="text-center text-[6.5px] border-t border-slate-200 pt-1 space-y-0.5">
                <p className="font-bold text-slate-700 truncate">{madrasaName}</p>
                <p className="text-slate-600 font-bold">
                  কার্ডের মেয়াদ: <span className="font-mono">{displayExpiryDate}</span>
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* =========================================================================
          TEMPLATE 3: PREMIUM MADRASA
         ========================================================================= */}
      {resolvedTemplate === "premium_madrasa" && (
        <>
          {side === "front" ? (
            <div className={`w-full h-full flex flex-col justify-between relative z-10 ${tc.darkBg} text-white`}>
              {/* Header */}
              <div className={`p-1.5 text-center ${tc.darkHeader} border-b-2 border-amber-400 shrink-0`}>
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  {madrasaInfo?.logo_url ? (
                    <img
                      src={madrasaInfo.logo_url}
                      alt="Logo"
                      className="w-4 h-4 object-contain rounded-full bg-white/10 p-0.5 border border-amber-300/40"
                    />
                  ) : null}
                  <h3
                    className="font-black text-amber-300 line-clamp-1"
                    style={{ fontSize: nameFontSize }}
                  >
                    {madrasaName}
                  </h3>
                </div>
                <p className="text-[6.5px] text-amber-100/80 line-clamp-1">{madrasaAddress}</p>
              </div>

              {/* Gold Ribbon Header */}
              <div className="bg-linear-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 text-[7px] font-black py-0.2 text-center uppercase tracking-widest shrink-0">
                ★ OFFICIAL STUDENT ID ★
              </div>

              {/* Center Content */}
              <div className="flex-1 flex flex-col items-center px-1.5 pt-1 pb-0.5">
                <div className="w-[48px] h-[48px] rounded-full border-2 border-amber-400 bg-white p-0.5 shadow-md overflow-hidden mb-0.5">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={studentName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover rounded-full"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <IdCard className="w-5 h-5 text-slate-400 m-auto mt-1" />
                  )}
                </div>

                <h4 className="font-extrabold text-[10px] text-amber-100 line-clamp-1">{studentName}</h4>
                <span className="text-[7.5px] font-mono font-bold text-amber-300">{studentIdCode}</span>

                {/* Details Grid */}
                <div className="w-full mt-1 grid grid-cols-2 gap-1 text-[7px]">
                  {infoGridItems.map((item, idx) => (
                    <div key={idx} className={`${tc.gridItemBg} p-0.5 rounded border ${tc.gridItemBorder} text-center`}>
                      <span className="text-amber-200/80 block text-[6px]">{item.label}</span>
                      <strong className={`block truncate leading-tight ${item.colorClass || "text-white font-bold"}`}>
                        {item.value}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer - 100% MATHEMATICALLY CENTERED SIGNATURE */}
              <div className={`relative p-1.5 ${tc.darkHeader} border-t border-amber-400/50 flex items-end justify-center min-h-[38px] shrink-0`}>
                <div className="flex flex-col items-center justify-end text-center pb-0.5 mx-auto">
                  <div className="h-4 flex items-center justify-center mb-0.5 w-full">
                    {madrasaInfo?.signature_url ? (
                      <img src={madrasaInfo.signature_url} alt="Sign" className="h-4 max-w-[54px] object-contain" />
                    ) : (
                      <div className="h-3 w-full" />
                    )}
                  </div>
                  <div className="w-16 border-b border-amber-300/80 mb-0.5" />
                  <span className="font-extrabold text-[7px] text-amber-200 block leading-none">{signatureTitle}</span>
                  {mohtamimName ? (
                    <span className="text-[6px] text-amber-300/80 block leading-tight font-medium truncate max-w-[95px] mt-0.5">
                      {mohtamimName}
                    </span>
                  ) : null}
                </div>
                {isFieldVisible("qr_code", true) && (
                  <div className="absolute right-1.5 bottom-1 flex flex-col items-center justify-center shrink-0 text-center">
                    {qrCodeUrl && (
                      <img src={qrCodeUrl} alt="QR" className="w-7 h-7 rounded border border-amber-400 p-0.5 bg-white shadow-2xs" />
                    )}
                    <span className="text-[5px] font-mono font-bold text-amber-300 mt-0.5 leading-none text-center block">{qrLabel}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={`w-full h-full flex flex-col justify-between relative z-10 ${tc.darkBg} text-amber-100 p-2`}>
              <div>
                <h4 className="font-black text-[9px] text-amber-300 border-b border-amber-400/40 pb-0.5 mb-1.5 text-center w-full block">
                  জরুরি নির্দেশনাবলি
                </h4>
                <ul className="space-y-0.5 text-[6.5px] text-amber-100/90 list-disc pl-3 leading-tight">
                  {customInstructions && customInstructions.length > 0 ? (
                    customInstructions.map((item, idx) => <li key={idx}>{item}</li>)
                  ) : (
                    <>
                      <li>কার্ডটি মাদরাসার অফিশিয়াল সম্পদ।</li>
                      <li>হারিয়ে গেলে অবিলম্বে কর্তৃপক্ষকে জানান।</li>
                    </>
                  )}
                </ul>

                <div className="mt-1.5 p-1.5 bg-amber-950/60 rounded-lg border border-amber-400/30 text-[6.5px] space-y-0.5 text-center">
                  <div className="flex items-center justify-center gap-1 font-bold text-amber-300 border-b border-amber-400/30 pb-0.5 text-center">
                    <Phone className="w-2 h-2 text-amber-400" />
                    <span>জরুরী যোগাযোগ</span>
                  </div>
                  <p className="font-extrabold text-amber-100 text-[8.5px] truncate leading-tight mt-0.5 text-center">{madrasaName}</p>
                  <p className="text-amber-200/80 truncate leading-tight text-center">{madrasaAddress}</p>
                  {mohtamimName && (
                    <p className="text-amber-200/90 truncate leading-tight text-center">
                      <span className="text-amber-300/70 font-medium">মুহতামিম:</span> {mohtamimName}
                    </p>
                  )}
                  <p className="text-amber-200 truncate leading-tight font-mono font-bold text-center">
                    <span className="text-amber-300/70 font-sans font-normal">মোবাইল:</span> {madrasaPhone}
                  </p>
                </div>
              </div>

              <div className="border-t border-amber-400/30 pt-1 text-center text-[6.5px] space-y-0.5">
                <p className="font-bold text-amber-300 truncate">{madrasaName}</p>
                <p className="text-amber-200 font-bold">
                  কার্ডের মেয়াদ: <span className="font-mono">{displayExpiryDate}</span>
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  if (scale && scale !== 1) {
    return (
      <div
        className="shrink-0 inline-block overflow-hidden rounded-[14px]"
        style={{
          width: `calc(2.125in * ${scale})`,
          height: `calc(3.375in * ${scale})`,
        }}
      >
        {cardContent}
      </div>
    );
  }

  return cardContent;
}
