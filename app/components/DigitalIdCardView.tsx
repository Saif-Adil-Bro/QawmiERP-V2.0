"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { StudentIDCard } from "@/lib/id-card-management";
import StudentIdCardTemplate, { IDCardTemplateType } from "@/app/components/StudentIdCardTemplate";
import {
  IdCard,
  Share2,
  Printer,
  AlertOctagon,
  Check,
  ShieldCheck,
  Layers,
} from "lucide-react";

interface DigitalIdCardViewProps {
  card: StudentIDCard;
  madrasaInfo?: {
    name?: string;
    address?: string;
    phone?: string;
    logo_url?: string;
    website?: string;
  };
  onPrint?: () => void;
  showActions?: boolean;
  initialTemplate?: IDCardTemplateType;
  themeColor?: string;
  madrasaNameSize?: string;
  customExpiryDate?: string;
}

export default function DigitalIdCardView({
  card,
  madrasaInfo,
  onPrint,
  showActions = true,
  initialTemplate = "classic_islamic",
  themeColor,
  madrasaNameSize,
  customExpiryDate,
}: DigitalIdCardViewProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [activeSide, setActiveSide] = useState<"front" | "back">("front");
  const [selectedTemplate, setSelectedTemplate] = useState<IDCardTemplateType>(
    (card.template_id as IDCardTemplateType) || initialTemplate || "classic_islamic"
  );
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    if (card?.verification_id) {
      const origin = typeof window !== "undefined" ? window.location.origin : "https://qawmierp.app";
      const verifyUrl = `${origin}/verify/${card.verification_id}`;
      QRCode.toDataURL(verifyUrl, {
        width: 260,
        margin: 1,
        color: { dark: "#064e3b", light: "#ffffff" },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error("QR Code Error:", err));
    }
  }, [card?.verification_id]);

  const handleShare = async () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://qawmierp.app";
    const shareUrl = `${origin}/verify/${card.verification_id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${card.snapshot.student_name} - Digital Student ID`,
          text: `শিক্ষার্থী: ${card.snapshot.student_name}, আইডি: ${card.card_number}, মাদরাসা: ${madrasaInfo?.name || "QawmiERP"}`,
          url: shareUrl,
        });
      } catch {}
    } else {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleToggleSide = (side: "front" | "back") => {
    if (activeSide === side) return;
    setIsFlipping(true);
    setTimeout(() => {
      setActiveSide(side);
      setIsFlipping(false);
    }, 150);
  };

  const handleSingleCardPrint = () => {
    if (onPrint) {
      onPrint();
      return;
    }

    const printableElement = document.getElementById("printable-single-card-sheet");
    if (!printableElement) {
      window.print();
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
      }, 500);
    }, 150);
  };

  const isStatusActive = card.status === "ACTIVE";

  return (
    <div className="space-y-4 max-w-sm mx-auto">
      {/* Top Controls Header */}
      <div className="bg-slate-900 text-white p-2.5 rounded-2xl shadow-sm space-y-2 border border-slate-800 print:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                isStatusActive
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
              }`}
            >
              {isStatusActive ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>● ACTIVE</span>
                </>
              ) : (
                <>
                  <AlertOctagon className="w-3 h-3" />
                  <span>● {card.status}</span>
                </>
              )}
            </span>
          </div>

          {/* Front / Back Toggle Buttons */}
          <div className="flex bg-slate-800 p-1 rounded-xl text-xs font-bold border border-slate-700">
            <button
              type="button"
              onClick={() => handleToggleSide("front")}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                activeSide === "front" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
              }`}
            >
              সামনে (Front)
            </button>
            <button
              type="button"
              onClick={() => handleToggleSide("back")}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                activeSide === "back" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
              }`}
            >
              পিছনে (Back)
            </button>
          </div>
        </div>

        {/* Template Selector Bar */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px] text-slate-400">
          <span className="flex items-center gap-1 font-semibold text-slate-300">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>ডিজাইন টেমপ্লেট:</span>
          </span>

          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value as IDCardTemplateType)}
            className="bg-slate-800 text-white text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="classic_islamic">ক্লাসিক ইসলামিক (Classic)</option>
            <option value="modern_minimal">মডার্ন মিনিমাল (Minimal)</option>
            <option value="premium_madrasa">প্রিমিয়াম মাদরাসা (Premium)</option>
          </select>
        </div>
      </div>

      {/* Card Preview Stage (Scaled Proportionally & Animated Flip) */}
      <div className="flex justify-center py-2 relative print:hidden">
        <div
          className={`transition-all duration-300 transform ${
            isFlipping ? "scale-95 opacity-50 rotate-y-90" : "scale-100 opacity-100 rotate-y-0"
          }`}
          style={{
            transformStyle: "preserve-3d",
            perspective: "1000px",
          }}
        >
          {/* Real Physical Proportions ID Card Render */}
          <div className="shadow-2xl rounded-[16px]">
            <StudentIdCardTemplate
              card={card}
              side={activeSide}
              templateId={selectedTemplate}
              themeColor={themeColor}
              madrasaNameSize={madrasaNameSize}
              customExpiryDate={customExpiryDate}
              madrasaInfo={madrasaInfo}
              qrDataUrl={qrDataUrl}
              scale={1.25}
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {showActions && (
        <div className="flex flex-col gap-2 pt-2 print:hidden">
          <button
            type="button"
            onClick={handleShare}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-200" />
                <span>যাচাইকরণ লিংক কপি হয়েছে!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>ডিজিটাল আইডি শেয়ার করুন</span>
              </>
            )}
          </button>

          <div className="grid grid-cols-2 gap-2">
            {card.verification_id && (
              <a
                href={`/verify/${card.verification_id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2 rounded-xl text-xs transition border border-slate-200"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>অনলাইন যাচাই</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleSingleCardPrint}
              className="flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold py-2 rounded-xl text-xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>প্রিন্ট / PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* Hidden Single Card Printable Element */}
      <div id="printable-single-card-sheet" className="hidden">
        <div className="p-8 flex flex-col items-center justify-center min-h-screen bg-white">
          <div className="text-center mb-4">
            <h2 className="font-bold text-base text-slate-900">{madrasaInfo?.name || "মাদরাসা আইডি কার্ড"}</h2>
            <p className="text-xs text-slate-600">শিক্ষার্থী: {card.snapshot?.student_name} • আইডি: {card.card_number}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="border border-dashed border-slate-300 p-1 rounded-xl inline-block bg-white shadow-2xs">
              <StudentIdCardTemplate
                card={card}
                side="front"
                templateId={selectedTemplate}
                themeColor={themeColor}
                madrasaNameSize={madrasaNameSize}
                customExpiryDate={customExpiryDate}
                madrasaInfo={madrasaInfo}
                qrDataUrl={qrDataUrl}
              />
              <p className="text-[10px] text-slate-400 text-center font-bold mt-1">সামনের দিক (FRONT)</p>
            </div>
            <div className="border border-dashed border-slate-300 p-1 rounded-xl inline-block bg-white shadow-2xs">
              <StudentIdCardTemplate
                card={card}
                side="back"
                templateId={selectedTemplate}
                themeColor={themeColor}
                madrasaNameSize={madrasaNameSize}
                customExpiryDate={customExpiryDate}
                madrasaInfo={madrasaInfo}
                qrDataUrl={qrDataUrl}
              />
              <p className="text-[10px] text-slate-400 text-center font-bold mt-1">পিছনের দিক (BACK)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
