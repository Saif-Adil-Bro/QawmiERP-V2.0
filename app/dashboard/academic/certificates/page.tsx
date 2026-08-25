import { createClient } from "@/lib/supabase/server";
import { Award } from "lucide-react";
import PrintButton from "@/app/components/PrintButton";
import CertificateClient from "./CertificateClient";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import { getExams } from "@/app/actions/exams";
import { getClasses } from "@/app/actions/students";

export default async function CertificatesPage({
  searchParams,
}: {
  searchParams: Promise<{ student_id?: string; type?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  
  const [madrasaInfo, exams, classes] = await Promise.all([
    getMadrasaInfo(),
    getExams(),
    getClasses()
  ]);

  const { data: students } = await supabase.from("students").select("id, first_name, last_name, roll_number, class_id").order("first_name");

  const studentId = params?.student_id;
  const certificateType = params?.type || "Hifz";

  let selectedStudent = null;
  if (studentId) {
    const { data } = await supabase.from("students").select("*").eq("id", studentId).single();
    selectedStudent = data;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">সনদ ও মার্কশিট পোর্টাল</h1>
          <p className="text-slate-500">শিক্ষার্থীদের জন্য সনদ জেনারেট করুন, মার্কশিট তৈরি করুন এবং ফলাফল প্রিন্ট করুন</p>
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
      />
    </div>
  );
}

