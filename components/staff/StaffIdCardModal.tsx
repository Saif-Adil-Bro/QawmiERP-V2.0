"use client";

import React, { useRef, useState, useEffect } from "react";
import { StaffMember } from "@/lib/staff-management";
import { Printer, Download, QrCode, ShieldCheck, X, Building2, Phone, Mail, UserCheck } from "lucide-react";
import QRCode from "qrcode";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface StaffIdCardModalProps {
  staff: StaffMember;
  madrasaName?: string;
  madrasaPhone?: string;
  madrasaAddress?: string;
  onClose: () => void;
}

export default function StaffIdCardModal({
  staff,
  madrasaName = "দারুল উলুম কওমিয়া মাদ্রাসা",
  madrasaPhone = "০১৮১২৩৪৫৬৭৮",
  madrasaAddress = "মাদ্রাসা রোড, সদর, বাংলাদেশ",
  onClose,
}: StaffIdCardModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const verificationUrl = typeof window !== "undefined"
    ? `${window.location.origin}/verify-staff/${staff.id_card?.verification_token || staff.id}`
    : `https://qawmimanager.com/verify-staff/${staff.id_card?.verification_token || staff.id}`;

  useEffect(() => {
    QRCode.toDataURL(verificationUrl, { width: 120, margin: 1 })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("Error generating QR code:", err));
  }, [verificationUrl]);

  const handlePrint = () => {
    window.print();
  };

  const isRevoked = staff.id_card?.is_revoked || staff.employment.status === "TERMINATED";
  const isInactive = staff.employment.status === "INACTIVE" || staff.employment.status === "RESIGNED";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                ডিজিটাল স্টাফ আইডি কার্ড (Staff ID Card)
              </h3>
              <p className="text-xs text-slate-500">
                {staff.personal.first_name} {staff.personal.last_name} • {staff.staff_id_code}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>প্রিন্ট / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: ID Card Display */}
        <div className="p-6 bg-slate-100 flex flex-col items-center justify-center gap-6" ref={cardRef}>
          {/* Status Alert if not active */}
          {isRevoked && (
            <div className="w-full max-w-lg bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2 rounded-xl text-xs flex items-center gap-2 font-medium">
              <span className="font-bold">সতর্কবার্তা:</span> এই আইডি কার্ডটি বাতিল/অব্যাহতিপ্রাপ্ত (REVOKED)।
            </div>
          )}
          {isInactive && !isRevoked && (
            <div className="w-full max-w-lg bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-xl text-xs flex items-center gap-2 font-medium">
              <span className="font-bold">সতর্কবার্তা:</span> এই কর্মীর স্ট্যাটাস বর্তমানে নিষ্ক্রিয়/ইস্তফাপ্রাপ্ত।
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-xl">
            {/* FRONT OF CARD */}
            <div className="w-full bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col relative aspect-[54/86] sm:aspect-auto sm:h-[380px]">
              {/* Card Header */}
              <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white p-3.5 text-center relative">
                <div className="text-[10px] font-medium tracking-widest text-emerald-200 uppercase">
                  STAFF IDENTITY CARD
                </div>
                <h4 className="text-xs sm:text-sm font-bold leading-tight line-clamp-1 mt-0.5">
                  {madrasaName}
                </h4>
                <div className="text-[9px] text-emerald-100 mt-0.5 opacity-90">
                  কর্মচারী ও শিক্ষক পরিচিতিপত্র
                </div>
                <div className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col items-center justify-between text-center bg-gradient-to-b from-white to-slate-50">
                {/* Photo */}
                <div className="relative mt-1">
                  <div className="w-20 h-20 rounded-full border-2 border-emerald-600 shadow-md overflow-hidden bg-emerald-50 flex items-center justify-center text-emerald-700 text-xl font-bold">
                    {staff.personal.photo_url ? (
                      <img
                        src={staff.personal.photo_url}
                        alt={staff.personal.first_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{staff.personal.first_name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-emerald-700 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-xs whitespace-nowrap">
                    {staff.employment.category_name?.split("(")[0] || "স্টাফ"}
                  </div>
                </div>

                {/* Name & Designation */}
                <div className="mt-2 space-y-0.5">
                  <h5 className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
                    {staff.personal.full_name_bn || `${staff.personal.first_name} ${staff.personal.last_name}`}
                  </h5>
                  <p className="text-xs font-semibold text-emerald-800">
                    {staff.employment.designation}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {staff.employment.department_name}
                  </p>
                </div>

                {/* Staff ID & Blood Group */}
                <div className="w-full bg-slate-100/90 rounded-xl p-2 border border-slate-200/80 grid grid-cols-2 gap-1 text-[11px] mt-2">
                  <div>
                    <span className="text-slate-400 block text-[9px]">স্টাফ আইডি:</span>
                    <span className="font-mono font-bold text-slate-800">{staff.staff_id_code}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">রক্তের গ্রুপ:</span>
                    <span className="font-bold text-rose-600">{staff.personal.blood_group || "অজানা"}</span>
                  </div>
                </div>

                {/* Bottom Card Footer */}
                <div className="w-full flex items-center justify-between border-t border-slate-200 pt-2 text-[9px] text-slate-400 mt-1">
                  <span>ইস্যু: {staff.id_card?.issue_date ? toBanglaNumber(staff.id_card.issue_date) : "-"}</span>
                  <div className="text-center">
                    <div className="w-12 border-b border-slate-400 mb-0.5" />
                    <span>কর্তৃপক্ষের স্বাক্ষর</span>
                  </div>
                </div>
              </div>
            </div>

            {/* BACK OF CARD */}
            <div className="w-full bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col justify-between p-4 bg-gradient-to-b from-slate-50 to-white aspect-[54/86] sm:aspect-auto sm:h-[380px]">
              <div>
                <div className="text-center border-b border-slate-200 pb-2 mb-3">
                  <h6 className="text-xs font-bold text-slate-800">জরুরি যোগাযোগ ও নির্দেশিকা</h6>
                  <p className="text-[10px] text-slate-500">এই কার্ডটি মাদ্রাসার সম্পত্তি। পাওয়া গেলে ফেরত দিন।</p>
                </div>

                <div className="space-y-2 text-[11px] text-slate-700">
                  <div className="flex items-start gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium text-slate-500 text-[10px] block">ফোন নম্বর:</span>
                      <span className="font-bold text-slate-800">{staff.contact.phone || "-"}</span>
                    </div>
                  </div>

                  {staff.contact.emergency_contact_phone && (
                    <div className="flex items-start gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-slate-500 text-[10px] block">
                          জরুরি যোগাযোগ ({staff.contact.emergency_contact_relation || "অভিভাবক"}):
                        </span>
                        <span className="font-bold text-slate-800">{staff.contact.emergency_contact_phone}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium text-slate-500 text-[10px] block">মাদ্রাসা ঠিকানা:</span>
                      <span className="text-slate-700 text-[10px] leading-tight block">{madrasaAddress}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* QR Code Verification Section */}
              <div className="border-t border-slate-200 pt-2 flex items-center justify-between gap-3">
                <div className="text-left">
                  <div className="text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ভেরিফাইড ডিজিটাল আইডি</span>
                  </div>
                  <p className="text-[9px] text-slate-500 mt-0.5">
                    স্টাফের সত্যতা যাচাই করতে যেকোনো কিউআর স্ক্যানার ব্যবহার করুন।
                  </p>
                  <p className="font-mono text-[8px] text-slate-400 mt-1">
                    {staff.id_card?.verification_token?.substring(0, 16)}...
                  </p>
                </div>

                <div className="p-1.5 bg-white rounded-xl border border-slate-200 shadow-xs shrink-0 flex items-center justify-center min-w-16 min-h-16">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR Code" className="w-16 h-16" />
                  ) : (
                    <div className="w-16 h-16 bg-slate-100 animate-pulse rounded-lg" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div>
            কার্ড স্ট্যাটাস:{" "}
            <span className={`font-bold ${isRevoked ? "text-rose-600" : isInactive ? "text-amber-600" : "text-emerald-600"}`}>
              {isRevoked ? "বাতিল (REVOKED)" : isInactive ? "নিষ্ক্রিয় (INACTIVE)" : "সক্রিয় ও বৈধ (VALID)"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl transition cursor-pointer"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
