import { verifyCertificateByToken } from "@/app/actions/certificates";
import { CheckCircle2, XCircle, ShieldCheck, AlertTriangle, Building2, Calendar, FileText, UserCheck } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "অফিশিয়াল সনদপত্র যাচাইকরণ | QawmiERP Verification",
  description: "মাদরাসা অনলাইন সার্টিফিকেট ও অফিশিয়াল ডকুমেন্ট কিউআর যাচাই কেন্দ্র",
};

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await verifyCertificateByToken(token);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans antialiased">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden">
        {/* Header Banner */}
        <div className="bg-slate-900 text-white p-6 text-center relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>
          </div>
          <h1 className="text-xl font-bold tracking-tight">QawmiERP Certificate Verification</h1>
          <p className="text-xs text-slate-400 mt-1">মাদরাসা অফিশিয়াল সনদপত্র অনলাইন যাচাইকরণ সিস্টেম</p>
        </div>

        {/* Verification Body */}
        <div className="p-6 space-y-6">
          {result.isValid && result.certificate ? (
            /* VERIFIED STATE */
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 text-center space-y-1 animate-in fade-in zoom-in duration-200">
                <div className="inline-flex items-center gap-2 bg-emerald-600 text-white px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>VERIFIED • সম্পূর্ণ বৈধ সনদপত্র</span>
                </div>
                <p className="text-xs text-emerald-800 font-semibold pt-1">
                  এই সনদপত্রটি কর্তৃপক্ষের অফিশিয়াল ডাটাবেজে সঠিক ও সচল হিসেবে নথিভুক্ত রয়েছে।
                </p>
              </div>

              {/* Document Summary Card */}
              <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs text-slate-500 font-medium">সনদের ধরন:</span>
                  <span className="font-bold text-slate-900 text-sm">{result.certificate.typeTitle}</span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs text-slate-500 font-medium">সনদ নম্বর:</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">{result.certificate.certificateNumber}</span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs text-slate-500 font-medium">শিক্ষার্থীর নাম:</span>
                  <span className="font-bold text-slate-900 text-sm">{result.certificate.studentName}</span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs text-slate-500 font-medium">আইডি / রোল:</span>
                  <span className="font-bold text-slate-800 text-xs">
                    {result.certificate.studentIdCode} (রোল: {result.certificate.rollNumber})
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs text-slate-500 font-medium">পিতার নাম:</span>
                  <span className="font-semibold text-slate-800 text-xs">{result.certificate.fatherName}</span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs text-slate-500 font-medium">জামাত ও সেশন:</span>
                  <span className="font-semibold text-slate-800 text-xs">
                    {result.certificate.className} ({result.certificate.sessionName})
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs text-slate-500 font-medium">মাদরাসা:</span>
                  <span className="font-bold text-slate-900 text-xs text-right">{result.certificate.madrasaName}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">ইস্যুর তারিখ:</span>
                  <span className="font-semibold text-slate-700 text-xs">{result.certificate.issueDate}</span>
                </div>
              </div>

              <div className="text-center text-[11px] text-slate-400">
                যাচাইকরণের সময়: {new Date(result.verifiedAt || Date.now()).toLocaleString("bn-BD")}
              </div>
            </div>
          ) : (
            /* UNVERIFIED STATE */
            <div className="space-y-6 text-center animate-in fade-in zoom-in duration-200">
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 space-y-3">
                <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <XCircle className="w-8 h-8" />
                </div>

                <h2 className="text-xl font-black text-rose-900">✕ INVALID OR REVOKED CERTIFICATE</h2>

                <p className="text-xs font-bold text-rose-800 leading-relaxed">
                  {result.reason || "এই সনদপত্রটি বাতিল, মেয়াদোত্তীর্ণ বা অকার্যকর।" }
                </p>

                {result.certificateNumber && (
                  <div className="pt-2 text-xs text-slate-700 border-t border-rose-200/80 mt-2">
                    <p><strong>সনদ নম্বর:</strong> {result.certificateNumber}</p>
                    {result.studentName && <p><strong>শিক্ষার্থীর নাম:</strong> {result.studentName}</p>}
                    {result.madrasaName && <p><strong>মাদরাসা:</strong> {result.madrasaName}</p>}
                  </div>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-800 text-left space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>নিরাপত্তা পরামর্শ:</span>
                </div>
                <p>
                  ভুল তথ্য দেওয়া হলে বা সনদ প্রত্যাহার করা হলে এই কিউআর লিংকটি বাতিল হয়ে যায়। সন্দেহ হলে সরাসরি মাদরাসা প্রশাসনের সাথে যোগাযোগ করুন।
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 text-center text-xs text-slate-500">
          <p>© QawmiERP Digital Document Identity & Certificate System</p>
        </div>
      </div>
    </div>
  );
}
