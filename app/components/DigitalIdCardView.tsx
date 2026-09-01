"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { StudentIDCard } from "@/lib/id-card-management";
import {
  IdCard,
  Share2,
  Printer,
  CheckCircle2,
  AlertOctagon,
  Copy,
  Check,
  Building2,
  Phone,
  MapPin,
  Calendar,
  Sparkles,
} from "lucide-react";

interface DigitalIdCardViewProps {
  card: StudentIDCard;
  madrasaInfo?: { name: string; address: string; phone: string };
  onPrint?: () => void;
  showActions?: boolean;
}

export default function DigitalIdCardView({
  card,
  madrasaInfo,
  onPrint,
  showActions = true,
}: DigitalIdCardViewProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [activeSide, setActiveSide] = useState<"front" | "back">("front");

  useEffect(() => {
    if (card?.verification_id) {
      const origin = typeof window !== "undefined" ? window.location.origin : "https://qawmierp.app";
      const verifyUrl = `${origin}/verify/${card.verification_id}`;
      QRCode.toDataURL(verifyUrl, { width: 220, margin: 1, color: { dark: "#0f172a", light: "#ffffff" } })
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

  const isStatusActive = card.status === "ACTIVE";

  return (
    <div className="space-y-4 max-w-sm mx-auto">
      {/* Side Toggle & Status Bar */}
      <div className="flex items-center justify-between bg-slate-900 text-white p-2.5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 pl-1">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase ${
              isStatusActive ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
            }`}
          >
            {isStatusActive ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>● Active</span>
              </>
            ) : (
              <>
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>● {card.status}</span>
              </>
            )}
          </span>
        </div>

        <div className="flex bg-slate-800 p-1 rounded-xl text-xs font-bold border border-slate-700">
          <button
            type="button"
            onClick={() => setActiveSide("front")}
            className={`px-3 py-1 rounded-lg transition ${
              activeSide === "front" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
            }`}
          >
            সামনে (Front)
          </button>
          <button
            type="button"
            onClick={() => setActiveSide("back")}
            className={`px-3 py-1 rounded-lg transition ${
              activeSide === "back" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
            }`}
          >
            পিছনে (Back)
          </button>
        </div>
      </div>

      {/* Card UI Wrapper */}
      <div className="relative mx-auto bg-white rounded-2xl shadow-lg border border-slate-300 overflow-hidden w-[2.25in] sm:w-[2.5in] h-[3.6in] sm:h-[4in] transition-all transform hover:scale-[1.01]">
        {activeSide === "front" ? (
          /* FRONT SIDE */
          <div className="w-full h-full flex flex-col justify-between bg-white text-slate-800">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-2.5 text-center flex flex-col items-center justify-center shrink-0">
              <h3 className="font-bold text-[11px] sm:text-xs leading-tight line-clamp-1">
                {madrasaInfo?.name || "QawmiERP Digital Identity"}
              </h3>
              <p className="text-[8px] opacity-80 mt-0.5 line-clamp-1">{madrasaInfo?.address || "ঢাকা, বাংলাদেশ"}</p>
              <div className="mt-1 px-2 py-0.5 bg-white/10 backdrop-blur-md rounded-full text-[7px] font-black tracking-widest uppercase">
                STUDENT ID CARD
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col items-center px-3 pt-6 relative">
              {/* Photo */}
              <div className="absolute -top-5 w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-white bg-slate-100 shadow-md flex items-center justify-center overflow-hidden shrink-0">
                {card.snapshot.photo_url || card.photo_url ? (
                  <img
                    src={card.snapshot.photo_url || card.photo_url}
                    alt={card.snapshot.student_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <IdCard className="w-7 h-7 text-slate-400" />
                )}
              </div>

              <h4 className="font-black text-slate-900 mt-2 text-center text-xs sm:text-sm line-clamp-1">
                {card.snapshot.student_name}
              </h4>

              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-mono font-bold text-[9px] mt-0.5 border border-blue-200">
                {card.card_number}
              </span>

              {/* Fields */}
              <div className="w-full mt-2 space-y-1 text-[9px] sm:text-[10px]">
                <div className="flex justify-between border-b border-slate-100 pb-0.5">
                  <span className="text-slate-500 font-medium">জামাত:</span>
                  <span className="font-bold text-slate-800 line-clamp-1">{card.snapshot.class_name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-0.5">
                  <span className="text-slate-500 font-medium">রোল নম্বর:</span>
                  <span className="font-bold text-slate-800">{card.snapshot.roll_number}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-0.5">
                  <span className="text-slate-500 font-medium">শিক্ষাবর্ষ:</span>
                  <span className="font-bold text-slate-800">{card.snapshot.session_name}</span>
                </div>
                <div className="flex justify-between pb-0.5">
                  <span className="text-slate-500 font-medium">রক্তের গ্রুপ:</span>
                  <span className="font-bold text-red-600">{card.snapshot.blood_group}</span>
                </div>
              </div>

              {/* QR Code */}
              <div className="mt-auto mb-1 flex flex-col items-center">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code" className="w-12 h-12 border border-slate-200 rounded p-0.5 bg-white" />
                ) : (
                  <div className="w-12 h-12 bg-slate-100 rounded animate-pulse" />
                )}
                <span className="text-[6px] text-slate-400 font-mono mt-0.5">Scan to Verify</span>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-900 text-white text-[8px] py-1 text-center font-bold tracking-wider">
              AUTHORITY SIGNATURE
            </div>
          </div>
        ) : (
          /* BACK SIDE */
          <div className="w-full h-full flex flex-col justify-between bg-white text-slate-800 p-3">
            <div>
              <div className="text-center border-b border-slate-200 pb-1.5 mb-2">
                <h4 className="font-bold text-[10px] text-slate-900">জরুরী যোগাযোগ ও নির্দেশনাবলী</h4>
              </div>

              <div className="space-y-1 text-[8px] text-slate-600">
                <p>• কার্ডটি সর্বদা সাথে রাখা আবশ্যক।</p>
                <p>• হারিয়ে গেলে অবিলম্বে অফিসকে জানান।</p>
                <p>• এই কার্ডটি হস্তান্তরযোগ্য নয়।</p>
              </div>

              <div className="mt-3 p-2 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-[8.5px]">
                <p><strong>পিতা:</strong> {card.snapshot.father_name}</p>
                <p><strong>ফোন:</strong> {card.snapshot.parent_phone}</p>
                <p><strong>ঠিকানা:</strong> {card.snapshot.address}</p>
              </div>
            </div>

            <div className="text-center space-y-1 border-t border-slate-200 pt-2 text-[8px] text-slate-500">
              <p className="font-bold text-slate-800">{madrasaInfo?.name}</p>
              <p className="line-clamp-1">{madrasaInfo?.address}</p>
              <p>ফোন: {madrasaInfo?.phone}</p>
              <p className="text-[7px] text-slate-400 pt-1">ইস্যু: {card.issue_date} • মেয়াদ: {card.expiry_date}</p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={handleShare}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-200" />
                <span>লিংক কপি হয়েছে!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>ডিজিটাল আইডি শেয়ার করুন</span>
              </>
            )}
          </button>

          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>আইডি কার্ড প্রিন্ট / PDF সংরক্ষণ</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
