import { getStudents } from "@/app/actions/students";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import CollectPaymentClient from "./CollectPaymentClient";

export default async function NewFeePage(props: {
  searchParams?: Promise<{ student_id?: string }>;
}) {
  const params = props.searchParams ? (await props.searchParams) || {} : {};
  const [students, madrasaInfo] = await Promise.all([
    getStudents(),
    getMadrasaInfo(),
  ]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-3 print:hidden">
        <Link
          href="/dashboard/accounting"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ফি আদায় ও কালেকশন</h1>
          <p className="text-slate-500 text-xs sm:text-sm">
            শিক্ষার্থীর বকেয়া চার্জ থেকে ফি গ্রহণ, ছাড় সমন্বয় ও মানি রিসিট প্রস্তুত
          </p>
        </div>
      </div>

      <CollectPaymentClient
        students={students || []}
        madrasaInfo={madrasaInfo}
        preselectedStudentId={params?.student_id}
      />
    </div>
  );
}
