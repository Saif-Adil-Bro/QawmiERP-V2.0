"use client";

import React from "react";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface BlankAdmissionFormProps {
  madrasaInfo: any;
  customSession?: string;
  customFormNo?: string;
  formType?: "general" | "hifz" | "kitab" | "all";
}

export default function BlankAdmissionForm({
  madrasaInfo,
  customSession = "১৪৪৭-৪৮ হিজরি (২০২৬-২৭ খ্রি.)",
  customFormNo = "",
  formType = "all",
}: BlankAdmissionFormProps) {
  const mName = madrasaInfo?.name || "মাদরাসা";
  const mAddress = madrasaInfo?.address || "";
  const mPhone = madrasaInfo?.phone || madrasaInfo?.contact_phone || "";
  const mRegNo = madrasaInfo?.registration_no || madrasaInfo?.reg_no || "";
  const mEstYear = madrasaInfo?.established_year || "";
  const logoUrl = madrasaInfo?.logo_url || "";

  return (
    <div className="bg-white text-slate-900 w-full max-w-[210mm] mx-auto p-6 sm:p-8 font-sans border border-slate-300 print:border-none print:p-0 print:m-0 text-xs">
      {/* Top Header */}
      <div className="text-center relative border-b-2 border-emerald-900 pb-3 mb-3">
        <p className="text-[11px] font-serif text-slate-600 mb-0.5">
          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
        </p>

        <div className="flex items-center justify-between gap-3">
          {/* Logo Left */}
          <div className="w-16 h-16 shrink-0 flex items-center justify-center">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className="w-16 h-16 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="w-14 h-14 rounded-full border-2 border-emerald-800 text-emerald-900 font-bold flex items-center justify-center text-xl">
                ম
              </div>
            )}
          </div>

          {/* Center Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-emerald-950 tracking-tight leading-tight">
              {mName}
            </h1>
            {mAddress && (
              <p className="text-[11px] text-slate-700 leading-snug mt-0.5">{mAddress}</p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-x-4 text-[10px] text-slate-600 mt-0.5 font-medium">
              {mEstYear && <span>স্থাপিত: {toBanglaNumber(mEstYear)} খ্রি.</span>}
              {mRegNo && <span>রেজিস্ট্রেশন নং: {toBanglaNumber(mRegNo)}</span>}
              {mPhone && <span>মোবাইল: {toBanglaNumber(mPhone)}</span>}
            </div>
          </div>

          {/* Right Photo Box */}
          <div className="w-20 h-24 border-2 border-dashed border-slate-400 bg-slate-50 flex flex-col items-center justify-center text-center p-1 rounded shrink-0">
            <span className="text-[10px] text-slate-500 font-semibold leading-tight">
              ১ কপি পাসপোর্ট সাইজ ছবি
            </span>
          </div>
        </div>

        {/* Title Tag */}
        <div className="mt-2 flex items-center justify-center gap-3">
          <span className="inline-block bg-emerald-900 text-white px-5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider print:bg-black print:text-white">
            ভর্তি আবেদন ফরম (Admission Form)
          </span>
        </div>
      </div>

      {/* Meta Bar: Form No, Session, Date */}
      <div className="flex items-center justify-between bg-slate-100/90 border border-slate-300 px-3 py-1.5 rounded mb-3 text-[11px] font-semibold text-slate-800">
        <div>
          ফরম নং: <span className="font-mono text-emerald-900">{customFormNo || "........................"}</span>
        </div>
        <div>
          শিক্ষাবর্ষ: <span className="font-bold text-slate-900">{customSession}</span>
        </div>
        <div>
          ভর্তির তারিখ: <span>........ / ........ / ২০২৬ খ্রি.</span>
        </div>
      </div>

      {/* 1. Student Personal Details */}
      <div className="border border-slate-300 rounded mb-3 overflow-hidden">
        <div className="bg-emerald-900/10 border-b border-slate-300 px-3 py-1 font-bold text-emerald-950 flex items-center gap-1.5 text-[11px]">
          <span>১. শিক্ষার্থীর ব্যক্তিগত পরিচিতি</span>
        </div>
        <div className="p-3 space-y-2">
          {/* Row 1: Name Bn */}
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-slate-800 shrink-0 w-36">
              শিক্ষার্থীর পূর্ণ নাম (বাংলায়):
            </span>
            <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
          </div>

          {/* Row 2: Name En */}
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-slate-800 shrink-0 w-36">
              Name (English Block):
            </span>
            <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
          </div>

          {/* Row 3: DOB, Age, Blood Group */}
          <div className="grid grid-cols-12 gap-2 items-baseline">
            <div className="col-span-4 flex items-baseline gap-1">
              <span className="font-semibold text-slate-800 shrink-0">জন্ম তারিখ:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
            </div>
            <div className="col-span-3 flex items-baseline gap-1">
              <span className="font-semibold text-slate-800 shrink-0">বয়স:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
            </div>
            <div className="col-span-2 flex items-baseline gap-1">
              <span className="font-semibold text-slate-800 shrink-0">রক্তের গ্রুপ:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
            </div>
            <div className="col-span-3 flex items-baseline gap-1">
              <span className="font-semibold text-slate-800 shrink-0">লিঙ্গ:</span>
              <span className="text-[10px] text-slate-600"> [ ] ছাত্র  [ ] ছাত্রী</span>
            </div>
          </div>

          {/* Row 4: Birth Reg No */}
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-slate-800 shrink-0 w-36">
              জন্ম নিবন্ধন নম্বর (১৭ ডিজিট):
            </span>
            <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
          </div>
        </div>
      </div>

      {/* 2. Parents & Guardian Details */}
      <div className="border border-slate-300 rounded mb-3 overflow-hidden">
        <div className="bg-emerald-900/10 border-b border-slate-300 px-3 py-1 font-bold text-emerald-950 flex items-center gap-1.5 text-[11px]">
          <span>২. পিতা, মাতা ও অভিভাবকের তথ্য</span>
        </div>
        <div className="p-3 space-y-2">
          {/* Father */}
          <div className="grid grid-cols-12 gap-2 items-baseline">
            <div className="col-span-7 flex items-baseline gap-1">
              <span className="font-semibold text-slate-800 shrink-0">পিতার নাম:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
            </div>
            <div className="col-span-5 flex items-baseline gap-1">
              <span className="font-semibold text-slate-800 shrink-0">পেশা:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
            </div>
          </div>

          {/* Mother */}
          <div className="grid grid-cols-12 gap-2 items-baseline">
            <div className="col-span-7 flex items-baseline gap-1">
              <span className="font-semibold text-slate-800 shrink-0">মাতার নাম:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
            </div>
            <div className="col-span-5 flex items-baseline gap-1">
              <span className="font-semibold text-slate-800 shrink-0">পেশা:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
            </div>
          </div>

          {/* Guardian if different & Phone */}
          <div className="grid grid-cols-12 gap-2 items-baseline">
            <div className="col-span-5 flex items-baseline gap-1">
              <span className="font-semibold text-slate-800 shrink-0">বৈধ অভিভাবক:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
            </div>
            <div className="col-span-3 flex items-baseline gap-1">
              <span className="font-semibold text-slate-800 shrink-0">সম্পর্ক:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
            </div>
            <div className="col-span-4 flex items-baseline gap-1">
              <span className="font-semibold text-slate-800 shrink-0">মোবাইল নং:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="grid grid-cols-12 gap-2 items-baseline">
            <div className="col-span-6 flex items-baseline gap-1">
              <span className="font-semibold text-slate-800 shrink-0">বিকল্প/জরুরি ফোন:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
            </div>
            <div className="col-span-6 flex items-baseline gap-1">
              <span className="font-semibold text-slate-800 shrink-0">হোয়াটসঅ্যাপ (যদি থাকে):</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Address Details */}
      <div className="border border-slate-300 rounded mb-3 overflow-hidden">
        <div className="bg-emerald-900/10 border-b border-slate-300 px-3 py-1 font-bold text-emerald-950 flex items-center gap-1.5 text-[11px]">
          <span>৩. ঠিকানা সংক্রান্ত তথ্য</span>
        </div>
        <div className="p-3 space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-slate-800 shrink-0 w-28">বর্তমান ঠিকানা:</span>
            <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-slate-800 shrink-0 w-28">স্থায়ী ঠিকানা:</span>
            <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-600">
            <div className="flex items-baseline gap-1">
              <span>ডাকঘর:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[14px]"></span>
            </div>
            <div className="flex items-baseline gap-1">
              <span>উপজেলা/থানা:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[14px]"></span>
            </div>
            <div className="flex items-baseline gap-1">
              <span>জেলা:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[14px]"></span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Academic Admission Choice & Background */}
      <div className="border border-slate-300 rounded mb-3 overflow-hidden">
        <div className="bg-emerald-900/10 border-b border-slate-300 px-3 py-1 font-bold text-emerald-950 flex items-center gap-1.5 text-[11px]">
          <span>৪. শিক্ষাগত তথ্য ও ভর্তিচ্ছু বিভাগ</span>
        </div>
        <div className="p-3 space-y-2">
          <div className="grid grid-cols-12 gap-2 items-baseline">
            <div className="col-span-5 flex items-baseline gap-1">
              <span className="font-semibold text-slate-800 shrink-0">ভর্তিচ্ছু জামাত/শ্রেণি:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
            </div>
            <div className="col-span-4 flex items-baseline gap-1">
              <span className="font-semibold text-slate-800 shrink-0">বিভাগ:</span>
              <span className="text-[10px]"> [ ] নুরানী  [ ] হিফজ  [ ] কিতাব</span>
            </div>
            <div className="col-span-3 flex items-baseline gap-1">
              <span className="font-semibold text-slate-800 shrink-0">ধরন:</span>
              <span className="text-[10px]"> [ ] আবাসিক  [ ] অনাবাসিক</span>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-2 items-baseline">
            <div className="col-span-8 flex items-baseline gap-1">
              <span className="font-semibold text-slate-800 shrink-0">পূর্ববর্তী প্রতিষ্ঠানের নাম:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
            </div>
            <div className="col-span-4 flex items-baseline gap-1">
              <span className="font-semibold text-slate-800 shrink-0">পঠিত জামাত/পারা:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Declaration / Pledge (অঙ্গিকারনামা) */}
      <div className="border border-slate-300 rounded mb-3 p-2.5 bg-slate-50/70 text-[10px] space-y-1.5">
        <p className="font-bold text-slate-900 text-[11px]">ছাত্র ও অভিভাবকের অঙ্গিকারনামা:</p>
        <p className="text-slate-700 leading-relaxed text-justify">
          আমি এই মর্মে অঙ্গীকার করছি যে, ফরমে প্রদত্ত সকল তথ্য সত্য ও নির্ভুল। আমার সন্তান/পোষ্য মাদরাসার সংবিধান, যাবতীয় নিয়ম-কানুন, আহকাম ও শৃঙ্খলা যথাযথভাবে মানিয়া চলিবে। কোনো ধরনের শৃঙ্খলাভঙ্গ বা অসদাচরণ করিলে মাদরাসা কর্তৃপক্ষের যে কোনো সিদ্ধান্ত মানিয়া লইতে বাধ্য থাকিব।
        </p>
        <div className="pt-5 flex justify-between items-end">
          <div className="text-center w-36">
            <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
              আবেদনকারী ছাত্রের স্বাক্ষর
            </div>
          </div>
          <div className="text-center w-40">
            <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
              অভিভাবকের পূর্ণ স্বাক্ষর ও তারিখ
            </div>
          </div>
        </div>
      </div>

      {/* 6. Office & Committee Approval (অফিস ও ভর্তি কমিটির জন্য) */}
      <div className="border-2 border-emerald-900 rounded p-2.5 bg-emerald-50/40 text-[10px] space-y-2 print:border-black">
        <div className="flex items-center justify-between border-b border-emerald-300 pb-1 text-emerald-950 font-bold text-[11px]">
          <span>৫. অফিস ও ভর্তি পরীক্ষা কমিটির ব্যবহারের জন্য (Office Use Only)</span>
          <span className="text-[10px] font-normal">রোল নং: ......................</span>
        </div>

        <div className="grid grid-cols-12 gap-2 text-slate-800">
          <div className="col-span-7">
            <div className="grid grid-cols-4 gap-1 text-center bg-white p-1 border border-slate-300 rounded font-semibold text-[10px]">
              <div>লিখিত: ______</div>
              <div>মৌখিক: ______</div>
              <div>তিলাওয়াত: ______</div>
              <div className="text-emerald-900 font-bold">মোট: ______</div>
            </div>
          </div>
          <div className="col-span-5 flex items-center justify-end gap-3 text-[10px] font-semibold">
            <span>সিদ্ধান্ত:</span>
            <span>[ ] উত্তীর্ণ (নির্বাচিত)</span>
            <span>[ ] অপেক্ষমান</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-0.5 text-slate-800 font-semibold">
          <div>মঞ্জুরকৃত জামাত: ..............................</div>
          <div>শ্রেণি রোল: ..............................</div>
          <div>মাসিক ফি: ৳ ..............................</div>
        </div>

        <div className="pt-6 flex justify-between items-end text-slate-800 font-semibold">
          <div className="text-center w-32">
            <div className="border-t border-slate-400 pt-1">
              প্রধান পরীক্ষকের স্বাক্ষর
            </div>
          </div>
          <div className="text-center w-36">
            <div className="border-t border-slate-400 pt-1">
              নাজেমে তা'লীমাতের স্বাক্ষর
            </div>
          </div>
          <div className="text-center w-32">
            <div className="border-t border-slate-400 pt-1 text-emerald-950 font-bold">
              মুহতামিম / প্রিন্সিপাল
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
