"use client";

import React, { useState, useEffect } from "react";
import { StaffMember } from "@/lib/staff-management";
import { 
  Printer, X, FileText, Award, CheckCircle2, Building2, 
  ShieldCheck, Edit3, RotateCcw, Sparkles, Check, ChevronDown, Eye 
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";

export type CertificateLetterType = "APPOINTMENT" | "SERVICE" | "EXPERIENCE" | "RELIEVING";

interface StaffCertificateGeneratorModalProps {
  staff: StaffMember;
  madrasaInfo?: any;
  madrasaName?: string;
  madrasaPhone?: string;
  madrasaAddress?: string;
  onClose: () => void;
}

function getDefaultBodyText(type: CertificateLetterType, staff: StaffMember): string {
  const name = staff.personal.full_name_bn || `${staff.personal.first_name} ${staff.personal.last_name}`.trim();
  const father = staff.personal.father_name || "—";
  const address = staff.contact.present_address || "—";
  const designation = staff.employment.designation || "সহকারী শিক্ষক (মুদাররিস)";
  const dept = staff.employment.department_name || "একাডেমিক ও পাঠদান বিভাগ";
  const joinDate = toBanglaNumber(staff.employment.joining_date || new Date().toISOString().split("T")[0]);
  const basicSalary = toBanglaNumber((staff.salary.basic_salary || 0).toString());
  const netSalary = toBanglaNumber((staff.salary.net_salary || 0).toString());
  const staffCode = staff.staff_id_code || "";

  switch (type) {
    case "APPOINTMENT":
      return `মুহতারাম,
আপনার অবগতির জন্য জানানো যাচ্ছে যে, মাদ্রাসা পরিচালনা পর্ষদের সিদ্ধান্ত মোতাবেক আপনাকে অত্র মাদ্রাসার ${dept}-এর অধীনে ${designation} পদে ${joinDate} তারিখ হতে নিয়োগ প্রদান করা হলো।

আপনার মাসিক মূল বেতন ৳${basicSalary}/- এবং সর্বমোট প্রদেয় বেতন ও ভাতাদি ৳${netSalary}/- ধার্য করা হলো।

আশা করা যায় আপনি মাদ্রাসার যাবতীয় নিয়মনীতি, শিষ্টাচার ও দ্বীনি শৃঙ্খলা রক্ষা করে নিষ্ঠার সাথে আপনার অর্পিত দায়িত্ব পালন করবেন।`;

    case "SERVICE":
      return `এই মর্মে প্রত্যয়ন করা যাচ্ছে যে, জনাব ${name}, পিতার নাম: ${father}, গ্রাম/ঠিকানা: ${address}, অত্র মাদ্রাসায় ${joinDate} তারিখ হতে অদ্যাবধি ${dept}-এ ${designation} পদে অত্যন্ত বিশ্বস্ততা ও নিষ্ঠার সাথে দায়িত্ব পালন করে আসছেন।

তার স্টাফ পরিচিতি নম্বর: ${staffCode}। অত্র প্রতিষ্ঠানে দায়িত্ব পালনকালে তিনি সৎ, কর্মঠ, চরিত্রবান এবং দ্বীনি তাহযিব-তামাদ্দুনের প্রতি শ্রদ্ধাশীল হিসেবে পরিচিত।

মাদ্রাসা বা রাষ্ট্রের শৃঙ্খলা পরিপন্থী কোনো কার্যকলাপে তার সম্পৃক্ততা পাওয়া যায়নি। আমি তার সার্বিক কল্যাণ এবং দ্বীনি ও পার্থিব জীবনের উত্তরোত্তর সাফল্য কামনা করি।`;

    case "EXPERIENCE":
      return `এই মর্মে অভিজ্ঞতা সনদ প্রদান করা যাচ্ছে যে, জনাব ${name}, পিতা: ${father}, গ্রাম/ঠিকানা: ${address}, অত্র মাদ্রাসায় ${joinDate} হতে সুনামের সাথে ${designation} হিসেবে শিক্ষকতা/সেবামূলক দায়িত্ব পালন করেছেন।

তার শিক্ষাদান পদ্ধতি, কর্মদক্ষতা ও ছাত্রদের প্রতি পিতৃসুলভ স্নেহশীল আচরণ প্রশংসনীয় ছিল। তিনি একজন দায়িত্বশীল ও সময়নিষ্ঠ কর্মী।

ভবিষ্যৎ কর্মজীবনে তার উত্তরোত্তর সফলতা ও উজ্জ্বল ভবিষ্যৎ কামনা করছি।`;

    case "RELIEVING":
      return `অত্র সনদ দ্বারা নিশ্চিত করা যাচ্ছে যে, জনাব ${name} (স্টাফ আইডি: ${staffCode}), পদবী: ${designation}, অত্র প্রতিষ্ঠানে সন্তোষজনকভাবে দায়িত্ব পালন শেষে ব্যক্তিগত কারণে অব্যাহতি/ছাড়পত্রের আবেদন করেন, যা পরিচালনা পর্ষদ কর্তৃক অনুমোদিত হয়েছে।

অত্র মাদ্রাসার পক্ষ থেকে তার নিকট কোনো প্রকার আর্থিক দায়দেনা, কুতুবখানার কিতাবপত্র বা অফিসিয়াল সরঞ্জামাদি পাওনা নেই। তিনি মাদ্রাসার সমস্ত দায় হতে সম্পূর্ণ মুক্ত।

আমরা তার ভবিষ্যৎ জীবনের অব্যাহত সার্বিক শান্তি, বরকত ও সমৃদ্ধি কামনা করি।`;
  }
}

export default function StaffCertificateGeneratorModal({
  staff,
  madrasaInfo,
  madrasaName: fallbackMadrasaName = "মাদরাসা",
  madrasaPhone: fallbackMadrasaPhone = "",
  madrasaAddress: fallbackMadrasaAddress = "",
  onClose,
}: StaffCertificateGeneratorModalProps) {
  const [selectedType, setSelectedType] = useState<CertificateLetterType>("APPOINTMENT");
  const [customSubject, setCustomSubject] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [referenceNo, setReferenceNo] = useState(
    `QM/DOC/${new Date().getFullYear()}/${(staff.staff_id_code || "0001").replace(/[^0-9]/g, "").slice(-4) || "0001"}`
  );
  const [remarks, setRemarks] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);

  // Dynamic Editable Body State
  const [editableBody, setEditableBody] = useState<string>("");
  const [isEditMode, setIsEditMode] = useState(false);

  // Initialize and reset body text when type or staff changes
  useEffect(() => {
    const defaultText = getDefaultBodyText(selectedType, staff);
    setEditableBody(defaultText);
    if (selectedType === "APPOINTMENT") {
      setCustomSubject(`বিষয়: ${staff.employment.designation || "শিক্ষক"} পদে নিয়োগ প্রদান প্রসঙ্গে।`);
    } else if (selectedType === "SERVICE") {
      setCustomSubject("বিষয়: চাকরির প্রত্যয়নপত্র প্রদান প্রসঙ্গে।");
    } else if (selectedType === "EXPERIENCE") {
      setCustomSubject("বিষয়: অভিজ্ঞতা সনদপত্র প্রদান প্রসঙ্গে।");
    } else if (selectedType === "RELIEVING") {
      setCustomSubject("বিষয়: ছাড়পত্র ও দায়মুক্তি সনদ প্রদান প্রসঙ্গে।");
    }
  }, [selectedType, staff]);

  // Consolidated Dynamic Madrasa Info
  const mName = madrasaInfo?.name || fallbackMadrasaName;
  const mPhone = madrasaInfo?.phone || fallbackMadrasaPhone;
  const mAddress = madrasaInfo?.address || fallbackMadrasaAddress;
  const mEmail = madrasaInfo?.email || "";
  const mLogo = madrasaInfo?.logo_url || "";
  const mSignature = madrasaInfo?.signature_url || madrasaInfo?.principal_signature_url || "";
  const mPrincipalName = madrasaInfo?.principal_name || "মুহতামিম / মহাপরিচালক";
  const mRegNo = madrasaInfo?.registration_no || madrasaInfo?.reg_no || "";

  const handlePrint = () => {
    setIsPrinting(true);
    const printableElement = document.getElementById("staff-certificate-printable-area");
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

  const getTemplateTitle = () => {
    switch (selectedType) {
      case "APPOINTMENT":
        return "নিয়োগপত্র (Appointment Letter)";
      case "SERVICE":
        return "চাকরির প্রত্যয়নপত্র (Service Certificate)";
      case "EXPERIENCE":
        return "অভিজ্ঞতা সনদপত্র (Experience Certificate)";
      case "RELIEVING":
        return "ছাড়পত্র ও দায়মুক্তিপত্র (Relieving Letter)";
    }
  };

  const renderCertificateContent = (isInsidePreviewContainer: boolean = false) => (
    <div 
      className={`w-full bg-white text-slate-900 flex flex-col justify-between font-sans print-clean print-strict-light force-light-mode is-printable-doc ${
        isInsidePreviewContainer ? "p-0 border-0 shadow-none" : "p-0 border-0 shadow-none"
      }`} 
      style={{ backgroundColor: "#ffffff", color: "#0f172a", colorScheme: "light", border: "none", boxShadow: "none" }}
    >
      {/* Document Header */}
      <div>
        <div className="text-center border-b-2 border-slate-900 pb-4 mb-5 space-y-1">
          <div className="text-emerald-900 text-xs font-bold tracking-widest uppercase mb-1 font-serif">
            بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ
          </div>
          <div className="flex items-center justify-center gap-3">
            {mLogo && (
              <img
                src={mLogo}
                alt="Madrasa Logo"
                className="w-12 h-12 object-cover rounded-full border border-slate-300"
              />
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
                {mName}
              </h1>
              <p className="text-xs text-slate-600 mt-0.5 font-medium">
                {mAddress}
                {mPhone && ` • ফোন: ${toBanglaNumber(mPhone)}`}
                {mEmail && ` • ইমেইল: ${mEmail}`}
                {mRegNo && ` • রেজি: ${mRegNo}`}
              </p>
            </div>
          </div>
        </div>

        {/* Ref & Date */}
        <div className="flex justify-between items-center text-xs text-slate-600 mb-6 border-b border-slate-200 pb-2">
          <div>
            <span className="font-semibold text-slate-700">স্মারক নং: </span>
            <span className="font-mono font-bold text-slate-900">{referenceNo}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-700">তারিখ: </span>
            <span className="font-bold text-slate-800">{toBanglaNumber(issueDate)} খ্রিস্টাব্দ</span>
          </div>
        </div>

        {/* Title Badge */}
        <div className="text-center my-5">
          <span className="inline-block px-6 py-1.5 border-2 border-slate-900 text-slate-950 font-bold text-base sm:text-lg rounded-sm uppercase tracking-wide bg-slate-50">
            {selectedType === "APPOINTMENT" && "নিয়োগপত্র"}
            {selectedType === "SERVICE" && "চাকরির প্রত্যয়নপত্র"}
            {selectedType === "EXPERIENCE" && "অভিজ্ঞতা সনদপত্র"}
            {selectedType === "RELIEVING" && "ছাড়পত্র ও দায়মুক্তি সনদ"}
          </span>
        </div>

        {/* Recipient & Subject Header (for Appointment Letter) */}
        {selectedType === "APPOINTMENT" && (
          <div className="text-sm leading-normal text-slate-800 mb-4 space-y-1">
            <p className="leading-relaxed">
              বরাবর,<br />
              <strong className="text-slate-950">{staff.personal.full_name_bn || `${staff.personal.first_name} ${staff.personal.last_name}`}</strong><br />
              পিতার নাম: {staff.personal.father_name || "—"}<br />
              গ্রাম/ঠিকানা: {staff.contact.present_address || "—"}
            </p>
            <p className="font-bold text-slate-950 pt-1">
              {customSubject}
            </p>
          </div>
        )}

        {/* Recipient for other certificates if customSubject is set */}
        {selectedType !== "APPOINTMENT" && customSubject && (
          <div className="text-sm font-bold text-slate-950 mb-4">
            {customSubject}
          </div>
        )}

        {/* Main Letter Body (Dynamic Text with Line Breaks Preserved) */}
        <div className="text-sm leading-relaxed text-slate-800 space-y-3.5 text-justify whitespace-pre-line font-normal">
          {editableBody}
          
          {remarks && (
            <p className="bg-slate-50 p-2.5 border-l-2 border-emerald-700 italic text-slate-700 text-xs mt-3">
              বিশেষ মন্তব্য: {remarks}
            </p>
          )}
        </div>
      </div>

      {/* Document Signatures (Symmetrically Aligned on the exact same baseline) */}
      <div className="pt-14 sm:pt-16 grid grid-cols-2 gap-8 text-center text-xs items-end">
        {/* Left Signature: Nazeme Talimat */}
        <div className="flex flex-col items-center justify-end">
          <div className="h-12 flex items-end justify-center pb-1">
            {/* Empty signature space to match principal signature height */}
          </div>
          <div className="w-44 border-b border-slate-800 mb-1.5" />
          <p className="font-bold text-slate-900 text-xs">নাজেমে তালিমাত / দপ্তর সম্পাদক</p>
          <p className="text-[11px] text-slate-600 mt-0.5">{mName}</p>
        </div>

        {/* Right Signature: Muhtamim */}
        <div className="flex flex-col items-center justify-end">
          <div className="h-12 flex items-end justify-center pb-1">
            {mSignature ? (
              <img
                src={mSignature}
                alt="Signature"
                className="h-11 max-w-[150px] object-contain"
              />
            ) : null}
          </div>
          <div className="w-44 border-b border-slate-800 mb-1.5" />
          <p className="font-bold text-slate-900 text-xs">{mPrincipalName}</p>
          <p className="text-[11px] text-slate-600 mt-0.5">{mName}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-100 overflow-hidden my-auto flex flex-col max-h-[94vh] animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                অফিসিয়াল ডকুমেন্ট ও নিয়োগপত্র জেনারেটর
              </h3>
              <p className="text-xs text-slate-500">
                {staff.personal.first_name} {staff.personal.last_name} • {staff.employment.designation}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                isEditMode
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                  : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
              }`}
              title="মূল লেখা সম্পাদনা বা কাস্টমাইজ করুন"
            >
              <Edit3 className="w-4 h-4" />
              <span>{isEditMode ? "প্রিভিউ দেখুন" : "লেখা এডিট করুন"}</span>
            </button>

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

        {/* Toolbar Controls */}
        <div className="p-4 bg-slate-50/90 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">ডকুমেন্টের ধরন:</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as CertificateLetterType)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2 text-slate-800 font-bold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            >
              <option value="APPOINTMENT">নিয়োগপত্র (Appointment Letter)</option>
              <option value="SERVICE">চাকরির প্রত্যয়নপত্র (Service Certificate)</option>
              <option value="EXPERIENCE">অভিজ্ঞতা সনদপত্র (Experience Certificate)</option>
              <option value="RELIEVING">ছাড়পত্র ও দায়মুক্তিপত্র (Relieving Letter)</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">স্মারক নং / রেফারেন্স:</label>
            <input
              type="text"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2 text-slate-800 font-mono font-bold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">ইস্যুর তারিখ:</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2 text-slate-800 font-bold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">বিশেষ মন্তব্য (ঐচ্ছিক):</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="যেমন: বিশেষ অবদানের স্বীকৃতি..."
              className="w-full bg-white border border-slate-300 rounded-xl p-2 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Dynamic Text Editor Panel (When in Edit Mode) */}
        {isEditMode ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-indigo-600" />
                  <h4 className="font-bold text-slate-900 text-sm">
                    {getTemplateTitle()} - এর মূল বক্তব্য ও শর্তাবলি সম্পাদনা করুন
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditableBody(getDefaultBodyText(selectedType, staff));
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  title="ডিফল্ট ফরম্যাটে ফিরিয়ে নিন"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>ডিফল্ট লেখায় রিসেট করুন</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  বিষয়ের শিরোনাম:
                </label>
                <input
                  type="text"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  মূল বক্তব্য ও শর্তাবলি (Body Text):
                </label>
                <textarea
                  rows={10}
                  value={editableBody}
                  onChange={(e) => setEditableBody(e.target.value)}
                  className="w-full p-3.5 border border-slate-300 rounded-xl text-slate-900 text-sm leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none font-sans"
                  placeholder="এখানে আপনার প্রয়োজন অনুযায়ী নিয়োগপত্র বা সনদের ভাষা পরিবর্তন, নতুন ধারা বা শর্ত সংযোজন করুন..."
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  💡 আপনি এখানে যেকোনো বাক্য, শর্ত, বেতন বা অনুচ্ছেদ পরিবর্তন করতে পারেন। প্রিন্ট নেওয়ার সময় আপনার এডিট করা লেখাই সরাসরি প্রিন্ট হবে।
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditMode(false)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <Eye className="w-4 h-4" />
                  <span>প্রিভিউ দেখুন ও নিশ্চিত করুন</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Printable Preview Document Body (Screen Preview) */
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200/80 flex justify-center">
            {/* Screen preview container - only provides visual boundary on screen, not in print */}
            <div className="w-full max-w-2xl bg-white shadow-xl rounded-sm p-8 sm:p-12 text-slate-900 flex flex-col justify-between min-h-[750px] border border-slate-300">
              {renderCertificateContent(true)}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
          <div>
            ডকুমেন্ট: <span className="font-bold text-slate-900">{getTemplateTitle()}</span>
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

      {/* Hidden Isolated Print Canvas (Zero extra outer border / box shadow) */}
      <div id="staff-certificate-printable-area" className="hidden">
        <style dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 12mm 15mm 12mm 15mm !important;
              }
              *, *::before, *::after {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                box-shadow: none !important;
              }
              body {
                background: #ffffff !important;
                color: #000000 !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              #temp-print-frame,
              #staff-certificate-printable-area,
              .is-printable-doc {
                border: none !important;
                box-shadow: none !important;
                outline: none !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                background: #ffffff !important;
              }
            }
          `
        }} />
        {renderCertificateContent(false)}
      </div>
    </div>
  );
}
