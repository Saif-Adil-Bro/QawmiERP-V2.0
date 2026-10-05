"use client";

import React, { useState } from "react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { sortStudentsByRoll } from "@/lib/student-utils";
import { Scissors } from "lucide-react";

interface PresetMadrasaSheetsProps {
  madrasaInfo: any;
  sheetType: "attendance_monthly" | "leave_form" | "hifz_tracker" | "hostel_meal" | "due_slip";
  className?: string;
  monthName?: string;
  students?: any[];
}

export default function PresetMadrasaSheets({
  madrasaInfo,
  sheetType,
  className = "জামাত",
  monthName = "মুহাররম / মে",
  students = [],
}: PresetMadrasaSheetsProps) {
  const mName = madrasaInfo?.name || "মাদরাসা";
  const mAddress = madrasaInfo?.address || "";
  const mPhone = madrasaInfo?.phone || madrasaInfo?.contact_phone || "";
  const logoUrl = madrasaInfo?.logo_url || "";

  // Sort students ascending by roll number (1, 2, 3...)
  const sortedStudents = sortStudentsByRoll(students || []);

  // 1. MONTHLY ATTENDANCE GRID SHEET (Landscape A4)
  if (sheetType === "attendance_monthly") {
    const days = Array.from({ length: 31 }, (_, i) => i + 1);
    const rows =
      sortedStudents && sortedStudents.length > 0
        ? sortedStudents.map((s, idx) => ({
            roll: s.roll_number ? toBanglaNumber(s.roll_number) : toBanglaNumber(idx + 1),
            name: `${s.first_name || ""} ${s.last_name || ""}`.trim() || `ছাত্র ${idx + 1}`,
          }))
        : Array.from({ length: 25 }).map((_, idx) => ({
            roll: toBanglaNumber(idx + 1),
            name: "",
          }));

    return (
      <div className="bg-white text-slate-900 w-full max-w-[297mm] mx-auto p-5 border border-slate-300 print:border-none print:p-0 print:m-0 text-[10px]">
        {/* Header */}
        <div className="text-center border-b-2 border-slate-800 pb-2 mb-2 space-y-0.5">
          <p className="text-[10px] font-serif text-slate-500">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
          <h1 className="text-lg font-black text-slate-900">{mName}</h1>
          <p className="text-[10px] text-slate-600">{mAddress}</p>
          <div className="pt-1">
            <span className="inline-block bg-slate-900 text-white px-3 py-0.5 rounded text-xs font-bold print:bg-black">
              মাসিক শ্রেণি উপস্থিতি ও হাজিরা রেজিস্টার শিট
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-800 pt-1">
            <div>জামাত: <span className="font-bold">{className}</span></div>
            <div>মাস: <span className="font-bold">{monthName}</span></div>
            <div>শিক্ষাবর্ষ: <span>১৪৪৭-৪৮ হিজরি (২০২৬-২৭)</span></div>
            <div>ওস্তাদের নাম: <span>................................................</span></div>
          </div>
        </div>

        {/* 31-Day Attendance Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border-2 border-slate-800 text-center text-[9px]">
            <thead className="bg-slate-100 font-bold text-slate-900">
              <tr>
                <th className="border border-slate-400 p-1 w-7">রোল</th>
                <th className="border border-slate-400 p-1 w-36 text-left px-1.5">শিক্ষার্থীর পূর্ণ নাম</th>
                {days.map((d) => (
                  <th key={d} className="border border-slate-400 p-0.5 w-5 font-mono">
                    {toBanglaNumber(d)}
                  </th>
                ))}
                <th className="border border-slate-400 p-1 w-8 bg-emerald-50">উপ</th>
                <th className="border border-slate-400 p-1 w-8 bg-rose-50">অনু</th>
                <th className="border border-slate-400 p-1 w-8 bg-amber-50">ছুটি</th>
                <th className="border border-slate-400 p-1 w-16">মন্তব্য</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"}>
                  <td className="border border-slate-400 p-1 font-mono font-bold text-slate-800">{row.roll}</td>
                  <td className="border border-slate-400 p-1 text-left px-1.5 font-semibold text-slate-900 truncate max-w-[140px]">
                    {row.name}
                  </td>
                  {days.map((d) => (
                    <td key={d} className="border border-slate-400 p-0.5"></td>
                  ))}
                  <td className="border border-slate-400 p-0.5 bg-emerald-50/50"></td>
                  <td className="border border-slate-400 p-0.5 bg-rose-50/50"></td>
                  <td className="border border-slate-400 p-0.5 bg-amber-50/50"></td>
                  <td className="border border-slate-400 p-0.5"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="pt-4 flex items-center justify-between text-[10px] font-semibold text-slate-700">
          <div>হাজিরা গ্রহণকারী শিক্ষকের স্বাক্ষর: ................................................</div>
          <div>নাজেমে তা'লীমাতের স্বাক্ষর: ................................................</div>
          <div>মুহতামিমের স্বাক্ষর: ................................................</div>
        </div>
      </div>
    );
  }

  // 2. BLANK LEAVE APPLICATION FORM (ছুটির আবেদন ফরম - ২ কপি A4)
  if (sheetType === "leave_form") {
    const renderSingleLeaveForm = (copyTitle: string) => (
      <div className="border border-slate-300 rounded-lg p-5 bg-white space-y-3 text-xs">
        <div className="text-center border-b pb-2 space-y-0.5">
          <p className="text-[10px] font-serif text-slate-500">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
          <h2 className="text-base font-black text-slate-900">{mName}</h2>
          <span className="inline-block bg-emerald-900 text-white px-3 py-0.5 rounded text-[11px] font-bold print:bg-black">
            শিক্ষার্থীর ছুটির আবেদন ফরম ({copyTitle})
          </span>
        </div>

        <div className="space-y-2 text-slate-800">
          <p className="font-semibold">বরাবর, মুহতামিম / নাজেমে তা'লীমাত সাহেব,</p>
          <p className="text-slate-600">মুহতারাম, বিনীত নিবেদন এই যে,</p>

          <div className="grid grid-cols-12 gap-2 items-baseline">
            <div className="col-span-8 flex items-baseline gap-1">
              <span className="font-semibold shrink-0">আমি/আমার সন্তান:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
            </div>
            <div className="col-span-4 flex items-baseline gap-1">
              <span className="font-semibold shrink-0">রোল নং:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-2 items-baseline">
            <div className="col-span-6 flex items-baseline gap-1">
              <span className="font-semibold shrink-0">জামাত/শ্রেণি:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
            </div>
            <div className="col-span-6 flex items-baseline gap-1">
              <span className="font-semibold shrink-0">শাখা/বিভাগ:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
            </div>
          </div>

          <div className="flex items-baseline gap-1">
            <span className="font-semibold shrink-0">ছুটির কারণ:</span>
            <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
          </div>

          <div className="grid grid-cols-12 gap-2 items-baseline">
            <div className="col-span-7 flex items-baseline gap-1">
              <span className="font-semibold shrink-0">ছুটির মেয়াদ:</span>
              <span>তারিখ ......../......../২০২৬ হতে ......../......../২০২৬ পর্যন্ত (মোট _____ দিন)</span>
            </div>
            <div className="col-span-5 flex items-baseline gap-1">
              <span className="font-semibold shrink-0">অভিভাবকের মোবাইল:</span>
              <span className="flex-1 border-b border-dotted border-slate-400 min-h-[16px]"></span>
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-between items-end text-[11px] font-semibold text-slate-700">
          <div className="text-center w-32">
            <div className="border-t border-slate-400 pt-1">শিক্ষার্থীর স্বাক্ষর</div>
          </div>
          <div className="text-center w-36">
            <div className="border-t border-slate-400 pt-1">অভিভাবকের স্বাক্ষর</div>
          </div>
        </div>

        {/* Office Approval */}
        <div className="border-t border-slate-300 pt-2 grid grid-cols-3 gap-2 text-[10px] text-slate-700 bg-slate-50 p-2 rounded">
          <div>শ্রেণি শিক্ষকের মন্তব্য: [ ] মঞ্জুর  [ ] নামঞ্জুর</div>
          <div className="text-center">শিক্ষা সচিবের স্বাক্ষর</div>
          <div className="text-right font-bold text-slate-900">মুহতামিমের অনুমোদন</div>
        </div>
      </div>
    );

    return (
      <div className="bg-white text-slate-900 w-full max-w-[210mm] mx-auto p-4 space-y-4 border border-slate-300 print:border-none print:p-0">
        {renderSingleLeaveForm("মাদরাসা কপি")}
        <div className="relative my-2 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-dashed border-slate-400" />
          </div>
          <div className="relative flex items-center gap-2 bg-white px-3 text-[10px] text-slate-500 font-mono">
            <Scissors className="w-3.5 h-3.5" />
            <span>কেটে আলাদা করুন (Cut line)</span>
          </div>
        </div>
        {renderSingleLeaveForm("অভিভাবক কপি")}
      </div>
    );
  }

  // 3. HIFZ DAILY EVALUATION & DIARY SHEET (হিফজ দৈনিক সবক ও আমুক্তা ট্র্যাকার)
  if (sheetType === "hifz_tracker") {
    const rows =
      sortedStudents && sortedStudents.length > 0
        ? sortedStudents.map((s, idx) => ({
            roll: s.roll_number ? toBanglaNumber(s.roll_number) : toBanglaNumber(idx + 1),
            name: `${s.first_name || ""} ${s.last_name || ""}`.trim() || `ছাত্র ${idx + 1}`,
          }))
        : Array.from({ length: 20 }).map((_, idx) => ({
            roll: toBanglaNumber(idx + 1),
            name: "",
          }));

    return (
      <div className="bg-white text-slate-900 w-full max-w-[210mm] mx-auto p-4 sm:p-5 border border-slate-300 print:border-none print:p-0 print:m-0 text-xs">
        <div className="text-center border-b-2 border-slate-800 pb-2 mb-2 space-y-0.5">
          <p className="text-[10px] font-serif text-slate-500">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
          <h1 className="text-lg sm:text-xl font-black text-slate-900">{mName}</h1>
          <div className="pt-1">
            <span className="inline-block bg-amber-900 text-white px-3.5 py-0.5 rounded text-xs font-bold uppercase print:bg-black">
              হিফজুল কুরআন বিভাগ — দৈনিক সবক, আমুক্তা ও সবকপারা মূল্যায়ন শিট
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-700 pt-1.5 border-t mt-1.5">
            <div>হিফজ গ্রুপ: <span className="text-slate-900 font-bold">{className || "সকল ছাত্র"}</span></div>
            <div>তারিখ: <span>...../...../২০২৬</span></div>
            <div>উস্তাদের নাম: <span>................................................</span></div>
          </div>
        </div>

        <table className="w-full text-left text-[10px] border-collapse border-2 border-slate-800">
          <thead className="bg-amber-50/80 font-bold text-slate-900">
            <tr>
              <th className="border border-slate-400 p-1 text-center w-10">রোল</th>
              <th className="border border-slate-400 p-1 w-44">শিক্ষার্থীর নাম</th>
              <th className="border border-slate-400 p-1 text-center w-24">সবক (পারা/পৃষ্ঠা)</th>
              <th className="border border-slate-400 p-1 text-center w-24">সবকপারা</th>
              <th className="border border-slate-400 p-1 text-center w-24">আমুক্তা</th>
              <th className="border border-slate-400 p-1 text-center w-20">তাজবীদ মান</th>
              <th className="border border-slate-400 p-1 text-center">উস্তাদের স্বাক্ষর ও মন্তব্য</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} className={idx % 2 === 1 ? "bg-slate-50/60" : "bg-white"}>
                <td className="border border-slate-400 p-1 text-center font-mono font-bold text-slate-800">{r.roll}</td>
                <td className="border border-slate-400 p-1 font-semibold text-slate-900">{r.name}</td>
                <td className="border border-slate-400 p-1 text-center"></td>
                <td className="border border-slate-400 p-1 text-center"></td>
                <td className="border border-slate-400 p-1 text-center"></td>
                <td className="border border-slate-400 p-1 text-center"></td>
                <td className="border border-slate-400 p-1 text-center"></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pt-5 flex items-center justify-between text-[11px] font-semibold text-slate-800">
          <div>হিফজ শিক্ষক: ................................................</div>
          <div>হিফজ সুপারভাইজার: ................................................</div>
          <div>মুহতামিম: ................................................</div>
        </div>
      </div>
    );
  }

  // 4. HOSTEL / BOARDING MEAL BLANK REGISTER
  if (sheetType === "hostel_meal") {
    const days = Array.from({ length: 31 }, (_, i) => i + 1);
    const rows =
      sortedStudents && sortedStudents.length > 0
        ? sortedStudents.map((s, idx) => ({
            roll: s.roll_number ? toBanglaNumber(s.roll_number) : toBanglaNumber(idx + 1),
            name: `${s.first_name || ""} ${s.last_name || ""}`.trim() || `ছাত্র ${idx + 1}`,
          }))
        : Array.from({ length: 25 }).map((_, idx) => ({
            roll: toBanglaNumber(idx + 1),
            name: "",
          }));

    return (
      <div className="bg-white text-slate-900 w-full max-w-[297mm] mx-auto p-5 border border-slate-300 print:border-none print:p-0 print:m-0 text-[10px]">
        <div className="text-center border-b-2 border-slate-800 pb-2 mb-2 space-y-0.5">
          <h1 className="text-lg font-black text-slate-900">{mName}</h1>
          <span className="inline-block bg-slate-900 text-white px-3 py-0.5 rounded text-xs font-bold print:bg-black">
            বোর্ডিং ও হোস্টেল — মাসিক মিল রেজিস্টার ও খাবার চার্ট
          </span>
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-800 pt-1">
            <div>মাস: <span>{monthName}</span></div>
            <div>হোস্টেল ব্লক/রুম: <span>............................</span></div>
            <div>বাবুর্চি/পরিচালক: <span>................................................</span></div>
          </div>
        </div>

        <table className="w-full border-collapse border-2 border-slate-800 text-center text-[9px]">
          <thead className="bg-slate-100 font-bold text-slate-900">
            <tr>
              <th className="border border-slate-400 p-1 w-8">সিট নং</th>
              <th className="border border-slate-400 p-1 w-36 text-left px-1.5">ছাত্রের নাম ও জামাত</th>
              {days.map((d) => (
                <th key={d} className="border border-slate-400 p-0.5 w-5 font-mono">
                  {toBanglaNumber(d)}
                </th>
              ))}
              <th className="border border-slate-400 p-1 w-12 bg-amber-50">মোট মিল</th>
              <th className="border border-slate-400 p-1 w-16">স্বাক্ষর</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className={idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"}>
                <td className="border border-slate-400 p-1 font-mono font-bold">{row.roll}</td>
                <td className="border border-slate-400 p-1 text-left px-1.5 font-semibold truncate max-w-[140px]">{row.name}</td>
                {days.map((d) => (
                  <td key={d} className="border border-slate-400 p-0.5"></td>
                ))}
                <td className="border border-slate-400 p-0.5 bg-amber-50/50"></td>
                <td className="border border-slate-400 p-0.5"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // 5. DUE NOTICE SLIPS (3 slips per A4 page)
  return (
    <div className="bg-white text-slate-900 w-full max-w-[210mm] mx-auto p-4 space-y-4 border border-slate-300 print:border-none print:p-0">
      {[1, 2, 3].map((num) => (
        <div key={num} className="border border-slate-400 rounded-lg p-4 bg-white space-y-2 text-xs">
          <div className="flex items-start justify-between border-b pb-1.5">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">{mName}</h3>
              <p className="text-[10px] text-slate-600">হিসাব বিভাগ — বকেয়া ফি ও মাসিক তাগাদা পত্র</p>
            </div>
            <div className="text-right text-[10px] text-slate-500">
              তারিখ: ......../......../২০২৬ খ্রি.
            </div>
          </div>

          <div className="grid grid-cols-12 gap-2 text-slate-800 text-[11px] items-baseline">
            <div className="col-span-6 flex items-baseline gap-1">
              <span className="font-semibold shrink-0">ছাত্রের নাম:</span>
              <span className="flex-1 border-b border-dotted border-slate-400"></span>
            </div>
            <div className="col-span-3 flex items-baseline gap-1">
              <span className="font-semibold shrink-0">জামাত:</span>
              <span className="flex-1 border-b border-dotted border-slate-400"></span>
            </div>
            <div className="col-span-3 flex items-baseline gap-1">
              <span className="font-semibold shrink-0">রোল নং:</span>
              <span className="flex-1 border-b border-dotted border-slate-400"></span>
            </div>
          </div>

          <div className="flex items-baseline gap-2 text-slate-800 text-[11px]">
            <span className="font-semibold shrink-0">বকেয়া ফি'র বিবরণ:</span>
            <span className="flex-1 border-b border-dotted border-slate-400"></span>
            <span className="font-bold shrink-0">বকেয়া পরিমাণ: ৳ ____________ /-</span>
          </div>

          <p className="text-[10px] text-slate-600 leading-snug">
            সম্মানিত অভিভাবক, আগামী ______ তারিখের মধ্যে বকেয়া পরিশোধ করার জন্য বিনীত অনুরোধ করা হলো।
          </p>

          <div className="pt-3 flex justify-between items-end text-[10px] font-semibold text-slate-700">
            <div>হিসাবরক্ষক: ................................</div>
            <div>মুহতামিম / নাজেমে তা'লীমাত: ................................</div>
          </div>
        </div>
      ))}
    </div>
  );
}
