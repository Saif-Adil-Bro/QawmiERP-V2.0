"use client";

import React, { useState, useRef } from "react";
import { StaffMember } from "@/lib/staff-management";
import { Printer, X, FileText, Award, CheckCircle2, Building2 } from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";

export type CertificateLetterType = "APPOINTMENT" | "SERVICE" | "EXPERIENCE" | "RELIEVING";

interface StaffCertificateGeneratorModalProps {
  staff: StaffMember;
  madrasaName?: string;
  madrasaPhone?: string;
  madrasaAddress?: string;
  onClose: () => void;
}

export default function StaffCertificateGeneratorModal({
  staff,
  madrasaName = "দারুল উলুম কওমিয়া মাদ্রাসা",
  madrasaPhone = "০১৮১২৩৪৫৬৭৮",
  madrasaAddress = "মাদ্রাসা রোড, সদর, বাংলাদেশ",
  onClose,
}: StaffCertificateGeneratorModalProps) {
  const [selectedType, setSelectedType] = useState<CertificateLetterType>("APPOINTMENT");
  const [customSubject, setCustomSubject] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [referenceNo, setReferenceNo] = useState(`QM/DOC/${new Date().getFullYear()}/${staff.staff_id_code.replace(/[^0-9]/g, "").slice(-4)}`);
  const [remarks, setRemarks] = useState("");

  const printAreaRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-100 overflow-hidden my-auto flex flex-col max-h-[92vh] animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                অফিসিয়াল ডকুমেন্ট ও সনদ জেনারেটর
              </h3>
              <p className="text-xs text-slate-500">
                {staff.personal.first_name} {staff.personal.last_name} • {staff.employment.designation}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>প্রিন্ট / PDF ডাউনলোড</span>
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
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">ডকুমেন্টের ধরন:</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as CertificateLetterType)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            >
              <option value="APPOINTMENT">নিয়োগপত্র (Appointment Letter)</option>
              <option value="SERVICE">চাকরির প্রত্যয়নপত্র (Service Certificate)</option>
              <option value="EXPERIENCE">অভিজ্ঞতা সনদপত্র (Experience Certificate)</option>
              <option value="RELIEVING">ছাড়পত্র ও দায়মুক্তিপত্র (Relieving Letter)</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">স্মারক নম্বর / রেফারেন্স:</label>
            <input
              type="text"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">ইস্যুর তারিখ:</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">বিশেষ মন্তব্য (ঐচ্ছিক):</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="যেমন: বিশেষ অবদানের স্বীকৃতি..."
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Printable Preview Document Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-200 flex justify-center">
          <div
            ref={printAreaRef}
            className="w-full max-w-2xl bg-white shadow-xl rounded-sm p-10 sm:p-14 text-slate-900 flex flex-col justify-between min-h-[850px] font-serif border border-slate-300"
          >
            {/* Document Header */}
            <div>
              <div className="text-center border-b-2 border-emerald-900 pb-4 mb-6">
                <div className="text-emerald-900 text-xs font-bold tracking-widest uppercase mb-1">
                  بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-emerald-950 font-sans tracking-tight">
                  {madrasaName}
                </h1>
                <p className="text-xs text-slate-600 mt-1 font-sans">
                  {madrasaAddress} • ফোন: {toBanglaNumber(madrasaPhone)}
                </p>
              </div>

              {/* Ref & Date */}
              <div className="flex justify-between items-center text-xs font-sans text-slate-600 mb-8 border-b border-slate-200 pb-2">
                <div>
                  <span className="font-semibold">স্মারক নং: </span>
                  <span className="font-mono text-slate-800">{referenceNo}</span>
                </div>
                <div>
                  <span className="font-semibold">তারিখ: </span>
                  <span>{toBanglaNumber(issueDate)} খ্রিস্টাব্দ</span>
                </div>
              </div>

              {/* Title Badge */}
              <div className="text-center my-6">
                <span className="inline-block px-6 py-1.5 border-2 border-emerald-900 text-emerald-950 font-bold text-base sm:text-lg rounded-sm uppercase tracking-wide bg-emerald-50/50">
                  {selectedType === "APPOINTMENT" && "নিয়োগপত্র"}
                  {selectedType === "SERVICE" && "চাকরির প্রত্যয়নপত্র"}
                  {selectedType === "EXPERIENCE" && "অভিজ্ঞতা সনদপত্র"}
                  {selectedType === "RELIEVING" && "ছাড়পত্র ও দায়মুক্তি সনদ"}
                </span>
              </div>

              {/* Main Letter Body */}
              <div className="text-sm leading-relaxed text-slate-800 space-y-4 font-sans text-justify">
                {selectedType === "APPOINTMENT" && (
                  <>
                    <p>
                      বরাবর,<br />
                      <strong>{staff.personal.full_name_bn || `${staff.personal.first_name} ${staff.personal.last_name}`}</strong><br />
                      পিতার নাম: {staff.personal.father_name || "—"}<br />
                      গ্রাম/ঠিকানা: {staff.contact.present_address || "—"}
                    </p>
                    <p>
                      <strong>বিষয়: {staff.employment.designation} পদে নিয়োগ প্রদান প্রসঙ্গে।</strong>
                    </p>
                    <p>
                      মুহতারাম,<br />
                      আপনার অবগতির জন্য জানানো যাচ্ছে যে, মাদ্রাসা পরিচালনা পর্ষদের সিদ্ধান্ত মোতাবেক আপনাকে অত্র মাদ্রাসার{" "}
                      <strong>{staff.employment.department_name}</strong>-এর অধীনে <strong>{staff.employment.designation}</strong> পদে{" "}
                      <strong>{toBanglaNumber(staff.employment.joining_date)}</strong> তারিখ হতে নিয়োগ প্রদান করা হলো।
                    </p>
                    <p>
                      আপনার মাসিক মূল বেতন ৳{toBanglaNumber(staff.salary.basic_salary.toString())}/- (কথায়: {staff.salary.basic_salary} টাকা) এবং সর্বমোট প্রদেয় বেতন ও ভাতাদি ৳{toBanglaNumber(staff.salary.net_salary.toString())}/- ধার্য করা হলো।
                    </p>
                    <p>
                      আশা করা যায় আপনি মাদ্রাসার যাবতীয় নিয়মনীতি, শিষ্টাচার ও দ্বীনি শৃঙ্খলা রক্ষা করে নিষ্ঠার সাথে আপনার দায়িত্ব পালন করবেন।
                    </p>
                  </>
                )}

                {selectedType === "SERVICE" && (
                  <>
                    <p>
                      এই মর্মে প্রত্যয়ন করা যাচ্ছে যে, জনাব <strong>{staff.personal.full_name_bn || `${staff.personal.first_name} ${staff.personal.last_name}`}</strong>, পিতার নাম: {staff.personal.father_name || "—"}, অত্র মাদ্রাসায় <strong>{toBanglaNumber(staff.employment.joining_date)}</strong> তারিখ হতে অদ্যাবধি <strong>{staff.employment.department_name}</strong>-এ <strong>{staff.employment.designation}</strong> পদে অত্যন্ত বিশ্বস্ততা ও নিষ্ঠার সাথে দায়িত্ব পালন করে আসছেন।
                    </p>
                    <p>
                      তার স্টাফ পরিচিতি নম্বর: <strong>{staff.staff_id_code}</strong>। অত্র প্রতিষ্ঠানে দায়িত্ব পালনকালে তিনি সৎ, কর্মঠ, চরিত্রবান এবং দ্বীনি তাহযিব-তামাদ্দুনের প্রতি শ্রদ্ধাশীল হিসেবে পরিচিত।
                    </p>
                    <p>
                      মাদ্রাসা বা রাষ্ট্রের শৃঙ্খলা পরিপন্থী কোনো কার্যকলাপে তার সম্পৃক্ততা পাওয়া যায়নি। আমি তার সার্বিক কল্যাণ ও দ্বীনি ও পার্থিব জীবনের উত্তরোত্তর সাফল্য কামনা করি।
                    </p>
                  </>
                )}

                {selectedType === "EXPERIENCE" && (
                  <>
                    <p>
                      এই মর্মে অভিজ্ঞতা সনদ প্রদান করা যাচ্ছে যে, জনাব <strong>{staff.personal.full_name_bn || `${staff.personal.first_name} ${staff.personal.last_name}`}</strong>, পিতা: {staff.personal.father_name || "—"}, অত্র মাদ্রাসায় <strong>{toBanglaNumber(staff.employment.joining_date)}</strong> হতে সুনামের সাথে <strong>{staff.employment.designation}</strong> হিসেবে শিক্ষকতা/সেবামূলক দায়িত্ব পালন করেছেন।
                    </p>
                    <p>
                      তার শিক্ষাদান পদ্ধতি, কর্মদক্ষতা ও ছাত্রদের প্রতি পিতৃসুলভ স্নেহশীল আচরণ প্রশংসনীয় ছিল। তিনি একজন দায়িত্বশীল ও সময়নিষ্ঠ কর্মী।
                    </p>
                    {remarks && (
                      <p className="bg-slate-50 p-2 border-l-2 border-emerald-700 italic">
                        মন্তব্য: {remarks}
                      </p>
                    )}
                    <p>
                      ভবিষ্যৎ কর্মজীবনে তার উত্তরোত্তর সফলতা ও উজ্জ্বল ভবিষ্যৎ কামনা করছি।
                    </p>
                  </>
                )}

                {selectedType === "RELIEVING" && (
                  <>
                    <p>
                      অত্র সনদ দ্বারা নিশ্চিত করা যাচ্ছে যে, জনাব <strong>{staff.personal.full_name_bn || `${staff.personal.first_name} ${staff.personal.last_name}`}</strong> (স্টাফ আইডি: {staff.staff_id_code}), পদবী: <strong>{staff.employment.designation}</strong>, অত্র প্রতিষ্ঠানে সন্তোষজনকভাবে দায়িত্ব পালন শেষে ব্যক্তিগত কারণে অব্যাহতি/ছাড়পত্রের আবেদন করেন, যা পরিচালনা পর্ষদ কর্তৃক অনুমোদিত হয়েছে।
                    </p>
                    <p>
                      অত্র মাদ্রাসার পক্ষ থেকে তার নিকট কোনো প্রকার আর্থিক দায়দেনা, কুতুবখানার কিতাবপত্র বা অফিসিয়াল সরঞ্জামাদি পাওনা নেই। তিনি মাদ্রাসার সমস্ত দায় হতে সম্পূর্ণ মুক্ত।
                    </p>
                    <p>
                      আমরা তার ভবিষ্যৎ জীবনের অব্যাহত সার্বিক শান্তি, বরকত ও সমৃদ্ধি কামনা করি।
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Document Signatures */}
            <div className="pt-16 grid grid-cols-2 gap-8 text-center text-xs font-sans">
              <div>
                <div className="w-36 mx-auto border-b border-slate-700 mb-1" />
                <p className="font-semibold text-slate-800">নাজেমে তালিমাত / দপ্তর সম্পাদক</p>
                <p className="text-[11px] text-slate-500">{madrasaName}</p>
              </div>
              <div>
                <div className="w-36 mx-auto border-b border-slate-700 mb-1" />
                <p className="font-bold text-slate-900">মুহতামিম / মহাপরিচালক</p>
                <p className="text-[11px] text-slate-500">{madrasaName}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
          <div>
            ডকুমেন্ট টাইটেল: <span className="font-bold text-slate-800">{getTemplateTitle()}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl transition cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
}
