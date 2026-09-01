"use client";

import { useState } from "react";
import { StudentCertificate } from "@/lib/certificates";
import CertificateDocumentView from "@/app/components/CertificateDocumentView";
import { Award, FileText, CheckCircle2, ShieldCheck, Printer, Eye, X, Share2, Calendar } from "lucide-react";

interface CertificatePortalClientProps {
  student: any;
  certificates: StudentCertificate[];
}

export default function CertificatePortalClient({
  student,
  certificates,
}: CertificatePortalClientProps) {
  const [selectedCert, setSelectedCert] = useState<StudentCertificate | null>(null);

  if (!certificates || certificates.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/90 shadow-2xs space-y-4">
        <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto">
          <Award className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">এখনো কোনো সনদপত্র ইস্যু করা হয়নি</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          কর্তৃপক্ষ কর্তৃক চারিত্রিক সনদ, প্রশংসাপত্র বা পড়াশোনা সংক্রান্ত প্রত্যয়নপত্র ইস্যু করা হলে তা এখানে দেখা যাবে এবং প্রিন্ট করা যাবে।
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Certificate Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {certificates.map((cert) => {
          const isIssued = cert.status === "ISSUED";
          return (
            <div
              key={cert.id}
              className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs hover:shadow-md transition space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200">
                    {cert.certificate_type_title}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isIssued ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                    }`}
                  >
                    {cert.status}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 text-base">{cert.snapshot.student_name}</h3>
                  <p className="text-xs text-slate-500 font-mono">সনদ নং: {cert.certificate_number}</p>
                </div>

                <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className="flex justify-between">
                    <span>ইস্যুর তারিখ:</span>
                    <span className="font-semibold text-slate-800">{cert.issue_date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>মাদরাসা:</span>
                    <span className="font-semibold text-slate-800">{cert.snapshot.madrasa_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>জামাত/সেশন:</span>
                    <span className="font-semibold text-slate-800">
                      {cert.snapshot.class_name} ({cert.snapshot.session_name})
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCert(cert)}
                  className="flex-1 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>সনদপত্র দেখুন ও প্রিন্ট</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Certificate Modal / Drawer */}
      {selectedCert && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-100 rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-600" />
                <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                  {selectedCert.certificate_type_title} ({selectedCert.certificate_number})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCert(null)}
                className="p-2 bg-white hover:bg-slate-200 text-slate-700 rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <CertificateDocumentView certificate={selectedCert} />
          </div>
        </div>
      )}
    </div>
  );
}
