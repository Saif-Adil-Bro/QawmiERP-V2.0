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
      className={`bg-white text-slate-900 mx-auto transition-all select-none amal-single-page ${
        isPreview
          ? "w-full max-w-[800px] min-h-[960px] p-5 sm:p-7 rounded-2xl shadow-xl border border-slate-300 relative"
          : "w-full max-w-[200mm] p-0 relative"
      }`}
      style={{
        boxSizing: "border-box",
        pageBreakAfter: "always",
        breakAfter: "page",
        pageBreakInside: "avoid",
        breakInside: "avoid",
        fontFamily: "'SolaimanLipi', 'Hind Siliguri', sans-serif",
      }}
    >
      {/* Outer Islamic Double Border */}
      <div
        className={`w-full border-2 border-slate-900 rounded-lg p-2 sm:p-2.5 relative flex flex-col justify-between ${
          template.borderStyle === "ornate"
            ? "ring-1 ring-slate-800 ring-offset-1"
            : ""
        }`}
        style={{
          boxSizing: "border-box",
          minHeight: isPreview ? "940px" : "272mm",
          maxHeight: isPreview ? undefined : "275mm",
        }}
      >
        {/* Decorative Islamic Corner Ornaments */}
        <div className="absolute top-0.5 left-1 text-slate-400 text-xs font-serif leading-none select-none">
          ❖
        </div>
        <div className="absolute top-0.5 right-1 text-slate-400 text-xs font-serif leading-none select-none">
          ❖
        </div>
        <div className="absolute bottom-0.5 left-1 text-slate-400 text-xs font-serif leading-none select-none">
          ❖
        </div>
        <div className="absolute bottom-0.5 right-1 text-slate-400 text-xs font-serif leading-none select-none">
          ❖
        </div>

        {/* SECTION 1: HEADER & LOGO */}
        <header className="border-b border-slate-800 pb-1.5 text-center relative shrink-0">
          {/* Arabic Ayah / Slogan (Centered) */}
          {template.arabicSlogan && (
            <div className="text-center mb-0.5">
              <span
                className="font-arabic font-amiri text-[11px] font-medium tracking-wide text-slate-800 inline-block"
                style={{ fontFamily: "'Amiri', 'Scheherazade New', 'Noto Naskh Arabic', serif" }}
                dir="rtl"
              >
                « {template.arabicSlogan} »
              </span>
            </div>
          )}

          <div className="flex items-center justify-center gap-2.5 sm:gap-3 my-0.5">
            {/* Logo */}
            {logoUrl ? (
              <div className="w-10 h-10 sm:w-11 sm:h-11 relative shrink-0">
                <Image
                  src={logoUrl}
                  alt="Madrasa Logo"
                  width={44}
                  height={44}
                  className="object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-full border border-slate-800 flex items-center justify-center bg-slate-50 shrink-0 text-slate-800">
                <BookOpen className="w-5 h-5" />
              </div>
            )}

            {/* Title & Info */}
            <div className="text-center">
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
                {madrasaName}
              </h1>
              <p className="text-[10px] sm:text-[11px] text-slate-700 font-medium leading-tight mt-0.5">
                {madrasaAddress} | যোগাযোগ: {madrasaPhone}
              </p>
            </div>
          </div>

          {/* Title Ribbon Badge */}
          <div className="inline-block mt-0.5 bg-slate-900 text-white px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wide shadow-2xs print:bg-black print:text-white">
            {template.title}
          </div>
        </header>

        {/* SECTION 2: STUDENT DYNAMIC DETAILS BAR */}
        <section className="my-1 bg-slate-50/80 border border-slate-300 rounded p-1.5 text-[11px] text-slate-800 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-1 gap-x-2">
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
          <section className="mb-1 p-1.5 bg-amber-50/70 border border-amber-300 rounded text-[10px] leading-relaxed text-slate-800 shrink-0">
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
        <section className="flex-1 my-0.5 overflow-hidden">
          <table className="w-full border-collapse border border-slate-800 text-center text-[10.5px]">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800">
                <th className="border border-slate-800 py-0.5 px-1 w-5 text-[9.5px] align-middle">নং</th>
                <th className="border border-slate-800 py-0.5 px-1.5 text-left text-[10px] align-middle">
                  আমল ও ছুটির কর্মসূচির বিবরণ
                </th>
                {daysList.map((day) => {
                  const isVertical =
                    template.dateHeaderMode === "vertical" ||
                    (template.dateHeaderMode !== "horizontal" && template.durationDays > 7);

                  return (
                    <th
                      key={day.date}
                      className={`border border-slate-800 font-bold bg-slate-50 text-slate-900 ${
                        isVertical
                          ? "p-0 align-bottom h-[56px]"
                          : "py-0.5 px-0.5 w-10 sm:w-11 text-[9.5px] align-middle"
                      }`}
                      style={isVertical ? { verticalAlign: "bottom" } : undefined}
                    >
                      {isVertical ? (
                        <div className="flex items-center justify-center w-full h-full py-1 px-0.5 overflow-hidden">
                          <div
                            className="[writing-mode:vertical-rl] rotate-180 whitespace-nowrap leading-none tracking-tight inline-flex items-center justify-center gap-0.5 select-none"
                            style={{
                              writingMode: "vertical-rl",
                              transform: "rotate(180deg)",
                              WebkitWritingMode: "vertical-rl",
                              WebkitTransform: "rotate(180deg)",
                            }}
                          >
                            <span className="font-black text-slate-950 text-[9.5px]">
                              {day.dayBangla.replace("বার", "")}
                            </span>
                            <span className="text-[8px] font-bold text-slate-700">
                              {day.dayDateMonthShort}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="leading-tight">
                          <span className="block font-black text-slate-900 text-[9.5px]">
                            {day.dayBangla.replace("বার", "")}
                          </span>
                          <span className="text-[8.5px] text-slate-600 block font-medium">
                            {day.dayDateMonthShort || day.formattedDateBangla.split(" ")[0]}
                          </span>
                        </div>
                      )}
                    </th>
                  );
                })}
                <th className="border border-slate-800 py-0.5 px-1 w-12 text-[9px] align-middle">
                  অভিভাবকের মন্তব্য
                </th>
              </tr>
            </thead>

            <tbody>
              {categoriesWithItems.map((category) => {
                return (
                  <React.Fragment key={category.id}>
                    {/* Category Group Header Row */}
                    <tr className="bg-slate-200/90 font-bold text-slate-900 text-[9.5px]">
                      <td
                        colSpan={daysList.length + 3}
                        className="border border-slate-800 text-left px-1.5 py-0.5 tracking-wide uppercase bg-slate-200 leading-none"
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
                          <td className="border border-slate-800 py-0.5 text-[9px] font-semibold text-slate-700 leading-tight">
                            {toBanglaNumber(itemSerial)}
                          </td>

                          {/* Item Name & Subtitle */}
                          <td className="border border-slate-800 py-0.5 px-1.5 text-left leading-tight">
                            <div className="font-bold text-slate-900 text-[10px] leading-tight">
                              {item.name}
                            </div>
                            {item.subtitle && (
                              <div className="text-[8.5px] text-slate-500 font-normal leading-none mt-0.5">
                                ({item.subtitle})
                              </div>
                            )}
                          </td>

                          {/* Daily Checkboxes */}
                          {daysList.map((day) => (
                            <td
                              key={day.date}
                              className="border border-slate-800 py-0.5 text-center align-middle"
                            >
                              <div className="w-3.5 h-3.5 mx-auto border border-slate-400 rounded-xs bg-white flex items-center justify-center print:border-slate-800">
                                {/* Blank square for pen tick mark */}
                              </div>
                            </td>
                          ))}

                          {/* Remarks column */}
                          <td className="border border-slate-800 py-0.5 px-0.5 text-[8.5px] text-slate-400">
                            {/* Blank line for guardian notes */}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Imam Signature Row after Ibadat Category */}
                    {(category.id === "ibadat" || category.items.some((i) => i.id.includes("fajr") || i.id.includes("isha") || i.id.includes("namaz"))) &&
                      template.showImamDailySignRow !== false && (
                        <tr className="bg-amber-50/70 border-b-2 border-slate-800 text-slate-900">
                          <td className="border border-slate-800 py-0.5 text-center text-[9px] text-amber-950 font-bold bg-amber-100/70">
                            ★
                          </td>
                          <td className="border border-slate-800 py-0.5 px-1.5 text-left bg-amber-50/90 leading-tight">
                            <div className="font-bold text-amber-950 text-[10px] leading-tight">
                              ইমাম সাহেবের স্বাক্ষর / জামাত সত্যায়ন
                            </div>
                            <div className="text-[8px] text-amber-800 font-medium leading-none mt-0.5">
                              (প্রতিদিনের পাঁচ ওয়াক্ত নামাজ জামাতে আদায়ের স্বাক্ষর)
                            </div>
                          </td>
                          {daysList.map((day) => (
                            <td
                              key={`imam-sign-${day.date}`}
                              className="border border-slate-800 py-0.5 px-0.5 text-center align-middle bg-amber-50/50"
                            >
                              <div className="w-full h-3.5 border border-dashed border-amber-900/60 rounded-xs flex items-center justify-center text-[7px] text-amber-900 font-serif">
                                {/* Signature box */}
                              </div>
                            </td>
                          ))}
                          <td className="border border-slate-800 py-0.5 px-0.5 text-[8px] text-amber-900 text-center font-bold bg-amber-50/90">
                            সীল / দস্তখত
                          </td>
                        </tr>
                      )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* SECTION 5: EVALUATION SCALE & INSTRUCTIONS */}
        <section className="my-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[9.5px] border border-slate-300 p-1.5 rounded bg-slate-50/80 shrink-0">
          {/* Evaluation Scale */}
          {template.showGradeEvaluation && (
            <div className="border-r border-slate-300 pr-1.5 space-y-0.5">
              <strong className="block font-bold text-slate-900 text-[10px] flex items-center gap-1">
                <span>★</span> সামগ্রিক অভিভাবক মূল্যায়ন (যেকোনো একটিতে টিক দিন):
              </strong>
              <div className="grid grid-cols-2 gap-x-1.5 gap-y-0.5 text-[9px]">
                {template.evaluationGrades.map((grade, gIdx) => (
                  <div key={gIdx} className="flex items-center gap-1 text-slate-800">
                    <span className="inline-block w-3 h-3 border border-slate-600 rounded-xs bg-white shrink-0" />
                    <span>{grade.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="space-y-0.5 pl-0.5">
            <strong className="block font-bold text-slate-900 text-[10px]">
              📌 সংকেত ও দিক-নির্দেশনা:
            </strong>
            <ul className="list-disc list-inside text-slate-700 text-[8.5px] space-y-0.5">
              <li>আদায় করলে টিক (✓), ঘরে পড়লে (△) এবং ছুটে গেলে (✗) চিহ্ন দিন।</li>
              <li>ছুটি শেষে মাদরাসায় প্রত্যাবর্তনের দিনই উস্তাদের নিকট জমা দিন।</li>
            </ul>
          </div>
        </section>

        {/* SECTION 6: SIGNATURES BLOCK */}
        <footer className="pt-2.5 border-t border-slate-800 mt-1 shrink-0">
          <div
            className={`grid text-center text-xs text-slate-900 gap-1.5 ${
              template.showImamSign !== false ? "grid-cols-4" : "grid-cols-3"
            }`}
          >
            {/* Guardian Sign */}
            <div className="space-y-0.5">
              <div className="w-full max-w-[110px] sm:max-w-[120px] border-b border-dashed border-slate-800 mx-auto" />
              <p className="font-bold text-[9.5px]">অভিভাবকের স্বাক্ষর</p>
              <p className="text-[8px] text-slate-500">ফোন: ....................</p>
            </div>

            {/* Optional Imam Sign */}
            {template.showImamSign !== false && (
              <div className="space-y-0.5">
                <div className="w-full max-w-[110px] sm:max-w-[120px] border-b border-dashed border-slate-800 mx-auto" />
                <p className="font-bold text-[9.5px] text-amber-950">মসজিদের ইমামের স্বাক্ষর</p>
                <p className="text-[8px] text-slate-500">মন্তব্য: ....................</p>
              </div>
            )}

            {/* Class Teacher Sign */}
            <div className="space-y-0.5">
              <div className="w-full max-w-[110px] sm:max-w-[120px] border-b border-dashed border-slate-800 mx-auto" />
              <p className="font-bold text-[9.5px]">শ্রেণি শিক্ষকের স্বাক্ষর</p>
              <p className="text-[8px] text-slate-500">তারিখ: ....................</p>
            </div>

            {/* Head / Nazim Sign */}
            <div className="space-y-0.5">
              <div className="w-full max-w-[110px] sm:max-w-[120px] border-b border-dashed border-slate-800 mx-auto" />
              <p className="font-bold text-[9.5px]">নাযেমে তা‘লীমাত / মুহতামিম</p>
              <p className="text-[8px] text-slate-500">সিলমোহর</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
