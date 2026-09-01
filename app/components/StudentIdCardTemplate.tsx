"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { StudentIDCard } from "@/lib/id-card-management";
import { IdCard, Phone } from "lucide-react";

export type IDCardTemplateType =
  | "classic_islamic"
  | "modern_minimal"
  | "premium_madrasa"
  | "classic"
  | "modern"
  | "minimal";

interface StudentIdCardTemplateProps {
  card: StudentIDCard;
  side: "front" | "back";
  templateId?: IDCardTemplateType | string;
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

export default function StudentIdCardTemplate({
  card,
  side,
  templateId = "classic_islamic",
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
        color: { dark: "#064e3b", light: "#ffffff" },
      })
        .then((url) => setInternalQrUrl(url))
        .catch((err) => console.error("QR Code Error:", err));
    }
  }, [card?.verification_id, externalQrUrl]);

  const qrCodeUrl = externalQrUrl || internalQrUrl;

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
  const studentIdCode = card.card_number || snapshot.student_id_code || "QM-26-000000";
  const className = snapshot.class_name || "—";
  const rollNumber = snapshot.roll_number || "—";
  const sessionName = snapshot.session_name || "—";
  const fatherName = snapshot.father_name;
  const parentPhone = snapshot.parent_phone;
  const bloodGroup = snapshot.blood_group && snapshot.blood_group !== "—" ? snapshot.blood_group : null;
  const photoUrl = snapshot.photo_url || card.photo_url;
  const isStatusActive = card.status === "ACTIVE";

  const madrasaName = madrasaInfo?.name || "জামিয়া ইসলামিয়া দারুল উলুম";
  const madrasaAddress = madrasaInfo?.address || "ঢাকা, বাংলাদেশ";
  const madrasaPhone = madrasaInfo?.phone || "+880 1700-000000";
  const madrasaWebsite = madrasaInfo?.website || "www.qawmierp.app";

  return (
    <div
      className="relative rounded-[12px] overflow-hidden bg-white text-slate-800 shadow-md border border-slate-200 select-none print:shadow-none print:border-slate-300 id-card-print-item shrink-0"
      style={{
        width: "2.125in",
        height: "3.375in",
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: "top left",
        boxSizing: "border-box",
      }}
    >
      <IslamicStarWatermark />

      {/* =========================================================================
          TEMPLATE 1: CLASSIC ISLAMIC (Classic Emerald & Gold Theme)
         ========================================================================= */}
      {resolvedTemplate === "classic_islamic" && (
        <>
          {side === "front" ? (
            /* FRONT SIDE */
            <div className="w-full h-full flex flex-col justify-between relative z-10 text-slate-900 bg-linear-to-b from-emerald-50/40 via-white to-slate-50/30">
              {/* Header */}
              <div className="bg-emerald-900 text-white pt-2 pb-1.5 px-1.5 text-center relative border-b-2 border-amber-400 shrink-0">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  {madrasaInfo?.logo_url ? (
                    <img
                      src={madrasaInfo.logo_url}
                      alt="Logo"
                      className="w-4 h-4 object-contain rounded-full bg-white/10 p-0.5 border border-amber-300/40"
                    />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-emerald-800 border border-amber-400/60 flex items-center justify-center text-[7px] font-bold text-amber-300">
                      م
                    </div>
                  )}
                  <h3 className="font-bold text-[9.5px] leading-tight text-amber-100 tracking-tight line-clamp-1">
                    {madrasaName}
                  </h3>
                </div>
                <p className="text-[7px] text-emerald-200/90 leading-none line-clamp-1">{madrasaAddress}</p>
                
                {/* Gold Subheader Banner */}
                <div className="mt-1 mx-auto max-w-[90%] bg-linear-to-r from-amber-500 via-yellow-400 to-amber-500 text-emerald-950 text-[7px] font-black py-0.2 px-1.5 rounded-full uppercase tracking-wider shadow-2xs">
                  STUDENT ID CARD • ছাত্র পরিচয়পত্র
                </div>
              </div>

              {/* Photo & Identity Core */}
              <div className="flex-1 flex flex-col items-center px-2 pt-1 pb-0.5">
                {/* Photo frame with Gold Border */}
                <div className="relative mb-0.5">
                  <div className="w-[50px] h-[50px] rounded-lg border-2 border-amber-400 bg-slate-100 shadow-2xs overflow-hidden flex items-center justify-center">
                    {photoUrl ? (
                      <img src={photoUrl} alt={studentName} className="w-full h-full object-cover" />
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

                <div className="mt-0.5 px-1.5 py-0.1 bg-emerald-100/80 text-emerald-900 rounded border border-emerald-300 font-mono font-bold text-[8px]">
                  {studentIdCode}
                </div>

                {/* Structured Info Grid */}
                <div className="w-full mt-1.5 grid grid-cols-2 gap-1 text-[7.5px]">
                  <div className="bg-white/90 p-0.5 px-1 rounded border border-slate-200/80 text-center">
                    <span className="text-slate-500 block text-[6.5px]">জামাত / শ্রেণি</span>
                    <strong className="text-slate-800 font-bold block truncate leading-tight">{className}</strong>
                  </div>

                  <div className="bg-white/90 p-0.5 px-1 rounded border border-slate-200/80 text-center">
                    <span className="text-slate-500 block text-[6.5px]">রোল নম্বর</span>
                    <strong className="text-slate-800 font-bold block leading-tight">{rollNumber}</strong>
                  </div>

                  <div className="bg-white/90 p-0.5 px-1 rounded border border-slate-200/80 text-center">
                    <span className="text-slate-500 block text-[6.5px]">শিক্ষাবর্ষ</span>
                    <strong className="text-slate-800 font-bold block truncate leading-tight">{sessionName}</strong>
                  </div>

                  {bloodGroup ? (
                    <div className="bg-white/90 p-0.5 px-1 rounded border border-slate-200/80 text-center">
                      <span className="text-slate-500 block text-[6.5px]">রক্তের গ্রুপ</span>
                      <strong className="text-rose-600 font-bold block leading-tight">{bloodGroup}</strong>
                    </div>
                  ) : fatherName ? (
                    <div className="bg-white/90 p-0.5 px-1 rounded border border-slate-200/80 text-center">
                      <span className="text-slate-500 block text-[6.5px]">পিতার নাম</span>
                      <strong className="text-slate-800 font-bold block truncate leading-tight">{fatherName}</strong>
                    </div>
                  ) : (
                    <div className="bg-white/90 p-0.5 px-1 rounded border border-slate-200/80 text-center">
                      <span className="text-slate-500 block text-[6.5px]">স্ট্যাটাস</span>
                      <strong className="text-emerald-700 font-bold block leading-tight">নিয়মিত</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Authorization & QR Section - CENTER ALIGNED */}
              <div className="bg-slate-50 px-2 py-1 border-t border-slate-200 flex items-center justify-between gap-1 shrink-0">
                {/* Left: Mohtamim Signature (CENTER ALIGNED) */}
                <div className="flex flex-col items-center justify-center flex-1 text-center">
                  {madrasaInfo?.signature_url ? (
                    <img src={madrasaInfo.signature_url} alt="Sign" className="h-4 max-w-[45px] object-contain mb-0.5" />
                  ) : (
                    <div className="w-10 border-b border-slate-400 mb-1" />
                  )}
                  <span className="font-extrabold text-[6.5px] text-slate-700 block leading-none">{signatureTitle}</span>
                </div>

                {/* Right: QR Code (CENTER ALIGNED) */}
                <div className="flex flex-col items-center justify-center shrink-0">
                  {qrCodeUrl ? (
                    <img
                      src={qrCodeUrl}
                      alt="QR"
                      className="w-8 h-8 border border-emerald-800/20 p-0.5 rounded bg-white shadow-2xs"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-slate-200 rounded animate-pulse" />
                  )}
                  <span className="text-[5.5px] font-mono font-bold text-emerald-800 mt-0.5 leading-none">{qrLabel}</span>
                </div>
              </div>

              {/* Bottom Emerald Strip */}
              <div className="h-1 bg-emerald-900 w-full shrink-0" />
            </div>
          ) : (
            /* BACK SIDE */
            <div className="w-full h-full flex flex-col justify-between relative z-10 text-slate-800 bg-white p-2">
              <div>
                {/* Back Header */}
                <div className="bg-emerald-900 text-amber-300 py-0.5 px-1.5 rounded-md text-center font-bold text-[8.5px] mb-1.5 shadow-2xs border-b border-amber-400">
                  জরুরি নির্দেশাবলী
                </div>

                {/* Instructions List */}
                <ul className="space-y-0.5 text-[7px] text-slate-700 list-disc pl-3 leading-tight">
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
                <div className="mt-2 p-1 bg-emerald-50/80 rounded-lg border border-emerald-200 space-y-0.5 text-[7px]">
                  <div className="flex items-center gap-1 font-bold text-emerald-900 border-b border-emerald-200/60 pb-0.5">
                    <Phone className="w-2 h-2 text-emerald-700" />
                    <span>জরুরি যোগাযোগ</span>
                  </div>
                  {parentPhone && (
                    <p className="truncate">
                      <span className="text-slate-500">অভিভাবক:</span>{" "}
                      <strong className="text-slate-800">{parentPhone}</strong>
                    </p>
                  )}
                  <p className="truncate">
                    <span className="text-slate-500">অফিস:</span>{" "}
                    <strong className="text-slate-800">{madrasaPhone}</strong>
                  </p>
                </div>
              </div>

              {/* Footer Section */}
              <div className="border-t border-slate-200 pt-1 space-y-0.5 text-[7px] text-center">
                <div className="flex justify-between items-center text-[6.5px] text-slate-500 px-0.5 font-mono">
                  <span>ইস্যু: {card.issue_date || "01-09-2026"}</span>
                  <span>মেয়াদ: {card.expiry_date || "31-08-2027"}</span>
                </div>

                <div className="bg-slate-900 text-white py-0.5 rounded text-[6.5px] font-bold line-clamp-1">
                  {madrasaName}
                </div>
                <p className="text-[6px] text-slate-400 font-mono truncate">{madrasaWebsite}</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* =========================================================================
          TEMPLATE 2: MODERN MINIMAL (Clean White & Emerald Accent)
         ========================================================================= */}
      {resolvedTemplate === "modern_minimal" && (
        <>
          {side === "front" ? (
            <div className="w-full h-full flex flex-col justify-between relative z-10 bg-white text-slate-800">
              {/* Top Accent Line */}
              <div className="h-1.5 bg-linear-to-r from-emerald-600 via-emerald-800 to-emerald-600 w-full shrink-0" />

              {/* Header */}
              <div className="pt-1.5 px-1.5 text-center shrink-0">
                <h3 className="font-extrabold text-[9.5px] text-emerald-950 leading-tight line-clamp-1">
                  {madrasaName}
                </h3>
                <p className="text-[7px] text-slate-500 line-clamp-1 mt-0.5">{madrasaAddress}</p>
                <span className="inline-block mt-0.5 px-1.5 py-0.1 bg-emerald-50 text-emerald-800 rounded-full text-[6.5px] font-bold border border-emerald-200">
                  STUDENT IDENTITY CARD
                </span>
              </div>

              {/* Center Student Photo & Info */}
              <div className="flex-1 flex flex-col items-center px-2 pt-1">
                <div className="w-[48px] h-[48px] rounded-xl border-2 border-emerald-600/40 bg-slate-50 shadow-2xs overflow-hidden flex items-center justify-center mb-0.5">
                  {photoUrl ? (
                    <img src={photoUrl} alt={studentName} className="w-full h-full object-cover" />
                  ) : (
                    <IdCard className="w-5 h-5 text-slate-400" />
                  )}
                </div>

                <h4 className="font-bold text-slate-900 text-[10px] text-center line-clamp-1">
                  {studentName}
                </h4>

                <span className="font-mono font-bold text-[7.5px] text-emerald-700 bg-emerald-50 px-1 py-0.1 rounded border border-emerald-200 mt-0.5">
                  ID: {studentIdCode}
                </span>

                {/* Info List */}
                <div className="w-full mt-1.5 space-y-0.5 text-[7.5px]">
                  <div className="flex justify-between border-b border-slate-100 pb-0.5">
                    <span className="text-slate-500">জামাত:</span>
                    <span className="font-bold text-slate-800 truncate">{className}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-0.5">
                    <span className="text-slate-500">রোল:</span>
                    <span className="font-bold text-slate-800">{rollNumber}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-0.5">
                    <span className="text-slate-500">সেশন:</span>
                    <span className="font-bold text-slate-800 truncate">{sessionName}</span>
                  </div>
                  {bloodGroup && (
                    <div className="flex justify-between pb-0.5">
                      <span className="text-slate-500">রক্ত:</span>
                      <span className="font-bold text-rose-600">{bloodGroup}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Footer - CENTER ALIGNED */}
              <div className="p-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-1 shrink-0">
                <div className="flex flex-col items-center justify-center flex-1 text-center">
                  {madrasaInfo?.signature_url ? (
                    <img src={madrasaInfo.signature_url} alt="Sign" className="h-4 max-w-[45px] object-contain mb-0.5" />
                  ) : (
                    <div className="w-10 border-b border-slate-400 mb-1" />
                  )}
                  <span className="font-extrabold text-[6.5px] text-slate-700 block leading-none">{signatureTitle}</span>
                </div>
                <div className="flex flex-col items-center justify-center shrink-0">
                  {qrCodeUrl && (
                    <img src={qrCodeUrl} alt="QR" className="w-8 h-8 rounded border p-0.5 bg-white shadow-2xs" />
                  )}
                  <span className="text-[5.5px] font-mono font-bold text-slate-500 mt-0.5 leading-none">{qrLabel}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col justify-between relative z-10 bg-white p-2 text-slate-800">
              <div>
                <h4 className="font-bold text-[9px] text-emerald-900 border-b pb-0.5 mb-1">
                  জরুরি নির্দেশাবলী
                </h4>
                <ul className="space-y-0.5 text-[7px] text-slate-600 list-disc pl-3 leading-tight">
                  {customInstructions && customInstructions.length > 0 ? (
                    customInstructions.map((item, idx) => <li key={idx}>{item}</li>)
                  ) : (
                    <>
                      <li>এই কার্ডটি সর্বাবস্থায় সাথে রাখুন।</li>
                      <li>হারিয়ে গেলে অবিলম্বে মাদরাসা অফিসে জানান।</li>
                    </>
                  )}
                </ul>

                <div className="mt-2 p-1 bg-slate-50 rounded border border-slate-200 text-[7px] space-y-0.5">
                  <p className="font-bold text-slate-800">জরুরি যোগাযোগ:</p>
                  <p className="text-slate-600">ফোন: {madrasaPhone}</p>
                </div>
              </div>

              <div className="text-center text-[6.5px] text-slate-400 border-t pt-1">
                <p className="font-bold text-slate-700">{madrasaName}</p>
                <p>মেয়াদ: {card.expiry_date || "31-08-2027"}</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* =========================================================================
          TEMPLATE 3: PREMIUM MADRASA (Gold Ribbon & Royal Emerald Theme)
         ========================================================================= */}
      {resolvedTemplate === "premium_madrasa" && (
        <>
          {side === "front" ? (
            <div className="w-full h-full flex flex-col justify-between relative z-10 bg-emerald-950 text-white">
              {/* Header */}
              <div className="p-1.5 text-center bg-emerald-900 border-b-2 border-amber-400 shrink-0">
                <h3 className="font-black text-[9.5px] text-amber-300 line-clamp-1">{madrasaName}</h3>
                <p className="text-[6.5px] text-emerald-200 line-clamp-1">{madrasaAddress}</p>
              </div>

              {/* Gold Ribbon Header */}
              <div className="bg-linear-to-r from-amber-400 via-amber-300 to-amber-500 text-emerald-950 text-[7px] font-black py-0.2 text-center uppercase tracking-widest shrink-0">
                ★ OFFICIAL STUDENT ID ★
              </div>

              {/* Center Content */}
              <div className="flex-1 flex flex-col items-center px-1.5 pt-1 pb-0.5">
                <div className="w-[48px] h-[48px] rounded-full border-2 border-amber-400 bg-white p-0.5 shadow-md overflow-hidden mb-0.5">
                  {photoUrl ? (
                    <img src={photoUrl} alt={studentName} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <IdCard className="w-5 h-5 text-slate-400 m-auto mt-1" />
                  )}
                </div>

                <h4 className="font-extrabold text-[10px] text-amber-100 line-clamp-1">{studentName}</h4>
                <span className="text-[7.5px] font-mono font-bold text-amber-300">{studentIdCode}</span>

                {/* Details Grid */}
                <div className="w-full mt-1 grid grid-cols-2 gap-1 text-[7px]">
                  <div className="bg-emerald-900/80 p-0.5 rounded border border-emerald-700/60 text-center">
                    <span className="text-emerald-300 block text-[6px]">জামাত</span>
                    <strong className="text-white font-bold block truncate leading-tight">{className}</strong>
                  </div>
                  <div className="bg-emerald-900/80 p-0.5 rounded border border-emerald-700/60 text-center">
                    <span className="text-emerald-300 block text-[6px]">রোল</span>
                    <strong className="text-white font-bold block leading-tight">{rollNumber}</strong>
                  </div>
                </div>
              </div>

              {/* Footer - CENTER ALIGNED */}
              <div className="p-1.5 bg-emerald-900 border-t border-amber-400/50 flex items-center justify-between gap-1 shrink-0">
                <div className="flex flex-col items-center justify-center flex-1 text-center">
                  {madrasaInfo?.signature_url ? (
                    <img src={madrasaInfo.signature_url} alt="Sign" className="h-4 max-w-[45px] object-contain mb-0.5" />
                  ) : (
                    <div className="w-10 border-b border-amber-300/80 mb-1" />
                  )}
                  <span className="font-extrabold text-[6.5px] text-amber-200 block leading-none">{signatureTitle}</span>
                </div>
                <div className="flex flex-col items-center justify-center shrink-0">
                  {qrCodeUrl && (
                    <img src={qrCodeUrl} alt="QR" className="w-8 h-8 rounded border border-amber-400 p-0.5 bg-white shadow-2xs" />
                  )}
                  <span className="text-[5.5px] font-mono font-bold text-amber-300 mt-0.5 leading-none">{qrLabel}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col justify-between relative z-10 bg-emerald-950 text-emerald-100 p-2">
              <div>
                <h4 className="font-black text-[9px] text-amber-300 border-b border-amber-400/40 pb-0.5 mb-1.5">
                  জরুরি নির্দেশাবলী
                </h4>
                <ul className="space-y-0.5 text-[7px] text-emerald-200 list-disc pl-3">
                  {customInstructions && customInstructions.length > 0 ? (
                    customInstructions.map((item, idx) => <li key={idx}>{item}</li>)
                  ) : (
                    <>
                      <li>কার্ডটি মাদরাসার অফিশিয়াল সম্পদ।</li>
                      <li>হারিয়ে গেলে অবিলম্বে কর্তৃপক্ষকে জানান।</li>
                    </>
                  )}
                </ul>
              </div>

              <div className="border-t border-emerald-800 pt-1 text-center text-[6.5px] text-emerald-300">
                <p className="font-bold text-amber-200">{madrasaName}</p>
                <p>মেয়াদ: {card.expiry_date || "31-08-2027"}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
