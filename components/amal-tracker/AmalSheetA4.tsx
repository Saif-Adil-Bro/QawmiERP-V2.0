"use client";

import React from "react";
import Image from "next/image";
import {
  AmalTrackerTemplate,
  AmalStudentSnapshot,
  generateAmalDateDays,
} from "@/lib/amal-tracker";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { Check, ShieldCheck, HeartHandshake, BookOpen, Star } from "lucide-react";

interface AmalSheetA4Props {
  template: AmalTrackerTemplate;
  student?: AmalStudentSnapshot | null;
  madrasaInfo?: any;
  startDateStr: string;
  isPreview?: boolean;
}

export const AmalSheetA4: React.FC<AmalSheetA4Props> = ({
  template,
  student,
  madrasaInfo,
  startDateStr,
  isPreview = false,
}) => {
  const madrasaName =
    madrasaInfo?.name_bn ||
    madrasaInfo?.name ||
    "দারুল উলূম কওমিয়া মাদরাসা";
  const madrasaAddress =
    madrasaInfo?.address_bn ||
    madrasaInfo?.address ||
    "মাদরাসা রোড, ডাকঘর ও থানা সদর";
  const madrasaPhone = madrasaInfo?.phone || madrasaInfo?.mobile || "০১৭০০-০০০০০০";
  const logoUrl = madrasaInfo?.logo_url;

  const daysList = generateAmalDateDays(startDateStr, template.durationDays);

  const startFormatted = daysList[0]?.formattedDateBangla || "";
  const endFormatted = daysList[daysList.length - 1]?.formattedDateBangla || "";
  const yearBangla = toBanglaNumber(new Date(startDateStr || new Date()).getFullYear());

  // Group items by category
  const categoriesWithItems = template.categories
    .map((cat) => ({
      ...cat,
      items: template.items.filter((item) => item.categoryId === cat.id),
    }))
    .filter((cat) => cat.items.length > 0);

  let serialCounter = 1;

  return (
    <div
      className={`bg-white text-slate-900 mx-auto transition-all print:m-0 print:p-0 print:border-none print:shadow-none print:w-full select-none ${
        isPreview
          ? "w-full max-w-[800px] min-h-[1050px] p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-300 relative"
          : "w-[210mm] min-h-[297mm] p-[10mm] relative"
      }`}
      style={{
        pageBreakAfter: "always",
        breakAfter: "page",
        fontFamily: "'SolaimanLipi', 'Hind Siliguri', sans-serif",
      }}
    >
      {/* Outer Islamic Double Border */}
      <div
        className={`w-full h-full border-2 border-slate-800 rounded-lg p-2.5 sm:p-3 relative flex flex-col justify-between ${
          template.borderStyle === "ornate"
            ? "ring-1 ring-slate-800 ring-offset-2"
            : ""
        }`}
      >
        {/* Decorative Islamic Corner Ornaments */}
        <div className="absolute top-1 left-1 text-slate-400 text-xs font-serif leading-none select-none">
          ❖
        </div>
        <div className="absolute top-1 right-1 text-slate-400 text-xs font-serif leading-none select-none">
          ❖
        </div>
        <div className="absolute bottom-1 left-1 text-slate-400 text-xs font-serif leading-none select-none">
          ❖
        </div>
        <div className="absolute bottom-1 right-1 text-slate-400 text-xs font-serif leading-none select-none">
          ❖
        </div>

        {/* SECTION 1: HEADER & LOGO */}
        <header className="border-b border-slate-800 pb-2 text-center relative">
          {/* Bismillah & Quranic Ayah / Slogan */}
          <div className="flex items-center justify-between text-[11px] text-slate-700 mb-1 px-1">
            <span
              className="font-arabic font-amiri text-xs font-bold text-slate-900 tracking-wide"
              style={{ fontFamily: "'Amiri', 'Scheherazade New', 'Noto Naskh Arabic', serif" }}
              dir="rtl"
            >
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </span>
            {template.arabicSlogan && (
              <span
                className="font-arabic font-amiri text-xs font-medium tracking-wide text-slate-800 hidden sm:inline"
                style={{ fontFamily: "'Amiri', 'Scheherazade New', 'Noto Naskh Arabic', serif" }}
                dir="rtl"
              >
                « {template.arabicSlogan} »
              </span>
            )}
            <span className="text-[10px] text-slate-600">
              {template.durationDays === 7 ? "সাপ্তাহিক আমলনামা" : `${toBanglaNumber(template.durationDays)} দিনের কর্মসূচি`}
            </span>
          </div>

          <div className="flex items-center justify-center gap-3 sm:gap-4 my-1">
            {/* Logo */}
            {logoUrl ? (
              <div className="w-12 h-12 sm:w-14 sm:h-14 relative shrink-0">
                <Image
                  src={logoUrl}
                  alt="Madrasa Logo"
                  width={56}
                  height={56}
                  className="object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className="w-11 h-11 rounded-full border border-slate-800 flex items-center justify-center bg-slate-50 shrink-0 text-slate-800">
                <BookOpen className="w-6 h-6" />
              </div>
            )}

            {/* Title & Info */}
            <div className="text-center">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-snug">
                {madrasaName}
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-700 font-medium">
                {madrasaAddress} | যোগাযোগ: {madrasaPhone}
              </p>
            </div>
          </div>

          {/* Title Ribbon Badge */}
          <div className="inline-block mt-1 bg-slate-900 text-white px-4 py-0.5 rounded-full text-xs font-bold tracking-wide shadow-sm print:bg-black print:text-white">
            {template.title}
          </div>
        </header>

        {/* SECTION 2: STUDENT DYNAMIC DETAILS BAR */}
        <section className="my-2 bg-slate-50 border border-slate-300 rounded p-2 text-xs text-slate-800">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-1.5 gap-x-2">
            <div>
              <span className="text-slate-500 font-medium">শিক্ষার্থীর নাম: </span>
              <strong className="text-slate-900 border-b border-dotted border-slate-400 pb-0.5">
                {student?.studentName || "................................................"}
              </strong>
            </div>

            <div>
              <span className="text-slate-500 font-medium">রোল নং: </span>
              <strong className="text-slate-900 border-b border-dotted border-slate-400 pb-0.5">
                {student?.studentRoll ? toBanglaNumber(student.studentRoll) : ".............."}
              </strong>
            </div>

            <div>
              <span className="text-slate-500 font-medium">জামাত / বিভাগ: </span>
              <strong className="text-slate-900 border-b border-dotted border-slate-400 pb-0.5">
                {student?.className || "..........................."}
              </strong>
            </div>

            <div>
              <span className="text-slate-500 font-medium">আইডি কোড: </span>
              <strong className="text-slate-900 border-b border-dotted border-slate-400 pb-0.5">
                {student?.studentIdCode || student?.studentRoll || ".............."}
              </strong>
            </div>

            <div className="col-span-2">
              <span className="text-slate-500 font-medium">অভিভাবকের নাম ও মোবাইল: </span>
              <strong className="text-slate-900">
                {student?.fatherName ? `${student.fatherName}` : "..........................."} (মোবাইল: {student?.guardianPhone || "..........................."})
              </strong>
            </div>

            <div className="col-span-2 text-right">
              <span className="text-slate-500 font-medium">সময়কাল: </span>
              <strong className="text-slate-900">
                {startFormatted} থেকে {endFormatted}, {yearBangla}
              </strong>
            </div>
          </div>
        </section>

        {/* SECTION 3: PARENT ADVICE / NASEEHAT CALLOUT */}
        {template.naseehatText && (
          <section className="mb-2 p-2 bg-amber-50/70 border border-amber-300 rounded text-[11px] leading-relaxed text-slate-800">
            <div className="font-bold text-amber-950 flex items-center gap-1 mb-0.5">
              <span>✉</span>
              <span>সম্মানিত অভিভাবকের প্রতি বিশেষ নিবেদন:</span>
            </div>
            <p className="text-justify text-slate-700 font-normal">
              {template.naseehatText}
            </p>
          </section>
        )}

        {/* SECTION 4: AMAL CHECKLIST TABLE */}
        <section className="flex-1 my-1">
          <table className="w-full border-collapse border border-slate-800 text-center text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800">
                <th className="border border-slate-800 py-1.5 px-1 w-7 text-[10px]">নং</th>
                <th className="border border-slate-800 py-1.5 px-2 text-left text-[11px]">
                  আমল ও বাড়ির কর্মসূচির বিবরণ
                </th>
                {daysList.map((day, idx) => (
                  <th
                    key={day.date}
                    className="border border-slate-800 py-1 px-0.5 font-bold w-11 sm:w-12 text-[10px] bg-slate-50"
                  >
                    <div className="leading-tight">
                      <span className="block font-black text-slate-900">
                        {template.durationDays <= 7 ? day.dayBangla.slice(0, 3) : `${day.dayNumberBangla}ম দিন`}
                      </span>
                      {template.durationDays <= 7 && (
                        <span className="text-[9px] text-slate-600 block font-normal">
                          {day.formattedDateBangla.split(" ")[0]}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
                <th className="border border-slate-800 py-1.5 px-1 w-16 text-[10px]">
                  অভিভাবকের মন্তব্য
                </th>
              </tr>
            </thead>

            <tbody>
              {categoriesWithItems.map((category) => {
                return (
                  <React.Fragment key={category.id}>
                    {/* Category Group Header Row */}
                    <tr className="bg-slate-200/90 font-bold text-slate-900 text-[10px]">
                      <td
                        colSpan={daysList.length + 3}
                        className="border border-slate-800 text-left px-2 py-0.5 tracking-wide uppercase bg-slate-200"
                      >
                        ❖ {category.name}
                      </td>
                    </tr>

                    {/* Category Items Rows */}
                    {category.items.map((item) => {
                      const itemSerial = serialCounter++;
                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50 border-b border-slate-300"
                        >
                          {/* Serial */}
                          <td className="border border-slate-800 py-1 text-[10px] font-semibold text-slate-700">
                            {toBanglaNumber(itemSerial)}
                          </td>

                          {/* Item Name & Subtitle */}
                          <td className="border border-slate-800 py-1 px-2 text-left">
                            <div className="font-bold text-slate-900 text-[11px] leading-snug">
                              {item.name}
                            </div>
                            {item.subtitle && (
                              <div className="text-[9px] text-slate-500 font-normal leading-tight">
                                ({item.subtitle})
                              </div>
                            )}
                          </td>

                          {/* Daily Checkboxes */}
                          {daysList.map((day) => (
                            <td
                              key={day.date}
                              className="border border-slate-800 py-1 text-center align-middle"
                            >
                              <div className="w-4 h-4 mx-auto border border-slate-400 rounded-sm bg-white flex items-center justify-center print:border-slate-800">
                                {/* Blank square for manual pen tick mark */}
                              </div>
                            </td>
                          ))}

                          {/* Remarks column */}
                          <td className="border border-slate-800 py-1 px-1 text-[9px] text-slate-400">
                            {/* Blank line for guardian notes */}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* SECTION 5: EVALUATION SCALE & INSTRUCTIONS */}
        <section className="my-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px] border border-slate-300 p-2 rounded bg-slate-50">
          {/* Evaluation Scale */}
          {template.showGradeEvaluation && (
            <div className="border-r border-slate-300 pr-2 space-y-1">
              <strong className="block font-bold text-slate-900 text-[11px] flex items-center gap-1">
                <span>★</span> সামগ্রিক অভিভাবক মূল্যায়ন (যেকোনো একটিতে টিক দিন):
              </strong>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                {template.evaluationGrades.map((grade, gIdx) => (
                  <div key={gIdx} className="flex items-center gap-1 text-slate-800">
                    <span className="inline-block w-3.5 h-3.5 border border-slate-600 rounded-sm bg-white shrink-0" />
                    <span>{grade.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="space-y-0.5 pl-1">
            <strong className="block font-bold text-slate-900 text-[11px]">
              📌 সংকেত ও দিক-নির্দেশনা:
            </strong>
            <ul className="list-disc list-inside text-slate-700 text-[9.5px] space-y-0.5">
              <li>আদায় করলে টিক (✓), ঘরে পড়লে (△) এবং ছুটে গেলে (✗) চিহ্ন দিন।</li>
              <li>ছুটি শেষে মাদরাসায় প্রত্যাবর্তনের দিনই উস্তাদের নিকট জমা দিন।</li>
            </ul>
          </div>
        </section>

        {/* SECTION 6: SIGNATURES BLOCK */}
        <footer className="pt-4 border-t border-slate-800 mt-2">
          <div className="grid grid-cols-3 text-center text-xs text-slate-900">
            {/* Guardian Sign */}
            <div className="space-y-1">
              <div className="w-32 sm:w-40 border-b border-dashed border-slate-800 mx-auto" />
              <p className="font-bold text-[11px]">অভিভাবকের স্বাক্ষর ও তারিখ</p>
              <p className="text-[9px] text-slate-500">ফোন: ..............................</p>
            </div>

            {/* Class Teacher Sign */}
            <div className="space-y-1">
              <div className="w-32 sm:w-40 border-b border-dashed border-slate-800 mx-auto" />
              <p className="font-bold text-[11px]">শ্রেণি শিক্ষকের স্বাক্ষর ও মন্তব্য</p>
              <p className="text-[9px] text-slate-500">তারিখ: ..............................</p>
            </div>

            {/* Head / Nazim Sign */}
            <div className="space-y-1">
              <div className="w-32 sm:w-40 border-b border-dashed border-slate-800 mx-auto" />
              <p className="font-bold text-[11px]">নাযেমে তা‘লীমাত / মুহতামিম</p>
              <p className="text-[9px] text-slate-500">সিলমোহর</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
