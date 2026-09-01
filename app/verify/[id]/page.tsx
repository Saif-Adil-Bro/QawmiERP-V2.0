import { verifyStudentIdCard } from "@/app/actions/id-card-management";
import { CheckCircle2, XCircle, ShieldCheck, AlertTriangle, Building2, Calendar, UserCheck } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "শিক্ষার্থী আইডি কার্ড যাচাইকরণ | QawmiERP Verification",
  description: "স্টুডেন্ট আইডি কার্ড অনলাইন কিউআর কোড যাচাইকরণ সিস্টেম",
};

export default async function VerifyStudentIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await verifyStudentIdCard(id);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans antialiased">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden">
        {/* Header Header */}
        <div className="bg-slate-900 text-white p-6 text-center relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl" />
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>
          </div>
          <h1 className="text-xl font-bold tracking-tight">QawmiERP Student Verification</h1>
          <p className="text-xs text-slate-400 mt-1">ডিজিটাল ও প্রিন্টেড স্টুডেন্ট আইডি কার্ড যাচাই কেন্দ্র</p>
        </div>

        {/* Verification Body */}
        <div className="p-6 space-y-6">
          {result.isValid && result.student ? (
            /* VERIFIED STATE */
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 text-center space-y-1 animate-in fade-in zoom-in duration-200">
                <div className="inline-flex items-center gap-2 bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>VERIFIED • বৈধ স্টুডেন্ট আইডি</span>
                </div>
                <p className="text-xs text-emerald-800 font-semibold pt-1">
                  এই আইডি কার্ডটি সচল ও বৈধ হিসেবে তথ্যভান্ডারে নথিভুক্ত রয়েছে।
                </p>
              </div>

              {/* Student Details Card */}
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-24 h-24 rounded-2xl bg-slate-100 border-2 border-emerald-500/30 overflow-hidden shadow-md shrink-0 flex items-center justify-center">
                  {result.student.photoUrl ? (
                    <img
                      src={result.student.photoUrl}
                      alt={result.student.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserCheck className="w-12 h-12 text-slate-400" />
                  )}
                </div>

                <div>
                  <h2 className="text-2xl font-black text-slate-900">{result.student.name}</h2>
                  <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 font-mono font-bold text-xs rounded-full border border-blue-200 mt-1">
                    ID: {result.student.studentIdCode}
                  </span>
                </div>
              </div>

              {/* Verified Details Grid */}
              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-3 text-xs sm:text-sm">
                <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-medium">মাদরাসা:</span>
                  <span className="font-bold text-slate-900 text-right">{result.student.madrasaName}</span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-medium">জামাত / ক্লাস:</span>
                  <span className="font-bold text-slate-900">{result.student.className}</span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-medium">রোল নম্বর:</span>
                  <span className="font-bold text-slate-900">{result.student.rollNumber}</span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-medium">শিক্ষাবর্ষ (Session):</span>
                  <span className="font-bold text-slate-900">{result.student.sessionName}</span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-medium">ইস্যুর তারিখ:</span>
                  <span className="font-semibold text-slate-800">{result.student.issueDate}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">মেয়াদোত্তীর্ণের তারিখ:</span>
                  <span className="font-semibold text-emerald-700">{result.student.expiryDate}</span>
                </div>
              </div>

              <div className="text-center text-[11px] text-slate-400">
                যাচাইকরণের সময়: {new Date(result.verifiedAt || Date.now()).toLocaleString("bn-BD")}
              </div>
            </div>
          ) : (
            /* INVALID STATE */
            <div className="space-y-6 text-center animate-in fade-in zoom-in duration-200">
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 space-y-3">
                <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <XCircle className="w-8 h-8" />
                </div>

                <h2 className="text-xl font-black text-rose-900">✕ ID NOT VALID</h2>

                <p className="text-xs font-bold text-rose-800 leading-relaxed">
                  {result.reason || "এই আইডি কার্ডটি বাতিল, হারিয়ে যাওয়া বা অকার্যকর।" }
                </p>

                {result.studentName && (
                  <div className="pt-2 text-xs text-slate-700 border-t border-rose-200/80 mt-2">
                    <p><strong>শিক্ষার্থীর নাম:</strong> {result.studentName}</p>
                    <p><strong>কার্ড নম্বর:</strong> {result.cardNumber}</p>
                  </div>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-800 text-left space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>নিরাপত্তা সতর্কতা:</span>
                </div>
                <p>
                  কার্ড হারিয়ে গেলে, ব্লকড হলে বা মেয়াদ উত্তীর্ণ হলে এই বারকোডটি স্বয়ংক্রিয়ভাবে অকার্যকর হয়ে যায়। প্রয়োজনে আপনার মাদরাসা কর্তৃপক্ষের সাথে যোগাযোগ করুন।
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 text-center text-xs text-slate-500">
          <p>© QawmiERP Digital Student Identity System</p>
        </div>
      </div>
    </div>
  );
}
