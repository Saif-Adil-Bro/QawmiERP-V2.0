"use client";

import React, { useRef, useState, useEffect } from "react";
import { StaffMember } from "@/lib/staff-management";
import {
  Printer,
  Download,
  QrCode,
  ShieldCheck,
  X,
  Building2,
  Phone,
  Mail,
  UserCheck,
  Scissors,
  Layers,
  CheckCircle2,
  Sparkles,
  MapPin,
  Calendar,
  Eye,
} from "lucide-react";
import QRCode from "qrcode";
import { toBanglaNumber } from "@/lib/numberToBangla";

export interface MadrasaInfoType {
  id?: string;
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  registration_no?: string;
  reg_no?: string;
  established_year?: string;
  principal_name?: string;
  principal_signature_url?: string;
  signature_url?: string;
  eiin_code?: string;
  slogan?: string;
  website?: string;
}

interface StaffIdCardModalProps {
  staff: StaffMember;
  madrasaInfo?: MadrasaInfoType;
  madrasaName?: string;
  madrasaPhone?: string;
  madrasaAddress?: string;
  onClose: () => void;
}

export default function StaffIdCardModal({
  staff,
  madrasaInfo,
  madrasaName: fallbackMadrasaName = "মাদ্রাসাতুল মুসলিমীন",
  madrasaPhone: fallbackMadrasaPhone = "০১৮১২৩৪৫৬৭৮",
  madrasaAddress: fallbackMadrasaAddress = "মাদ্রাসা রোড, সদর, বাংলাদেশ",
  onClose,
}: StaffIdCardModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [activeSide, setActiveSide] = useState<"both" | "front" | "back">("both");
  const [printLayout, setPrintLayout] = useState<"both_side" | "both_foldable" | "front_only" | "back_only">("both_side");
  const [isPrinting, setIsPrinting] = useState(false);

  // Consolidated Dynamic Madrasa Info
  const mName = madrasaInfo?.name || fallbackMadrasaName;
  const mPhone = madrasaInfo?.phone || fallbackMadrasaPhone;
  const mAddress = madrasaInfo?.address || fallbackMadrasaAddress;
  const mEmail = madrasaInfo?.email || "";
  const mLogo = madrasaInfo?.logo_url || "";
  const mSignature = madrasaInfo?.signature_url || madrasaInfo?.principal_signature_url || "";
  const mPrincipalName = madrasaInfo?.principal_name || "মুহতামিম / অধ্যক্ষ";
  const mRegNo = madrasaInfo?.registration_no || madrasaInfo?.reg_no || "";

  const verificationUrl = typeof window !== "undefined"
    ? `${window.location.origin}/verify-staff/${staff.id_card?.verification_token || staff.id}`
    : `https://qawmimanager.com/verify-staff/${staff.id_card?.verification_token || staff.id}`;

  useEffect(() => {
    QRCode.toDataURL(verificationUrl, {
      width: 140,
      margin: 1,
      color: { dark: "#064e3b", light: "#ffffff" },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("Error generating QR code:", err));
  }, [verificationUrl]);

  const handlePrint = () => {
    setIsPrinting(true);
    const printableElement = document.getElementById("staff-id-card-printable-area");
    if (!printableElement) {
      window.print();
      setIsPrinting(false);
      return;
    }

    const existing = document.getElementById("temp-print-frame");
    if (existing) existing.remove();

    const clone = printableElement.cloneNode(true) as HTMLElement;
    clone.id = "temp-print-frame";
    clone.classList.remove("hidden");
    clone.classList.add("block");
    document.body.appendChild(clone);
    document.body.classList.add("is-printing-now");

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove("is-printing-now");
        const temp = document.getElementById("temp-print-frame");
        if (temp) temp.remove();
        setIsPrinting(false);
      }, 500);
    }, 200);
  };

  const isRevoked = staff.id_card?.is_revoked || staff.employment.status === "TERMINATED";
  const isInactive = staff.employment.status === "INACTIVE" || staff.employment.status === "RESIGNED";
  const categoryLabel = staff.employment.category_name?.split("(")[0] || "স্টাফ";

  // Shared FRONT CARD COMPONENT
  const renderFrontCard = (isPrintVersion = false) => (
    <div
      className={`bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden flex flex-col justify-between relative select-none ${
        isPrintVersion
          ? "w-[54mm] h-[85.6mm] max-w-[54mm] max-h-[85.6mm] print:shadow-none print:border-slate-400"
          : "w-full max-w-[280px] h-[440px]"
      }`}
      style={{
        boxSizing: "border-box",
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      {/* Top Header Background */}
      <div
        className="bg-emerald-800 text-white px-3 py-2.5 text-center relative"
        style={{
          background: "linear-gradient(135deg, #064e3b 0%, #047857 60%, #0f766e 100%)",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      >
        <div className="flex items-center justify-center gap-1.5">
          {mLogo ? (
            <img
              src={mLogo}
              alt="Madrasa Logo"
              className="w-7 h-7 rounded-full object-contain bg-white/90 p-0.5 shadow-xs shrink-0"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-emerald-700/80 border border-emerald-400/50 flex items-center justify-center text-emerald-100 text-[10px] font-bold shrink-0">
              <Building2 className="w-3.5 h-3.5" />
            </div>
          )}
          <div className="text-left overflow-hidden">
            <h4 className="text-[11px] sm:text-xs font-bold leading-tight line-clamp-1 text-white">
              {mName}
            </h4>
            <div className="text-[8px] text-emerald-200 font-medium tracking-wide leading-none mt-0.5">
              কর্মচারী ও শিক্ষক পরিচিতিপত্র
            </div>
          </div>
        </div>

        {/* Dynamic Category Ribbon */}
        <div
          className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[8px] font-bold text-white shadow-xs border border-emerald-500 whitespace-nowrap"
          style={{
            background: "#065f46",
            WebkitPrintColorAdjust: "exact",
            printColorAdjust: "exact",
          }}
        >
          {categoryLabel}
        </div>
      </div>

      {/* Center Body */}
      <div className="p-3 pt-4 flex-1 flex flex-col items-center justify-between text-center bg-gradient-to-b from-white via-slate-50/50 to-emerald-50/30">
        {/* Photo Container */}
        <div className="relative mt-1">
          <div className="w-20 h-20 rounded-full border-2 border-emerald-600 shadow-sm overflow-hidden bg-emerald-50 flex items-center justify-center text-emerald-800 text-2xl font-bold">
            {staff.personal.photo_url ? (
              <img
                src={staff.personal.photo_url}
                alt={staff.personal.first_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{staff.personal.first_name?.charAt(0) || "ক"}</span>
            )}
          </div>
          {/* Active status pulse badge */}
          {!isRevoked && !isInactive && (
            <div className="absolute bottom-0 right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-xs" />
          )}
        </div>

        {/* Staff Names & Designation */}
        <div className="mt-1.5 space-y-0.5">
          <h5 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug">
            {staff.personal.full_name_bn || `${staff.personal.first_name} ${staff.personal.last_name}`}
          </h5>
          <p className="text-[11px] font-semibold text-emerald-800 leading-tight">
            {staff.employment.designation}
          </p>
          <p className="text-[9px] text-slate-500 font-medium">
            {staff.employment.department_name}
          </p>
        </div>

        {/* Identification Grid */}
        <div className="w-full bg-slate-100/90 rounded-lg p-1.5 border border-slate-200 grid grid-cols-2 gap-1 text-[9px] mt-1 text-left">
          <div>
            <span className="text-slate-500 block text-[8px]">স্টাফ আইডি:</span>
            <span className="font-mono font-bold text-slate-900">{staff.staff_id_code}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 block text-[8px]">রক্তের গ্রুপ:</span>
            <span className="font-bold text-rose-600">{staff.personal.blood_group || "অজানা"}</span>
          </div>
        </div>

        {/* Bottom Signature & Issue Date Footer */}
        <div className="w-full flex items-end justify-between border-t border-slate-200 pt-1.5 text-[8px] text-slate-500 mt-1">
          <div className="text-left">
            <span className="text-[7px] text-slate-400 block">ইস্যু তারিখ:</span>
            <span className="font-semibold text-slate-700">
              {staff.id_card?.issue_date ? toBanglaNumber(staff.id_card.issue_date) : toBanglaNumber(staff.employment.joining_date)}
            </span>
          </div>

          <div className="text-center flex flex-col items-center">
            {mSignature ? (
              <img
                src={mSignature}
                alt="Signature"
                className="h-5 max-w-[60px] object-contain mb-0.5"
              />
            ) : (
              <div className="w-14 border-b border-slate-400 mb-0.5" />
            )}
            <span className="text-[7px] font-bold text-slate-700 leading-none">
              {mPrincipalName}
            </span>
            <span className="text-[6px] text-slate-400 leading-none">কর্তৃপক্ষের স্বাক্ষর</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Shared BACK CARD COMPONENT
  const renderBackCard = (isPrintVersion = false) => (
    <div
      className={`bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden flex flex-col justify-between p-3 relative select-none ${
        isPrintVersion
          ? "w-[54mm] h-[85.6mm] max-w-[54mm] max-h-[85.6mm] print:shadow-none print:border-slate-400"
          : "w-full max-w-[280px] h-[440px]"
      }`}
      style={{
        boxSizing: "border-box",
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      <div>
        {/* Back Header */}
        <div className="text-center border-b border-slate-200 pb-1.5 mb-2">
          <h6 className="text-[11px] font-bold text-slate-800 leading-tight">জরুরি যোগাযোগ ও নির্দেশিকা</h6>
          <p className="text-[8px] text-slate-500 leading-tight">এই কার্ডটি মাদ্রাসার সম্পত্তি। পাওয়া গেলে ফেরত দিন।</p>
        </div>

        {/* Contact Info List */}
        <div className="space-y-1.5 text-[9px] text-slate-700">
          <div className="flex items-start gap-1">
            <Phone className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-500 text-[8px] block">ব্যক্তিগত মোবাইল:</span>
              <span className="font-bold text-slate-800">{staff.contact.phone || "-"}</span>
            </div>
          </div>

          {staff.contact.emergency_contact_phone && (
            <div className="flex items-start gap-1">
              <Phone className="w-3 h-3 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-500 text-[8px] block">
                  জরুরি যোগাযোগ ({staff.contact.emergency_contact_relation || "অভিভাবক"}):
                </span>
                <span className="font-bold text-slate-800">{staff.contact.emergency_contact_phone}</span>
              </div>
            </div>
          )}

          <div className="flex items-start gap-1">
            <Building2 className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-500 text-[8px] block">মাদ্রাসার ঠিকানা:</span>
              <span className="text-slate-800 text-[8px] leading-tight block">{mAddress}</span>
            </div>
          </div>

          {mPhone && (
            <div className="flex items-start gap-1">
              <Phone className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-500 text-[8px] block">মাদ্রাসা ফোন / অফিস:</span>
                <span className="text-slate-800 text-[8px] leading-tight block font-medium">{mPhone}</span>
              </div>
            </div>
          )}

          {mRegNo && (
            <div className="bg-slate-50 rounded p-1 border border-slate-200/60 text-[8px] text-slate-600">
              <span className="font-semibold text-slate-500">নিবন্ধন নং: </span>
              <span className="font-mono">{mRegNo}</span>
            </div>
          )}
        </div>
      </div>

      {/* QR Code Verification Section */}
      <div className="border-t border-slate-200 pt-2 flex items-center justify-between gap-2">
        <div className="text-left flex-1">
          <div className="text-[9px] font-bold text-emerald-800 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>ভেরিফাইড আইডি</span>
          </div>
          <p className="text-[7px] text-slate-500 mt-0.5 leading-tight">
            স্টাফের সত্যতা যাচাই করতে যেকোনো কিউআর স্ক্যানার ব্যবহার করুন।
          </p>
          <p className="font-mono text-[6.5px] text-slate-400 mt-0.5">
            QM-STF-{(staff.id_card?.verification_token || staff.id).substring(0, 8).toUpperCase()}
          </p>
        </div>

        <div className="p-1 bg-white rounded-lg border border-slate-200 shadow-2xs shrink-0 flex items-center justify-center min-w-12 min-h-12">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" className="w-12 h-12" />
          ) : (
            <div className="w-12 h-12 bg-slate-100 animate-pulse rounded" />
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in duration-150 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                ডিজিটাল স্টাফ আইডি কার্ড (Staff ID Card)
              </h3>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <span>{staff.personal.full_name_bn || `${staff.personal.first_name} ${staff.personal.last_name}`}</span>
                <span>•</span>
                <span className="font-mono text-emerald-700 font-bold">{staff.staff_id_code}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? "প্রিন্ট হচ্ছে..." : "প্রিন্ট / PDF"}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Switcher Controls Bar */}
        <div className="px-6 py-2.5 bg-slate-100/70 border-b border-slate-200/70 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Card Side Toggle */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs font-semibold">
            <button
              onClick={() => setActiveSide("both")}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                activeSide === "both" ? "bg-emerald-700 text-white shadow-2xs" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              উভয় পাশ
            </button>
            <button
              onClick={() => setActiveSide("front")}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                activeSide === "front" ? "bg-emerald-700 text-white shadow-2xs" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              সামনের পাশ
            </button>
            <button
              onClick={() => setActiveSide("back")}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                activeSide === "back" ? "bg-emerald-700 text-white shadow-2xs" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              পেছনের পাশ
            </button>
          </div>

          {/* Print Layout Selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium text-[11px]">প্রিন্ট ফরম্যাট:</span>
            <select
              value={printLayout}
              onChange={(e) => setPrintLayout(e.target.value as any)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              <option value="both_side">উভয় পাশ পাশাপাশি (A4 / Card)</option>
              <option value="both_foldable">উভয় পাশ উপর-নিচ (ভাঁজ করার জন্য)</option>
              <option value="front_only">শুধু সামনের পাশ</option>
              <option value="back_only">শুধু পেছনের পাশ</option>
            </select>
          </div>
        </div>

        {/* Modal Body: Interactive On-Screen Card Preview */}
        <div className="p-6 bg-slate-100/90 flex-1 overflow-y-auto flex flex-col items-center justify-center gap-5">
          {/* Status Alerts */}
          {isRevoked && (
            <div className="w-full max-w-xl bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2 rounded-xl text-xs flex items-center gap-2 font-medium">
              <span className="font-bold">সতর্কবার্তা:</span> এই আইডি কার্ডটি বাতিল/অব্যাহতিপ্রাপ্ত (REVOKED)।
            </div>
          )}
          {isInactive && !isRevoked && (
            <div className="w-full max-w-xl bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-xl text-xs flex items-center gap-2 font-medium">
              <span className="font-bold">সতর্কবার্তা:</span> এই কর্মীর স্ট্যাটাস বর্তমানে নিষ্ক্রিয়/ইস্তফাপ্রাপ্ত।
            </div>
          )}

          {/* Cards Display Grid */}
          <div className="flex flex-wrap items-center justify-center gap-6 w-full max-w-2xl py-2">
            {(activeSide === "both" || activeSide === "front") && (
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">সামনের পিঠ (Front)</span>
                {renderFrontCard(false)}
              </div>
            )}

            {(activeSide === "both" || activeSide === "back") && (
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">পেছনের পিঠ (Back)</span>
                {renderBackCard(false)}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>কার্ড স্ট্যাটাস:</span>
            <span
              className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                isRevoked
                  ? "bg-rose-100 text-rose-700"
                  : isInactive
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {isRevoked ? "বাতিল (REVOKED)" : isInactive ? "নিষ্ক্রিয় (INACTIVE)" : "সক্রিয় ও বৈধ (VALID)"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>কার্ড প্রিন্ট করুন</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl transition cursor-pointer"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* HIDDEN PRINT-ISOLATED SHEET (RENDERED ONLY DURING PRINT) */}
      {/* ========================================================= */}
      <div id="staff-id-card-printable-area" className="hidden">
        <style dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 10mm;
              }
              *, *::before, *::after {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .staff-print-container {
                width: 100% !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                padding-top: 15mm !important;
                background: #ffffff !important;
              }
              .staff-print-sheet {
                display: flex !important;
                gap: 8mm !important;
                align-items: center !important;
                justify-content: center !important;
              }
              .staff-print-sheet.foldable {
                flex-direction: column !important;
                gap: 0 !important;
              }
              .staff-card-box {
                width: 54mm !important;
                height: 85.6mm !important;
                max-width: 54mm !important;
                max-height: 85.6mm !important;
                border: 1px dashed #94a3b8 !important;
                box-sizing: border-box !important;
                overflow: hidden !important;
                background: #ffffff !important;
                page-break-inside: avoid !important;
              }
            }
          `
        }} />

        <div className="staff-print-container">
          {/* Header watermark/guideline for cutter */}
          <div className="text-center mb-4 text-slate-500 text-[10px] print:block">
            <p className="font-bold text-slate-800 text-xs">{mName}</p>
            <p>ডিজিটাল স্টাফ আইডি কার্ড • কার্ড কাটার জন্য ড্যাশ রেখা অনুসরণ করুন (CR80 সাইজ: ৫৪ মিমি × ৮৫.৬ মিমি)</p>
          </div>

          {/* Cards container based on layout */}
          <div className={`staff-print-sheet ${printLayout === "both_foldable" ? "foldable" : ""}`}>
            {(printLayout === "both_side" || printLayout === "both_foldable" || printLayout === "front_only") && (
              <div className="staff-card-box">
                {renderFrontCard(true)}
              </div>
            )}

            {printLayout === "both_foldable" && (
              <div className="w-[54mm] border-t-2 border-dashed border-slate-400 my-0 flex items-center justify-center relative">
                <span className="bg-white px-2 text-[7px] text-slate-400 uppercase tracking-widest -mt-1.5 flex items-center gap-1">
                  <Scissors className="w-2.5 h-2.5" /> ভাঁজ করুন (Fold Line)
                </span>
              </div>
            )}

            {(printLayout === "both_side" || printLayout === "both_foldable" || printLayout === "back_only") && (
              <div className="staff-card-box">
                {renderBackCard(true)}
              </div>
            )}
          </div>

          <div className="mt-6 text-center text-[9px] text-slate-400 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>স্বয়ংক্রিয় যাচাইকৃত ডিজিটাল পরিচিতিপত্র • QawmiManager HRMS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
