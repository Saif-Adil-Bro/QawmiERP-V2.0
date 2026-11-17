"use client";

import { Award, Star, Heart, Sparkles, CheckCircle2 } from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface Props {
  student: any;
  examTitle: string;
  examYear: string;
  madrasaName: string;
  madrasaAddress: string;
  logoUrl?: string;
  principalName?: string;
  principalSignUrl?: string;
  meritRank: number;
  banglaFont: string;
}

export default function KidsVisualReportCard({
  student,
  examTitle,
  examYear,
  madrasaName,
  madrasaAddress,
  logoUrl,
  principalName = "মুহতামিম / প্রিন্সিপাল",
  principalSignUrl,
  meritRank,
  banglaFont,
}: Props) {
  const percentage = Number(student.percentage || 0);
  const gradeLabel =
    percentage >= 80
      ? "মুমতাজ (অসাধারণ)"
      : percentage >= 65
      ? "জাইয়্যিদ জিদ্দান (খুব ভালো)"
      : percentage >= 50
      ? "জাইয়্যিদ (উত্তম)"
      : "মাকবুল (অগ্রসরমান)";

  const starCount =
    percentage >= 85 ? 5 : percentage >= 70 ? 4 : percentage >= 50 ? 3 : 2;

  return (
    <div
      className={`qawmi-print-paper print-strict-light force-light-mode bg-white text-slate-900 border-[3px] border-emerald-700 ring-2 ring-amber-400 rounded-2xl p-3.5 w-full h-full flex flex-col justify-between relative overflow-hidden ${banglaFont}`}
    >
      {/* Background Islamic Watermark Accent */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none">
        <Sparkles className="w-72 h-72 text-emerald-800" />
      </div>

      <div className="relative z-10">
        {/* Header with Madrasa Info & Kids Badge */}
        <div className="flex items-center justify-between border-b-2 border-emerald-600/40 pb-2 mb-2.5 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className="w-11 h-11 object-contain rounded-xl border-2 border-amber-400 p-0.5 bg-white shadow-xs shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-11 h-11 bg-gradient-to-br from-emerald-600 to-teal-800 rounded-xl border-2 border-amber-400 flex items-center justify-center text-white shadow-xs shrink-0">
                <Award className="w-6 h-6 text-amber-300" />
              </div>
            )}

            <div className="min-w-0">
              <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[9px] font-black uppercase tracking-wider mb-0.5">
                <Sparkles className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                <span className="truncate">নূরানী ও শিশু বিভাগ অগ্রগতি পত্র</span>
              </div>
              <h1 className="text-base font-black text-slate-950 leading-tight truncate">
                {madrasaName}
              </h1>
              <p className="text-[10px] text-slate-600 font-semibold truncate">{madrasaAddress}</p>
            </div>
          </div>

          <div className="text-right text-[9.5px] font-bold text-slate-600 space-y-0.5 shrink-0">
            <p className="text-emerald-800 font-black text-[11px]">
              {examTitle} - {toBanglaNumber(examYear)}
            </p>
            <p>তারিখ: {toBanglaNumber(new Date().toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" }))}</p>
          </div>
        </div>

        {/* Student Banner */}
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50 rounded-xl p-2.5 border border-emerald-200 mb-2.5 flex items-center justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 bg-white/80 px-1.5 py-0.5 rounded border border-emerald-200 inline-block">
              শিক্ষার্থীর নাম
            </span>
            <h2 className="text-base font-black text-slate-900 truncate">
              {student.first_name} {student.last_name}
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-700 font-bold">
              <span>জামাত: <strong className="text-emerald-900">{student.class_name || "শিশু শ্রেণি"}</strong></span>
              <span>•</span>
              <span>রোল: <strong className="text-emerald-900 font-mono">{toBanglaNumber(student.roll_number || "১")}</strong></span>
              {meritRank > 0 && (
                <>
                  <span>•</span>
                  <span>মেধা স্থান: <strong className="text-amber-800">{toBanglaNumber(meritRank)} তম</strong></span>
                </>
              )}
            </div>
          </div>

          {/* Big Overall Grade Badge */}
          <div className="bg-white rounded-xl p-2 border-2 border-amber-400 text-center shadow-xs min-w-[105px] shrink-0">
            <div className="flex items-center justify-center gap-0.5 text-amber-500 mb-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-3.5 h-3.5 ${
                    i < starCount ? "fill-amber-400 text-amber-500" : "text-slate-200"
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] font-black text-slate-900 block leading-tight">{gradeLabel}</span>
            <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full inline-block mt-0.5">
              প্রাপ্ত: {toBanglaNumber(percentage)}%
            </span>
          </div>
        </div>

        {/* Subjects & Marks Card Table */}
        <div className="space-y-1.5 mb-2.5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-[10.5px] text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <Award className="w-3 h-3 text-emerald-700" />
              <span>বিষয়ভিত্তিক মেধা ও পারদর্শিতা মূল্যায়ন</span>
            </h3>
            <span className="text-[9.5px] text-slate-500 font-medium">পূর্ণমান ও প্রাপ্ত নম্বর</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {student.marks && student.marks.length > 0 ? (
              student.marks.map((m: any, i: number) => {
                const obtained = Number(m.marks_obtained || 0);
                const total = Number(m.total_marks || 100);
                const subjectPct = Math.round((obtained / total) * 100);
                const stars = subjectPct >= 80 ? 5 : subjectPct >= 65 ? 4 : subjectPct >= 50 ? 3 : 2;

                return (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-slate-50/80 border border-slate-200 flex items-center justify-between gap-1.5"
                  >
                    <div className="min-w-0">
                      <h4 className="font-bold text-[11px] text-slate-900 truncate leading-tight">
                        {m.subject_name}
                      </h4>
                      <div className="flex items-center gap-0.5 text-amber-500 mt-0.5">
                        {Array.from({ length: 5 }).map((_, sIdx) => (
                          <Star
                            key={sIdx}
                            className={`w-2.5 h-2.5 ${
                              sIdx < stars ? "fill-amber-400 text-amber-500" : "text-slate-200"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-emerald-800">
                        {toBanglaNumber(obtained)}
                      </span>
                      <span className="text-[9px] text-slate-400 block font-semibold leading-none">
                        /{toBanglaNumber(total)}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-2 p-3 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                কোনো বিষয়ের ফলাফল যুক্ত করা হয়নি।
              </div>
            )}
          </div>
        </div>

        {/* Akhlaq & Tarbiyah Visual Observation */}
        <div className="p-2 bg-amber-50/50 rounded-xl border border-amber-200/80 mb-2 space-y-1">
          <h3 className="font-bold text-[10.5px] text-amber-950 flex items-center gap-1">
            <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
            <span>সুন্নাহ অভ্যাস ও আদব-আখলাক মূল্যায়ন</span>
          </h3>

          <div className="grid grid-cols-1 gap-1 text-[10px]">
            <div className="px-2 py-1 bg-white rounded-lg border border-amber-100 flex items-center justify-between">
              <span className="font-bold text-slate-700">সালাম ও বড়দের সম্মান:</span>
              <span className="text-emerald-700 font-bold">⭐⭐⭐⭐⭐ মুমতাজ</span>
            </div>
            <div className="px-2 py-1 bg-white rounded-lg border border-amber-100 flex items-center justify-between">
              <span className="font-bold text-slate-700">তিলাওয়াত ও দোআ পাঠ:</span>
              <span className="text-emerald-700 font-bold">⭐⭐⭐⭐⭐ মাশাআল্লাহ</span>
            </div>
            <div className="px-2 py-1 bg-white rounded-lg border border-amber-100 flex items-center justify-between">
              <span className="font-bold text-slate-700">পরিষ্কার-পরিচ্ছন্নতা:</span>
              <span className="text-emerald-700 font-bold">⭐⭐⭐⭐ উত্তম</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Signatures */}
      <div className="pt-2 border-t border-dashed border-slate-300 flex items-end justify-between relative z-10 text-[10px] text-slate-700 font-bold">
        <div className="text-center w-32">
          <div className="h-6 flex items-end justify-center mb-0.5">
            <span className="text-slate-300 font-serif italic text-[10px]">স্বাক্ষর</span>
          </div>
          <div className="border-t border-slate-700 pt-0.5">
            <p>শ্রেণি শিক্ষকের স্বাক্ষর</p>
          </div>
        </div>

        <div className="text-center w-36">
          <div className="h-6 flex items-end justify-center mb-0.5">
            {principalSignUrl ? (
              <img
                src={principalSignUrl}
                alt="Signature"
                className="h-5 object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-slate-300 font-serif italic text-[10px]">সিল ও স্বাক্ষর</span>
            )}
          </div>
          <div className="border-t border-slate-700 pt-0.5">
            <p className="truncate">{principalName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
