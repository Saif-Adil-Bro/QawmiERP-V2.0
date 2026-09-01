import { createClient } from "@/lib/supabase/server";
import { Award } from "lucide-react";
import CertificateClient from "./CertificateClient";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import { getExams } from "@/app/actions/exams";
import { getClasses } from "@/app/actions/students";
import { getCertificatesData } from "@/app/actions/certificates";

export const metadata = {
  title: "সনদপত্র ও অফিশিয়াল ডকুমেন্ট ম্যানেজমেন্ট | QawmiERP",
};

export default async function CertificatesPage(props: {
  searchParams?: Promise<{ student_id?: string; type?: string }>;
}) {
  const params = props.searchParams ? (await props.searchParams) || {} : {};
  const supabase = await createClient();
  
  const [madrasaInfo, exams, classes, initialCertData] = await Promise.all([
    getMadrasaInfo(),
    getExams(),
    getClasses(),
    getCertificatesData(),
  ]);

  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name, father_name, roll_number, class_id, student_id")
    .order("first_name");

  const studentId = params?.student_id;
  const certificateType = params?.type || "char_cert";

  let selectedStudent = null;
  if (studentId) {
    const { data } = await supabase.from("students").select("*").eq("id", studentId).single();
    selectedStudent = data;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Award className="w-6 h-6 text-emerald-600" />
            <span>সনদপত্র ও অফিশিয়াল ডকুমেন্ট পোর্টাল</span>
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            চারিত্রিক সনদ, প্রশংসাপত্র, প্রত্যয়ন, টিসি, ফলাফল সনদপত্র ও কিউআর যাচাইকৃত অফিশিয়াল নথি
          </p>
        </div>
      </div>

      <CertificateClient 
        selectedStudent={selectedStudent} 
        certificateType={certificateType} 
        madrasaInfo={madrasaInfo} 
        students={students || []}
        classes={classes || []}
        exams={exams || []}
        initialStudentId={studentId}
        initialCertData={initialCertData}
      />
    </div>
  );
}
