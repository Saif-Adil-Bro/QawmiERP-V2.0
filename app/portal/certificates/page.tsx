import { getStudentCertificates } from "@/app/actions/certificates";
import { getAuthUser } from "@/lib/supabase/server";
import { getStudents } from "@/app/actions/students";
import { Award, FileText, CheckCircle2, ShieldCheck, Download, Printer } from "lucide-react";
import CertificatePortalClient from "./CertificatePortalClient";

export const metadata = {
  title: "সনদপত্র ও অফিশিয়াল প্রত্যয়ন | QawmiPortal",
};

export default async function StudentPortalCertificatesPage() {
  const authUser = await getAuthUser();
  const allStudents = await getStudents();

  if (!allStudents || allStudents.length === 0) {
    return (
      <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center text-slate-500">
        কোনো সংযুক্ত শিক্ষার্থীর সনদপত্র তথ্য পাওয়া যায়নি।
      </div>
    );
  }

  // Pick first matching student or fallback
  const student = allStudents[0];
  const certificates = student ? await getStudentCertificates(student.id) : [];

  return (
    <div className="space-y-6">
      {/* Page Title Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200/80 mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span>সত্যায়িত ও কিউআরযুক্ত ডিজিটাল নথি</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            সনদপত্র ও অফিশিয়াল প্রত্যয়নপত্র
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            শিক্ষার্থীর চারিত্রিক সনদ, প্রশংসাপত্র, প্রত্যয়ন ও কোর্স সমাপ্তি ডকুমেন্টস
          </p>
        </div>

        <div className="px-4 py-2 bg-slate-900 text-white rounded-2xl text-xs font-bold flex items-center gap-2">
          <Award className="w-4 h-4 text-emerald-400" />
          <span>মোট ইস্যুকৃত সনদ: {certificates.length} টি</span>
        </div>
      </div>

      <CertificatePortalClient student={student} certificates={certificates} />
    </div>
  );
}
