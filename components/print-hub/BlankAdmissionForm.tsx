"use client";

import React from "react";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface BlankAdmissionFormProps {
  madrasaInfo: any;
  customSession?: string;
  customFormNo?: string;
  formType?: "general" | "hifz" | "kitab" | "all";
  paperSize?: "a4" | "letter";
}

export default function BlankAdmissionForm({
  madrasaInfo,
  customSession = "১৪৪৭-৪৮ হিজরি (২০২৬-২৭ খ্রি.)",
  customFormNo = "",
  formType = "all",
  paperSize = "a4",
}: BlankAdmissionFormProps) {
  const mName = madrasaInfo?.name || "মাদরাসা";
  const mAddress = madrasaInfo?.address || "";
  const mPhone = madrasaInfo?.phone || madrasaInfo?.contact_phone || "";
  const mRegNo = madrasaInfo?.registration_no || madrasaInfo?.reg_no || "";
  const mEstYear = madrasaInfo?.established_year || "";
  const logoUrl = madrasaInfo?.logo_url || "";

  // Dynamic spacing based on paper size
  const isLetter = paperSize === "letter";

  return (
    <div
      className={`bg-white text-slate-900 w-full mx-auto font-sans border border-slate-300 print:border-none print:p-0 print:m-0 flex flex-col justify-between ${
        isLetter
          ? "max-w-[216mm] min-h-[265mm] p-4 text-[11.5px] leading-snug"
          : "max-w-[210mm] min-h-[285mm] p-5 text-[12.5px] leading-relaxed"
      }`}
      style={{
        boxSizing: "border-box",
      }}
    >
      <div>
        {/* Top Header */}
        <div className={`text-center relative border-b-2 border-emerald-900 ${isLetter ? "pb-2 mb-2.5" : "pb-3 mb-3.5"}`}>
          <p className="bismillah text-sm sm:text-base font-serif text-slate-700 mb-0.5 tracking-wide">
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
          </p>

          <div className="flex items-center justify-between gap-3">
            {/* Logo Left */}
            <div className="w-14 h-14 shrink-0 flex items-center justify-center">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="w-14 h-14 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="w-12 h-12 rounded-full border-2 border-emerald-800 text-emerald-900 font-black flex items-center justify-center text-lg bg-emerald-50">
                  ম
                </div>
              )}
            </div>

            {/* Center Info */}
            <div className="flex-1 min-w-0">
              <h1
                className={`font-black text-emerald-950 tracking-tight leading-tight ${
                  isLetter ? "text-xl sm:text-2xl" : "text-2xl sm:text-[26px]"
                }`}
              >
                {mName}
              </h1>
              {mAddress && (
                <p className={`text-slate-700 font-medium ${isLetter ? "text-[11px] mt-0.5" : "text-xs mt-1"}`}>
                  {mAddress}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-x-4 text-[10.5px] text-slate-600 mt-1 font-semibold">
                {mEstYear && <span>স্থাপিত: {toBanglaNumber(mEstYear)} খ্রি.</span>}
                {mRegNo && <span>রেজিস্ট্রেশন নং: {toBanglaNumber(mRegNo)}</span>}
                {mPhone && <span>মোবাইল: {toBanglaNumber(mPhone)}</span>}
              </div>
            </div>

            {/* Right Photo Box (Standard Passport Size 25x30mm) */}
            <div className="w-20 h-24 border-2 border-dashed border-slate-400 bg-slate-50 flex flex-col items-center justify-center text-center p-1 rounded shrink-0">
              <span className="text-[9.5px] text-slate-500 font-semibold leading-tight">
                ১ কপি পাসপোর্ট সাইজ ছবি
              </span>
            </div>
          </div>

          {/* Title Tag */}
          <div className="mt-2 flex items-center justify-center">
            <span className="inline-block bg-emerald-900 text-white px-6 py-1 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider print:bg-black print:text-white shadow-xs">
              ভর্তি আবেদন ফরম (Admission Form)
            </span>
          </div>
        </div>

        {/* Meta Bar: Form No, Session, Date */}
        <div
          className={`flex items-center justify-between bg-slate-100 border border-slate-300 rounded px-3 text-slate-800 font-semibold ${
            isLetter ? "py-1 mb-2.5 text-[11px]" : "py-1.5 mb-3 text-xs"
          }`}
        >
          <div>
            ফরম নং: <span className="font-mono font-bold text-emerald-950">{customFormNo || "........................"}</span>
          </div>
          <div>
            শিক্ষাবর্ষ: <span className="font-bold text-slate-900">{customSession}</span>
          </div>
          <div>
            আবেদনের তারিখ: <span>....... / ....... / ২০২... খ্রি.</span>
          </div>
        </div>

        {/* 1. Student Personal Details */}
        <div className={`border border-slate-300 rounded overflow-hidden ${isLetter ? "mb-2.5" : "mb-3"}`}>
          <div className="bg-emerald-900/10 border-b border-slate-300 px-3 py-1 font-bold text-emerald-950 flex items-center gap-1.5 text-xs">
            <span>১. শিক্ষার্থীর ব্যক্তিগত তথ্য</span>
          </div>
          <div className={`space-y-2 ${isLetter ? "p-2.5" : "p-3"}`}>
            {/* Row 1: Name Bn */}
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-slate-800 shrink-0 w-36">
                শিক্ষার্থীর নাম (বাংলা):
              </span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[20px]"></span>
            </div>

            {/* Row 2: Name En */}
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-slate-800 shrink-0 w-36">
                Name (English Block):
              </span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[20px]"></span>
            </div>

            {/* Row 3: DOB, Age, Blood Group, Gender */}
            <div className="grid grid-cols-12 gap-2 items-baseline">
              <div className="col-span-4 flex items-baseline gap-1.5">
                <span className="font-bold text-slate-800 shrink-0">জন্ম তারিখ:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[20px]"></span>
              </div>
              <div className="col-span-2 flex items-baseline gap-1.5">
                <span className="font-bold text-slate-800 shrink-0">বয়স:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[20px]"></span>
              </div>
              <div className="col-span-3 flex items-baseline gap-1.5">
                <span className="font-bold text-slate-800 shrink-0">রক্তের গ্রুপ:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[20px]"></span>
              </div>
              <div className="col-span-3 flex items-baseline gap-2">
                <span className="font-bold text-slate-800 shrink-0">লিঙ্গ:</span>
                <span className="text-slate-700 font-medium"> [ ] ছাত্র  [ ] ছাত্রী</span>
              </div>
            </div>

            {/* Row 4: Birth Reg No */}
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-slate-800 shrink-0 w-36">
                জন্ম নিবন্ধন নং (১৭ ডিজিট):
              </span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[20px]"></span>
            </div>
          </div>
        </div>

        {/* 2. Parents & Guardian Details */}
        <div className={`border border-slate-300 rounded overflow-hidden ${isLetter ? "mb-2.5" : "mb-3"}`}>
          <div className="bg-emerald-900/10 border-b border-slate-300 px-3 py-1 font-bold text-emerald-950 flex items-center gap-1.5 text-xs">
            <span>২. পিতা, মাতা ও অভিভাবকের বিবরণ</span>
          </div>
          <div className={`space-y-2 ${isLetter ? "p-2.5" : "p-3"}`}>
            {/* Father */}
            <div className="grid grid-cols-12 gap-2 items-baseline">
              <div className="col-span-7 flex items-baseline gap-1.5">
                <span className="font-bold text-slate-800 shrink-0">পিতার নাম:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[20px]"></span>
              </div>
              <div className="col-span-5 flex items-baseline gap-1.5">
                <span className="font-bold text-slate-800 shrink-0">পেশা:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[20px]"></span>
              </div>
            </div>

            {/* Mother */}
            <div className="grid grid-cols-12 gap-2 items-baseline">
              <div className="col-span-7 flex items-baseline gap-1.5">
                <span className="font-bold text-slate-800 shrink-0">মাতার নাম:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[20px]"></span>
              </div>
              <div className="col-span-5 flex items-baseline gap-1.5">
                <span className="font-bold text-slate-800 shrink-0">পেশা:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[20px]"></span>
              </div>
            </div>

            {/* Guardian & Relationship & Contact */}
            <div className="grid grid-cols-12 gap-2 items-baseline">
              <div className="col-span-5 flex items-baseline gap-1.5">
                <span className="font-bold text-slate-800 shrink-0">অভিভাবক:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[20px]"></span>
              </div>
              <div className="col-span-3 flex items-baseline gap-1.5">
                <span className="font-bold text-slate-800 shrink-0">সম্পর্ক:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[20px]"></span>
              </div>
              <div className="col-span-4 flex items-baseline gap-1.5">
                <span className="font-bold text-slate-800 shrink-0">মোবাইল নং:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[20px]"></span>
              </div>
            </div>

            {/* Emergency WhatsApp */}
            <div className="grid grid-cols-12 gap-2 items-baseline">
              <div className="col-span-6 flex items-baseline gap-1.5">
                <span className="font-bold text-slate-800 shrink-0">জরুরি যোগাযোগ নং:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[20px]"></span>
              </div>
              <div className="col-span-6 flex items-baseline gap-1.5">
                <span className="font-bold text-slate-800 shrink-0">হোয়াটসঅ্যাপ নং:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[20px]"></span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Address Details */}
        <div className={`border border-slate-300 rounded overflow-hidden ${isLetter ? "mb-2.5" : "mb-3"}`}>
          <div className="bg-emerald-900/10 border-b border-slate-300 px-3 py-1 font-bold text-emerald-950 flex items-center gap-1.5 text-xs">
            <span>৩. ঠিকানা সংক্রান্ত তথ্য</span>
          </div>
          <div className={`space-y-2 ${isLetter ? "p-2.5" : "p-3"}`}>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-slate-800 shrink-0 w-28">বর্তমান ঠিকানা:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[20px]"></span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-slate-800 shrink-0 w-28">স্থায়ী ঠিকানা:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[20px]"></span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-slate-700 font-medium">
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-slate-800">ডাকঘর:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[18px]"></span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-slate-800">উপজেলা/থানা:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[18px]"></span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-slate-800">জেলা:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[18px]"></span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Academic Admission Choice & Background */}
        <div className={`border border-slate-300 rounded overflow-hidden ${isLetter ? "mb-2.5" : "mb-3"}`}>
          <div className="bg-emerald-900/10 border-b border-slate-300 px-3 py-1 font-bold text-emerald-950 flex items-center gap-1.5 text-xs">
            <span>৪. শিক্ষাগত তথ্য ও ভর্তিচ্ছু বিভাগ</span>
          </div>
          <div className={`space-y-2 ${isLetter ? "p-2.5" : "p-3"}`}>
            <div className="grid grid-cols-12 gap-2 items-baseline">
              <div className="col-span-5 flex items-baseline gap-1.5">
                <span className="font-bold text-slate-800 shrink-0">ভর্তিচ্ছু জামাত/শ্রেণি:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[20px]"></span>
              </div>
              <div className="col-span-4 flex items-baseline gap-2">
                <span className="font-bold text-slate-800 shrink-0">বিভাগ:</span>
                <span className="text-slate-700 font-medium"> [ ] নূরানী  [ ] হিফজ  [ ] কিতাব</span>
              </div>
              <div className="col-span-3 flex items-baseline gap-2">
                <span className="font-bold text-slate-800 shrink-0">ধরন:</span>
                <span className="text-slate-700 font-medium"> [ ] আবাসিক  [ ] অনাবাসিক</span>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2 items-baseline">
              <div className="col-span-8 flex items-baseline gap-1.5">
                <span className="font-bold text-slate-800 shrink-0">পূর্ববর্তী শিক্ষা প্রতিষ্ঠান:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[20px]"></span>
              </div>
              <div className="col-span-4 flex items-baseline gap-1.5">
                <span className="font-bold text-slate-800 shrink-0">সর্বশেষ পঠিত জামাত/পারা:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[20px]"></span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Declaration / Pledge (অঙ্গীকারনামা) */}
        <div
          className={`border border-slate-300 rounded bg-slate-50/80 ${
            isLetter ? "mb-2.5 p-2.5 text-[11px]" : "mb-3 p-3 text-xs"
          }`}
        >
          <p className="font-bold text-slate-900 mb-1">শিক্ষার্থী ও অভিভাবকের অঙ্গীকারনামা:</p>
          <p className="text-slate-700 leading-relaxed text-justify">
            আমি সজ্ঞানে অঙ্গীকার করছি যে, অত্র ফরমে প্রদত্ত সকল তথ্য সত্য ও নির্ভুল। মাদরাসার যাবতীয় নিয়ম-কানুন ও শৃঙ্খলা যথাযথভাবে মানিয়া চলিব। অন্যথায় কর্তৃপক্ষ যেকোনো প্রশাসনিক সিদ্ধান্ত গ্রহণ করিতে পারিবেন।
          </p>
          <div className="pt-6 flex justify-between items-end">
            <div className="text-center w-36">
              <div className="border-t border-slate-500 pt-1 font-bold text-slate-800">
                ছাত্র/ছাত্রীর স্বাক্ষর
              </div>
            </div>
            <div className="text-center w-48">
              <div className="border-t border-slate-500 pt-1 font-bold text-slate-800">
                অভিভাবকের স্বাক্ষর ও তারিখ
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Office & Committee Approval (অফিস ও ভর্তি পরীক্ষা কমিটির ব্যবহারের জন্য) */}
      <div
        className={`border-2 border-emerald-950 rounded bg-emerald-50/40 print:border-black ${
          isLetter ? "p-2.5 text-[11px]" : "p-3 text-xs"
        }`}
      >
        <div className="flex items-center justify-between border-b border-emerald-300 pb-1 text-emerald-950 font-bold mb-2">
          <span className="text-xs sm:text-sm">৫. অফিস ও ভর্তি পরীক্ষা কমিটির ব্যবহারের জন্য (Office Use Only)</span>
          <span className="text-xs font-semibold">ভর্তি রোল নং: ......................</span>
        </div>

        <div className="grid grid-cols-12 gap-3 items-center mb-2">
          <div className="col-span-7">
            <div className="grid grid-cols-4 gap-1 text-center bg-white p-1 border border-slate-300 rounded font-semibold text-xs">
              <div>লিখিত: ___</div>
              <div>মৌখিক: ___</div>
              <div>তিলাওয়াত: ___</div>
              <div className="text-emerald-950 font-black">মোট: ___</div>
            </div>
          </div>
          <div className="col-span-5 flex items-center justify-end gap-3 font-bold text-slate-800">
            <span>সিদ্ধান্ত:</span>
            <span>[ ] উত্তীর্ণ</span>
            <span>[ ] অপেক্ষমান</span>
            <span>[ ] অনুত্তীর্ণ</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 font-bold text-slate-800 mb-3">
          <div>মঞ্জুরকৃত জামাত: ......................</div>
          <div>শ্রেণি রোল: ......................</div>
          <div>মাসিক ফি: ৳ ..................</div>
        </div>

        <div className="pt-6 flex justify-between items-end text-slate-900 font-bold text-xs sm:text-sm">
          <div className="text-center w-32">
            <div className="border-t border-slate-500 pt-1">
              পরীক্ষকের স্বাক্ষর
            </div>
          </div>
          <div className="text-center w-36">
            <div className="border-t border-slate-500 pt-1">
              নাজেমে তা'লীমাত
            </div>
          </div>
          <div className="text-center w-36">
            <div className="border-t border-slate-500 pt-1 text-emerald-950 font-black">
              মুহতামিম / প্রিন্সিপাল
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
