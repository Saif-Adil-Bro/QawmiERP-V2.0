"use client";

import React from "react";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface BlankAdmissionFormProps {
  madrasaInfo: any;
  customSession?: string;
  customFormNo?: string;
  formType?: "general" | "hifz" | "kitab" | "all";
  paperSize?: "a4" | "letter";
  showHeader?: boolean;
}

export default function BlankAdmissionForm({
  madrasaInfo,
  customSession = "১৪৪৭-৪৮ হিজরি (২০২৬-২৭ খ্রি.)",
  customFormNo = "",
  formType = "all",
  paperSize = "a4",
  showHeader = true,
}: BlankAdmissionFormProps) {
  const mName = madrasaInfo?.name || "মাদরাসা";
  const mAddress = madrasaInfo?.address || "";
  const mPhone = madrasaInfo?.phone || madrasaInfo?.contact_phone || "";
  const mRegNo = madrasaInfo?.registration_no || madrasaInfo?.reg_no || "";
  const mEstYear = madrasaInfo?.established_year || "";
  const logoUrl = madrasaInfo?.logo_url || "";

  const isLetter = paperSize === "letter";

  return (
    <div
      className={`bg-white text-slate-900 w-full mx-auto font-sans print:border-none print:p-0 print:m-0 flex flex-col justify-between ${
        isLetter
          ? "max-w-[214mm] text-[10.5px] leading-tight p-2.5"
          : "max-w-[210mm] text-[11px] leading-tight p-3"
      }`}
      style={{
        boxSizing: "border-box",
        pageBreakInside: "avoid",
        breakInside: "avoid",
      }}
    >
      <div>
        {/* Top Header / Pad Section */}
        {showHeader ? (
          <div className="text-center relative border-b-2 border-emerald-900 pb-1.5 mb-1.5">
            <p className="bismillah text-xs font-serif text-slate-700 mb-0.5 tracking-wide">
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </p>

            <div className="flex items-center justify-between gap-2.5">
              {/* Logo Left */}
              <div className="w-11 h-11 shrink-0 flex items-center justify-center">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="w-11 h-11 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full border-2 border-emerald-800 text-emerald-900 font-black flex items-center justify-center text-sm bg-emerald-50">
                    ম
                  </div>
                )}
              </div>

              {/* Center Info */}
              <div className="flex-1 min-w-0">
                <h1
                  className={`font-black text-emerald-950 tracking-tight leading-none ${
                    isLetter ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"
                  }`}
                >
                  {mName}
                </h1>
                {mAddress && (
                  <p className="text-[10px] text-slate-700 font-medium mt-0.5 leading-snug">
                    {mAddress}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-center gap-x-3 text-[9.5px] text-slate-600 mt-0.5 font-semibold">
                  {mEstYear && <span>স্থাপিত: {toBanglaNumber(mEstYear)} খ্রি.</span>}
                  {mRegNo && <span>রেজিস্ট্রেশন নং: {toBanglaNumber(mRegNo)}</span>}
                  {mPhone && <span>মোবাইল: {toBanglaNumber(mPhone)}</span>}
                </div>
              </div>

              {/* Right Photo Box (Standard Passport Size) */}
              <div className="w-16 h-20 border-2 border-dashed border-slate-400 bg-slate-50 flex flex-col items-center justify-center text-center p-0.5 rounded shrink-0">
                <span className="text-[8.5px] text-slate-500 font-semibold leading-tight">
                  ১ কপি পাসপোর্ট ছবি
                </span>
              </div>
            </div>

            {/* Title Tag */}
            <div className="mt-1 flex items-center justify-center">
              <span className="inline-block bg-emerald-900 text-white px-5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider print:bg-black print:text-white">
                ভর্তি আবেদন ফরম (Admission Form)
              </span>
            </div>
          </div>
        ) : (
          /* Pre-printed Pad Header Space */
          <div className="h-14 flex items-end justify-between border-b border-slate-400 pb-1 mb-1.5">
            <span className="text-[10px] text-slate-400 font-serif">[ছাপানো প্যাডের জায়গা]</span>
            <span className="inline-block bg-emerald-900 text-white px-4 py-0.5 rounded-full text-[11px] font-bold uppercase print:bg-black print:text-white">
              ভর্তি আবেদন ফরম
            </span>
            <div className="w-14 h-16 border border-dashed border-slate-400 bg-slate-50 flex items-center justify-center text-[8px] text-slate-400 text-center rounded">
              ছবি
            </div>
          </div>
        )}

        {/* Meta Bar: Form No, Session, Date */}
        <div className="flex items-center justify-between bg-slate-100/90 border border-slate-300 rounded px-2.5 py-0.5 mb-1.5 text-[10px] font-semibold text-slate-800">
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
        <div className="border border-slate-300 rounded mb-1.5 overflow-hidden">
          <div className="bg-emerald-900/10 border-b border-slate-300 px-2 py-0.5 font-bold text-emerald-950 flex items-center gap-1 text-[10px]">
            <span>১. শিক্ষার্থীর ব্যক্তিগত পরিচিতি</span>
          </div>
          <div className="p-1.5 space-y-1">
            {/* Row 1: Name Bn */}
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-slate-800 shrink-0 w-32 text-[10.5px]">
                শিক্ষার্থীর নাম (বাংলা):
              </span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[15px]"></span>
            </div>

            {/* Row 2: Name En */}
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-slate-800 shrink-0 w-32 text-[10.5px]">
                Name (English Block):
              </span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[15px]"></span>
            </div>

            {/* Row 3: DOB, Age, Blood Group, Gender */}
            <div className="grid grid-cols-12 gap-1.5 items-baseline text-[10px]">
              <div className="col-span-4 flex items-baseline gap-1">
                <span className="font-bold text-slate-800 shrink-0">জন্ম তারিখ:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[15px]"></span>
              </div>
              <div className="col-span-2 flex items-baseline gap-1">
                <span className="font-bold text-slate-800 shrink-0">বয়স:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[15px]"></span>
              </div>
              <div className="col-span-3 flex items-baseline gap-1">
                <span className="font-bold text-slate-800 shrink-0">রক্ত:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[15px]"></span>
              </div>
              <div className="col-span-3 flex items-baseline gap-1.5">
                <span className="font-bold text-slate-800 shrink-0">লিঙ্গ:</span>
                <span className="text-slate-700"> [ ] ছাত্র  [ ] ছাত্রী</span>
              </div>
            </div>

            {/* Row 4: Birth Reg No */}
            <div className="flex items-baseline gap-1.5 text-[10px]">
              <span className="font-bold text-slate-800 shrink-0 w-32">
                জন্ম নিবন্ধন নং (১৭ ডিজিট):
              </span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[15px]"></span>
            </div>
          </div>
        </div>

        {/* 2. Parents & Guardian Details */}
        <div className="border border-slate-300 rounded mb-1.5 overflow-hidden">
          <div className="bg-emerald-900/10 border-b border-slate-300 px-2 py-0.5 font-bold text-emerald-950 flex items-center gap-1 text-[10px]">
            <span>২. পিতা, মাতা ও অভিভাবকের বিবরণ</span>
          </div>
          <div className="p-1.5 space-y-1 text-[10px]">
            {/* Father */}
            <div className="grid grid-cols-12 gap-1.5 items-baseline">
              <div className="col-span-7 flex items-baseline gap-1">
                <span className="font-bold text-slate-800 shrink-0">পিতার নাম:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[15px]"></span>
              </div>
              <div className="col-span-5 flex items-baseline gap-1">
                <span className="font-bold text-slate-800 shrink-0">পেশা:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[15px]"></span>
              </div>
            </div>

            {/* Mother */}
            <div className="grid grid-cols-12 gap-1.5 items-baseline">
              <div className="col-span-7 flex items-baseline gap-1">
                <span className="font-bold text-slate-800 shrink-0">মাতার নাম:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[15px]"></span>
              </div>
              <div className="col-span-5 flex items-baseline gap-1">
                <span className="font-bold text-slate-800 shrink-0">পেশা:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[15px]"></span>
              </div>
            </div>

            {/* Guardian & Contact */}
            <div className="grid grid-cols-12 gap-1.5 items-baseline">
              <div className="col-span-5 flex items-baseline gap-1">
                <span className="font-bold text-slate-800 shrink-0">অভিভাবক:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[15px]"></span>
              </div>
              <div className="col-span-3 flex items-baseline gap-1">
                <span className="font-bold text-slate-800 shrink-0">সম্পর্ক:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[15px]"></span>
              </div>
              <div className="col-span-4 flex items-baseline gap-1">
                <span className="font-bold text-slate-800 shrink-0">মোবাইল:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[15px]"></span>
              </div>
            </div>

            {/* Emergency WhatsApp */}
            <div className="grid grid-cols-12 gap-1.5 items-baseline">
              <div className="col-span-6 flex items-baseline gap-1">
                <span className="font-bold text-slate-800 shrink-0">জরুরি ফোন:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[15px]"></span>
              </div>
              <div className="col-span-6 flex items-baseline gap-1">
                <span className="font-bold text-slate-800 shrink-0">হোয়াটসঅ্যাপ:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[15px]"></span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Address Details */}
        <div className="border border-slate-300 rounded mb-1.5 overflow-hidden">
          <div className="bg-emerald-900/10 border-b border-slate-300 px-2 py-0.5 font-bold text-emerald-950 flex items-center gap-1 text-[10px]">
            <span>৩. স্থায়ী ও বর্তমান ঠিকানা</span>
          </div>
          <div className="p-1.5 space-y-1 text-[10px]">
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-slate-800 shrink-0 w-24">বর্তমান ঠিকানা:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[15px]"></span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-slate-800 shrink-0 w-24">স্থায়ী ঠিকানা:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[15px]"></span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-slate-700">
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-slate-800">ডাকঘর:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[14px]"></span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-slate-800">উপজেলা/থানা:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[14px]"></span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-slate-800">জেলা:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[14px]"></span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Academic Info */}
        <div className="border border-slate-300 rounded mb-1.5 overflow-hidden">
          <div className="bg-emerald-900/10 border-b border-slate-300 px-2 py-0.5 font-bold text-emerald-950 flex items-center gap-1 text-[10px]">
            <span>৪. শিক্ষাগত তথ্য ও ভর্তিচ্ছু বিভাগ</span>
          </div>
          <div className="p-1.5 space-y-1 text-[10px]">
            <div className="grid grid-cols-12 gap-1.5 items-baseline">
              <div className="col-span-5 flex items-baseline gap-1">
                <span className="font-bold text-slate-800 shrink-0">ভর্তিচ্ছু জামাত:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[15px]"></span>
              </div>
              <div className="col-span-4 flex items-baseline gap-1.5">
                <span className="font-bold text-slate-800 shrink-0">বিভাগ:</span>
                <span className="text-slate-700"> [ ] নূরানী [ ] হিফজ [ ] কিতাব</span>
              </div>
              <div className="col-span-3 flex items-baseline gap-1.5">
                <span className="font-bold text-slate-800 shrink-0">ধরন:</span>
                <span className="text-slate-700"> [ ] আবাসিক [ ] অনাবাসিক</span>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-1.5 items-baseline">
              <div className="col-span-8 flex items-baseline gap-1">
                <span className="font-bold text-slate-800 shrink-0">পূর্ববর্তী প্রতিষ্ঠান:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[15px]"></span>
              </div>
              <div className="col-span-4 flex items-baseline gap-1">
                <span className="font-bold text-slate-800 shrink-0">পঠিত জামাত:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 min-h-[15px]"></span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Declaration / Pledge (অঙ্গীকারনামা) */}
        <div className="border border-slate-300 rounded bg-slate-50/70 p-1.5 mb-1.5 text-[9.5px]">
          <p className="font-bold text-slate-900 mb-0.5 text-[10px]">শিক্ষার্থী ও অভিভাবকের অঙ্গীকারনামা:</p>
          <p className="text-slate-700 leading-snug text-justify">
            আমি অঙ্গীকার করছি যে, ফরমে প্রদত্ত সকল তথ্য সত্য ও সঠিক। মাদরাসার যাবতীয় নিয়ম-শৃঙ্খলা ও বিধানাবলী মানিয়া চলিতে বাধ্য থাকিব।
          </p>
          <div className="pt-3.5 flex justify-between items-end">
            <div className="text-center w-32">
              <div className="border-t border-slate-500 pt-0.5 font-bold text-slate-800">
                ছাত্র/ছাত্রীর স্বাক্ষর
              </div>
            </div>
            <div className="text-center w-40">
              <div className="border-t border-slate-500 pt-0.5 font-bold text-slate-800">
                অভিভাবকের স্বাক্ষর ও তারিখ
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Office & Committee Approval */}
      <div className="border border-emerald-950 rounded bg-emerald-50/30 print:border-black p-1.5 text-[9.5px]">
        <div className="flex items-center justify-between border-b border-emerald-300 pb-0.5 text-emerald-950 font-bold mb-1">
          <span className="text-[10px]">৫. অফিস ও ভর্তি পরীক্ষা কমিটির ব্যবহারের জন্য (Office Use Only)</span>
          <span className="text-[9.5px] font-semibold">ভর্তি রোল নং: ......................</span>
        </div>

        <div className="grid grid-cols-12 gap-2 items-center mb-1">
          <div className="col-span-7">
            <div className="grid grid-cols-4 gap-1 text-center bg-white p-0.5 border border-slate-300 rounded font-semibold text-[9.5px]">
              <div>লিখিত: ___</div>
              <div>মৌখিক: ___</div>
              <div>তিলাওয়াত: ___</div>
              <div className="text-emerald-950 font-black">মোট: ___</div>
            </div>
          </div>
          <div className="col-span-5 flex items-center justify-end gap-2 font-bold text-slate-800 text-[9.5px]">
            <span>সিদ্ধান্ত:</span>
            <span>[ ] উত্তীর্ণ</span>
            <span>[ ] অপেক্ষমান</span>
            <span>[ ] অনুত্তীর্ণ</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 font-bold text-slate-800 mb-1.5 text-[9.5px]">
          <div>মঞ্জুরকৃত জামাত: ......................</div>
          <div>শ্রেণি রোল: ......................</div>
          <div>মাসিক ফি: ৳ ..................</div>
        </div>

        <div className="pt-3 flex justify-between items-end text-slate-900 font-bold text-[10px]">
          <div className="text-center w-28">
            <div className="border-t border-slate-500 pt-0.5">
              পরীক্ষকের স্বাক্ষর
            </div>
          </div>
          <div className="text-center w-32">
            <div className="border-t border-slate-500 pt-0.5">
              নাজেমে তা'লীমাত
            </div>
          </div>
          <div className="text-center w-32">
            <div className="border-t border-slate-500 pt-0.5 text-emerald-950 font-black">
              মুহতামিম / প্রিন্সিপাল
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
