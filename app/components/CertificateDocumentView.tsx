"use client";

import { useRef } from "react";
import { StudentCertificate, CertificateTemplateConfig, interpolateCertificateBody } from "@/lib/certificates";
import { Award, ShieldCheck, Printer, Download, Share2, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface CertificateDocumentViewProps {
  certificate: StudentCertificate;
  madrasaInfo?: {
    name?: string;
    address?: string;
    phone?: string;
  };
  templateConfig?: CertificateTemplateConfig;
  showActions?: boolean;
}

export default function CertificateDocumentView({
  certificate,
  madrasaInfo,
  templateConfig,
  showActions = true,
}: CertificateDocumentViewProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const snapshot = certificate.snapshot;

  // Derive theme colors
  const colorKey = templateConfig?.theme_color || "emerald";
  const themeClasses: Record<string, { border: string; text: string; bg: string; badge: string }> = {
    emerald: { border: "border-emerald-800", text: "text-emerald-900", bg: "bg-emerald-50/50", badge: "bg-emerald-700 text-white" },
    indigo: { border: "border-indigo-800", text: "text-indigo-900", bg: "bg-indigo-50/50", badge: "bg-indigo-700 text-white" },
    amber: { border: "border-amber-700", text: "text-amber-900", bg: "bg-amber-50/50", badge: "bg-amber-700 text-white" },
    slate: { border: "border-slate-800", text: "text-slate-900", bg: "bg-slate-50/50", badge: "bg-slate-800 text-white" },
    rose: { border: "border-rose-800", text: "text-rose-900", bg: "bg-rose-50/50", badge: "bg-rose-700 text-white" },
  };
  const activeTheme = themeClasses[colorKey] || themeClasses.emerald;

  const fontClass = templateConfig?.font_family || "font-solaiman";
  const arabicFont = templateConfig?.arabic_font || "font-amiri";
  const isLandscape = templateConfig?.orientation === "landscape";

  // Interpolate body content
  const bodyText = interpolateCertificateBody(
    certificate.additional_statement ||
      "এই মর্মে প্রত্যয়ন করা যাচ্ছে যে, {{student_name}}, পিতা: {{father_name}}, মাতা: {{mother_name}}, জামাত: {{class_name}}, রোল: {{roll}}, সেশন: {{session_name}}। আমাদের মাদরাসায় অবস্থানকালে তার চাল-চলন ও চরিত্র অত্যন্ত প্রশংসনীয় ছিল।",
    snapshot,
    certificate
  );

  const handlePrint = () => {
    const printableElement = document.getElementById("printable-official-certificate");
    if (!printableElement) {
      window.print();
      return;
    }

    // Remove any existing temp frame or style tag
    const existingFrame = document.getElementById("temp-print-frame");
    if (existingFrame) existingFrame.remove();

    const existingStyle = document.getElementById("temp-certificate-print-style");
    if (existingStyle) existingStyle.remove();

    // Inject dynamic @page print CSS rules for orientation and 1-page fit
    const style = document.createElement("style");
    style.id = "temp-certificate-print-style";
    style.innerHTML = `
      @media print {
        @page {
          size: A4 ${isLandscape ? "landscape" : "portrait"};
          margin: 0;
        }
        html, body {
          width: ${isLandscape ? "297mm" : "210mm"} !important;
          height: ${isLandscape ? "210mm" : "297mm"} !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          background: #ffffff !important;
        }
        #temp-print-frame {
          display: block !important;
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: ${isLandscape ? "297mm" : "210mm"} !important;
          height: ${isLandscape ? "210mm" : "297mm"} !important;
          max-width: ${isLandscape ? "297mm" : "210mm"} !important;
          max-height: ${isLandscape ? "210mm" : "297mm"} !important;
          margin: 0 auto !important;
          padding: ${isLandscape ? "5mm" : "8mm"} !important;
          box-sizing: border-box !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          page-break-after: avoid !important;
          break-after: avoid !important;
          background: #ffffff !important;
          z-index: 99999999 !important;
        }
        #temp-print-frame * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `;
    document.head.appendChild(style);

    // Clone element
    const clone = printableElement.cloneNode(true) as HTMLElement;
    clone.id = "temp-print-frame";
    clone.style.width = "100%";
    clone.style.height = "100%";
    clone.style.maxWidth = "100%";
    clone.style.maxHeight = "100%";
    clone.style.boxSizing = "border-box";

    document.body.appendChild(clone);
    document.body.classList.add("is-printing-now");

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove("is-printing-now");
        const temp = document.getElementById("temp-print-frame");
        if (temp) temp.remove();
        const tempStyle = document.getElementById("temp-certificate-print-style");
        if (tempStyle) tempStyle.remove();
      }, 500);
    }, 150);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/verify/certificate/${certificate.verification_token}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${certificate.certificate_type_title} - ${snapshot.student_name}`,
          text: `${snapshot.student_name}-এর অনলাইন সত্যায়িত সনদপত্র`,
          url: shareUrl,
        });
      } catch (err) {
        // user cancelled
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert("সনদ যাচাইয়ের কিউআর লিংক ক্লিপবোর্ডে কপি হয়েছে!");
    }
  };

  // QR verification URL
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    typeof window !== "undefined"
      ? `${window.location.origin}/verify/certificate/${certificate.verification_token}`
      : `/verify/certificate/${certificate.verification_token}`
  )}`;

  const isIssued = certificate.status === "ISSUED";
  const isRevoked = certificate.status === "REVOKED" || certificate.status === "VOIDED";

  return (
    <div className="space-y-4">
      {/* Actions toolbar */}
      {showActions && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900 text-white rounded-2xl print:hidden shadow-sm">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                isIssued ? "bg-emerald-500 text-white" : isRevoked ? "bg-rose-500 text-white" : "bg-amber-500 text-white"
              }`}
            >
              {certificate.status}
            </span>
            <span className="text-xs font-mono font-bold text-slate-300">{certificate.certificate_number}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>শেয়ার</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>প্রিন্ট / PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* Revoked watermark banner if revoked */}
      {isRevoked && (
        <div className="bg-rose-50 border-2 border-rose-300 p-3 rounded-2xl text-rose-900 flex items-center gap-3 text-xs font-bold print:border-rose-500">
          <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <span>⚠ সতর্কবার্তা: এই সনদটি বাতিল (REVOKED) করা হয়েছে!</span>
            {certificate.revoked_reason && (
              <p className="text-[11px] text-rose-700 font-normal mt-0.5">কারণ: {certificate.revoked_reason}</p>
            )}
          </div>
        </div>
      )}

      {/* Main Printable Certificate Canvas */}
      <div className="w-full overflow-x-auto flex justify-center py-2">
        <div
          ref={printRef}
          id="printable-official-certificate"
          className={`bg-white text-slate-900 mx-auto rounded-xl overflow-hidden print:p-0 print:border-none print:shadow-none shadow-lg border border-slate-200 ${fontClass}`}
          style={{
            width: isLandscape ? "297mm" : "210mm",
            maxWidth: "100%",
            minHeight: isLandscape ? "210mm" : "297mm",
            boxSizing: "border-box",
          }}
        >
        <div
          className={`p-8 sm:p-12 relative h-full flex flex-col justify-between border-[12px] border-double ${activeTheme.border} ${activeTheme.bg} transition-all`}
        >
          {/* Decorative Corner Ornaments */}
          <div className="absolute top-3 left-3 text-2xl opacity-20 pointer-events-none">📜</div>
          <div className="absolute top-3 right-3 text-2xl opacity-20 pointer-events-none">📜</div>
          <div className="absolute bottom-3 left-3 text-2xl opacity-20 pointer-events-none">📜</div>
          <div className="absolute bottom-3 right-3 text-2xl opacity-20 pointer-events-none">📜</div>

          {/* Header Section */}
          <div className="text-center space-y-2 relative z-10 border-b-2 border-slate-200/80 pb-6">
            <p className={`text-sm sm:text-base font-semibold text-slate-700 tracking-widest ${arabicFont}`}>
              {templateConfig?.bismillah_text || "بسم الله الرحمن الرحيم"}
            </p>

            <h1 className={`text-2xl sm:text-4xl font-black tracking-tight ${activeTheme.text}`}>
              {snapshot.madrasa_name}
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              {snapshot.madrasa_address} • ফোন: {snapshot.madrasa_phone || madrasaInfo?.phone || "—"}
            </p>

            {/* Certificate Title Badge */}
            <div className="pt-2">
              <div
                className={`inline-block px-8 py-2 rounded-full font-black text-sm sm:text-lg tracking-wide uppercase border-2 shadow-xs ${activeTheme.badge}`}
              >
                {certificate.certificate_type_title}
              </div>
            </div>
          </div>

          {/* Certificate Number & Dates Meta Bar */}
          <div className="flex flex-wrap justify-between items-center text-xs sm:text-sm font-bold text-slate-700 pt-4 px-2 gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="bg-white/80 px-3 py-1 rounded-lg border border-slate-200">
                <span>সনদ নম্বর: </span>
                <span className="font-mono text-slate-900">{certificate.certificate_number}</span>
              </div>

              {snapshot.student_id_code && (
                <div className="bg-white/80 px-3 py-1 rounded-lg border border-slate-200">
                  <span>আইডি নম্বর: </span>
                  <span className="font-mono text-slate-900">
                    {snapshot.student_id_code.replace(/^(QM-|CERT-|STU-|ID-)/i, "").trim() || snapshot.student_id_code}
                  </span>
                </div>
              )}
            </div>

            <div className="bg-white/80 px-3 py-1 rounded-lg border border-slate-200">
              <span>ইস্যুর তারিখ: </span>
              <span className="font-semibold text-slate-900">{certificate.issue_date}</span>
            </div>
          </div>

          {/* Main Body Statement */}
          <div className="py-6 sm:py-8 px-2 sm:px-6 space-y-4 text-justify text-sm sm:text-base leading-relaxed text-slate-800">
            <p className="indent-8 text-base sm:text-lg leading-loose font-medium">{bodyText}</p>

            {/* Specialized Details Card (for TC / Conduct / Marks) */}
            {(certificate.dues_status || certificate.conduct_grade || certificate.exam_result) && (
              <div className="bg-white/90 p-4 rounded-2xl border border-slate-200 text-xs sm:text-sm space-y-2 my-4 shadow-2xs">
                <p className="font-bold text-slate-900 border-b border-slate-100 pb-1">অফিশিয়াল মূল্যায়ন রেকর্ড:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-700">
                  {certificate.dues_status && (
                    <div>
                      <span className="text-slate-400 block text-[11px]">বকেয়া স্থিতি:</span>
                      <span className="font-bold text-emerald-700">
                        {certificate.dues_status === "CLEARED" ? "পরিশোধিত (Cleared)" : "বকেয়া রয়েছে"}
                      </span>
                    </div>
                  )}

                  {certificate.conduct_grade && (
                    <div>
                      <span className="text-slate-400 block text-[11px]">আচরণ মূল্যায়ন:</span>
                      <span className="font-bold text-slate-900">{certificate.conduct_grade}</span>
                    </div>
                  )}

                  {certificate.exam_result && (
                    <>
                      <div>
                        <span className="text-slate-400 block text-[11px]">জিপিএ/গ্রেড:</span>
                        <span className="font-bold text-blue-700">
                          {certificate.exam_result.grade || certificate.exam_result.gpa || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">মেধাস্থান:</span>
                        <span className="font-bold text-slate-900">{certificate.exam_result.position || "—"}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Signatures & QR Verification */}
          <div className="pt-8 border-t-2 border-slate-200/80 flex items-end justify-between px-2 sm:px-6">
            {/* Signature 1: Class Teacher */}
            {certificate.teacher_signature && (
              <div className="text-center space-y-1">
                <div className="w-32 border-b-2 border-slate-800 mx-auto pb-1" />
                <p className="text-xs sm:text-sm font-bold text-slate-900">শ্রেণি শিক্ষক</p>
                <p className="text-[10px] text-slate-500">মাদরাসা শিক্ষক প্যানেল</p>
              </div>
            )}

            {/* Center QR Code Verification */}
            <div className="text-center space-y-1">
              <div className="w-20 h-20 bg-white p-1 border border-slate-300 rounded-xl shadow-2xs mx-auto flex items-center justify-center">
                <img src={qrUrl} alt="QR Verification" className="w-full h-full object-contain" />
              </div>
              <p className="text-[9px] font-bold text-slate-600 tracking-wider uppercase">অনলাইন কিউআর যাচাই</p>
            </div>

            {/* Signature 2: Principal / Mohtamim */}
            {certificate.mohtamim_signature && (
              <div className="text-center space-y-1">
                <div className="w-36 border-b-2 border-slate-800 mx-auto pb-1" />
                <p className="text-xs sm:text-sm font-bold text-slate-900">
                  {snapshot.principal_name || "মুহতামিম / অধ্যক্ষ"}
                </p>
                <p className="text-[10px] text-slate-500">প্রধান নির্বাহক কার্যালয়</p>
              </div>
            )}
          </div>

          {/* Bottom Disclaimer */}
          <div className="text-center text-[10px] text-slate-400 pt-6">
            <p>
              এই সনদপত্রটি QawmiManager ডিজিটাল ম্যানেজমেন্ট সিস্টেম দ্বারা প্রস্তুতকৃত। অনলাইন ভেরিফিকেশনের জন্য কিউআর স্ক্যান করুন।
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}
