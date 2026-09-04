import { notFound } from "next/navigation";
import { getAdmissionById } from "@/app/actions/admissions";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import { toBanglaNumber } from "@/lib/numberToBangla";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldCheck, GraduationCap, Award, FileText, LogIn, ArrowRight, UserCheck, BookOpen } from "lucide-react";
import PrintButton from "@/components/common/PrintButton";

export default async function AdmitCardPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const admission = await getAdmissionById(id);

  if (!admission) {
    notFound();
  }

  const madrasa = await getMadrasaInfo();
  const isConfirmed = admission.status === "CONFIRMED";

  if (isConfirmed) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-8 flex flex-col items-center justify-center">
        <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-xl p-6 sm:p-8 space-y-6 text-center">
          {/* Madrasa Header */}
          <div className="space-y-1 border-b pb-4">
            <p className="text-xs font-serif text-slate-500">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
            <h1 className="text-xl sm:text-2xl font-black text-emerald-900">{madrasa.name || "মাদ্রাসাতুল মুসলিমীন"}</h1>
            <p className="text-xs text-slate-500">{madrasa.address || "ঠিকানা হালনাগাদ করুন"}</p>
          </div>

          {/* Success Badge */}
          <div className="flex flex-col items-center space-y-2">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-9 h-9" />
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>ভর্তি চূড়ান্তভাবে নিশ্চিতকৃত</span>
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              {admission.applicant_name_bn}
            </h2>
            <p className="text-xs text-slate-600">
              জামাত: <span className="font-bold text-slate-900">{admission.assigned_class_name || admission.target_class_name}</span> • 
              শ্রেণী রোল: <span className="font-mono font-bold text-emerald-800">{toBanglaNumber(admission.assigned_permanent_roll || "০১")}</span>
            </p>
          </div>

          {/* Message Box */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 text-left space-y-2">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs sm:text-sm">
              <UserCheck className="w-4 h-4 text-emerald-700" />
              <span>কোনো প্রবেশপত্র বা ডকুমেন্ট ডাউনলোডের প্রয়োজন নেই</span>
            </div>
            <p className="text-xs text-emerald-800 leading-relaxed">
              শিক্ষার্থী ইতিমধ্যে মাদরাসার নিয়মিত তালিকায় অন্তর্ভুক্ত হয়েছেন। দৈনিক ক্লাসের হাজিরা, পাঠ্য অগ্রগতি, হিফজ/কিতাব রুটিন ও অন্যান্য তথ্যের জন্য সরাসরি শিক্ষার্থী/অভিভাবক পোর্টালে লগইন করুন।
            </p>
          </div>

          {/* Action CTAs */}
          <div className="space-y-3 pt-2">
            <Link
              href="/login"
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition"
            >
              <LogIn className="w-4 h-4" />
              <span>শিক্ষার্থী / অভিভাবক পোর্টালে লগইন করুন</span>
            </Link>

            <div className="flex items-center justify-center gap-4 text-xs font-semibold text-slate-600 pt-1">
              <Link href="/portal" className="text-emerald-700 hover:underline flex items-center gap-1">
                <span>সরাসরি পোর্টাল ভিজিট</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <span>•</span>
              <Link href="/admission" className="text-slate-500 hover:text-slate-800">
                ভর্তি পেজে ফিরে যান
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white text-slate-900 p-4 sm:p-8 flex flex-col items-center justify-start">
      {/* Top Action Bar (Hidden on Print) */}
      <div className="w-full max-w-3xl flex flex-wrap items-center justify-between gap-3 mb-6 print:hidden">
        <Link
          href="/admission"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>ভর্তি পোর্টালে ফেরত যান</span>
        </Link>

        <div className="flex items-center gap-2">
          <PrintButton />
        </div>
      </div>

      {/* ADMISSION TEST ADMIT CARD (ভর্তি পরীক্ষার প্রবেশপত্র) */}
      <div className="w-full max-w-3xl bg-white border-2 border-emerald-900/40 rounded-2xl shadow-lg print:shadow-none print:border-2 print:border-black p-6 sm:p-8 relative overflow-hidden">
        {/* Subtle Islamic Border Pattern Accent */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-800 via-emerald-600 to-emerald-800 print:bg-black" />

          {/* Header Section */}
          <div className="text-center space-y-1 border-b-2 border-emerald-900/30 pb-4">
            <p className="text-xs font-serif text-slate-500 print:text-black">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-emerald-900 print:text-black tracking-tight">
              {madrasa.name || "মাদ্রাসাতুল মুসলিমীন"}
            </h1>
            <p className="text-xs text-slate-600 print:text-black">
              {madrasa.address || "ঠিকানা হালনাগাদ করুন"} {madrasa.phone && `• ফোন: ${madrasa.phone}`}
            </p>
            <div className="pt-2">
              <span className="inline-block bg-emerald-900 text-white print:bg-black print:text-white px-5 py-1 rounded-full text-xs sm:text-sm font-bold tracking-wider uppercase shadow-xs">
                ভর্তি পরীক্ষার প্রবেশপত্র (Admit Card)
              </span>
            </div>
            <p className="text-xs text-slate-600 print:text-black font-semibold pt-1">
              শিক্ষাবর্ষ: {admission.session_name || "১৪৪৭-৪৮ হিজরি (২০২৬-২৭)"}
            </p>
          </div>

          {/* Identity & Photo Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 py-5 border-b border-slate-200">
            {/* Main Info */}
            <div className="sm:col-span-3 space-y-2.5 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-2 bg-emerald-50/50 print:bg-slate-100 p-2.5 rounded-lg border border-emerald-100 print:border-black">
                <div>
                  <span className="text-slate-500 print:text-black block text-[11px]">আবেদন নম্বর (Application ID):</span>
                  <span className="font-mono font-bold text-emerald-900 print:text-black text-sm sm:text-base">
                    {admission.application_no}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 print:text-black block text-[11px]">পরীক্ষার রোল (Exam Roll):</span>
                  <span className="font-mono font-extrabold text-rose-700 print:text-black text-base sm:text-lg">
                    {admission.roll_number}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 pt-1">
                <div>
                  <span className="text-slate-500 print:text-black text-xs">শিক্ষার্থীর নাম (বাংলা): </span>
                  <span className="font-bold text-slate-900 print:text-black">{admission.applicant_name_bn}</span>
                </div>
                <div>
                  <span className="text-slate-500 print:text-black text-xs">নাম (English): </span>
                  <span className="font-semibold text-slate-800 print:text-black uppercase">{admission.applicant_name_en}</span>
                </div>
                <div>
                  <span className="text-slate-500 print:text-black text-xs">পিতার নাম: </span>
                  <span className="font-semibold text-slate-800 print:text-black">{admission.father_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 print:text-black text-xs">অভিভাবকের মোবাইল: </span>
                  <span className="font-bold text-slate-800 print:text-black font-mono">{admission.guardian_phone}</span>
                </div>
                <div>
                  <span className="text-slate-500 print:text-black text-xs">আবেদনকৃত জামাত: </span>
                  <span className="font-bold text-emerald-800 print:text-black">{admission.target_class_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 print:text-black text-xs">আবাসিক ধরন: </span>
                  <span className="font-semibold text-slate-800 print:text-black">{admission.residential_status}</span>
                </div>
              </div>
            </div>

            {/* Photo Slot */}
            <div className="sm:col-span-1 flex flex-col items-center justify-center">
              <div className="w-28 h-32 border-2 border-dashed border-slate-300 print:border-black rounded-lg overflow-hidden bg-slate-50 flex flex-col items-center justify-center text-center p-1">
                {admission.photo_url ? (
                  <img
                    src={admission.photo_url}
                    alt={admission.applicant_name_bn}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-[11px] text-slate-400 print:text-black space-y-1">
                    <span>পাসপোর্ট সাইজ ছবি</span>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-400 print:text-black mt-1">শিক্ষার্থীর ছবি</span>
            </div>
          </div>

          {/* Exam Schedule Block */}
          <div className="py-4 border-b border-slate-200">
            <h3 className="text-xs font-bold text-slate-900 print:text-black uppercase tracking-wider mb-2">
              ভর্তি পরীক্ষার সময়সূচি ও কেন্দ্র
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 print:bg-white p-3 rounded-xl border border-slate-200 print:border-black text-xs">
              <div>
                <span className="text-slate-500 print:text-black block text-[11px]">পরীক্ষার তারিখ:</span>
                <span className="font-bold text-slate-900 print:text-black">
                  {admission.exam_schedule?.exam_date || "বিজ্ঞপ্তির মাধ্যমে জানানো হবে"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 print:text-black block text-[11px]">পরীক্ষার সময়:</span>
                <span className="font-bold text-slate-900 print:text-black">
                  {admission.exam_schedule?.exam_time || "সকাল ০৯:৩০ ঘটিকা"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 print:text-black block text-[11px]">কক্ষ নম্বর:</span>
                <span className="font-bold text-slate-900 print:text-black">
                  {admission.exam_schedule?.room_no || "১০১ (একাডেমিক ভবন)"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 print:text-black block text-[11px]">কেন্দ্র:</span>
                <span className="font-bold text-slate-900 print:text-black">
                  {admission.exam_schedule?.venue || "মাদরাসা কেন্দ্রীয় ক্যাম্পাস"}
                </span>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="py-3 text-[11px] text-slate-600 print:text-black space-y-1">
            <p className="font-bold text-slate-800 print:text-black">পরীক্ষার্থীদের জন্য বিশেষ নির্দেশনাবলি:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              {admission.exam_schedule?.instructions ? (
                admission.exam_schedule.instructions.map((inst, idx) => (
                  <li key={idx}>{inst}</li>
                ))
              ) : (
                <>
                  <li>পরীক্ষা শুরুর অন্তত ৩০ মিনিট পূর্বে কেন্দ্রে উপস্থিত হতে হবে।</li>
                  <li>প্রবেশপত্রের মূল কপি সঙ্গে আনতে হবে।</li>
                  <li>প্রয়োজনীয় কলম, পেন্সিল ও স্কেল সঙ্গে রাখা আবশ্যক।</li>
                </>
              )}
            </ol>
          </div>

          {/* Barcode & Signatures */}
          <div className="pt-8 flex items-end justify-between border-t border-slate-200 text-center text-xs">
            {/* Mock Barcode */}
            <div className="text-left">
              <div className="font-mono text-lg tracking-[0.25em] text-slate-800 print:text-black">
                ||| | |||| || ||||| ||| |||
              </div>
              <span className="text-[10px] text-slate-400 print:text-black font-mono">
                {admission.application_no}
              </span>
            </div>

            <div className="flex gap-12">
              <div className="space-y-1">
                <div className="w-28 border-b border-slate-400 print:border-black" />
                <span className="text-[11px] font-semibold text-slate-700 print:text-black">ভর্তি সচিব / পরীক্ষক</span>
              </div>
              <div className="space-y-1">
                <div className="w-28 border-b border-slate-400 print:border-black" />
                <span className="text-[11px] font-semibold text-slate-700 print:text-black">মুহতামিম / প্রিন্সিপাল</span>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}
