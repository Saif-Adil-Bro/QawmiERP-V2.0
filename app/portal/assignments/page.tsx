import { getAssignments } from "@/app/actions/assignments";
import ParentAssignmentsClient from "./ParentAssignmentsClient";
import { AlertCircle } from "lucide-react";
import { getPortalStudentData } from "@/lib/portal-data";

export const dynamic = "force-dynamic";

export default async function ParentAssignmentsPage(props: {
  searchParams?: Promise<{ student_id?: string }>;
}) {
  const params = props.searchParams ? (await props.searchParams) || {} : {};
  const portalData = await getPortalStudentData(params.student_id);

  if (!portalData || !portalData.user) return null;

  const { students, child, madrasaId } = portalData;

  if (students.length === 0 || !child) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl shadow-xs border border-slate-200 text-center">
        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mb-3">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">কোন শিক্ষার্থীর তথ্য পাওয়া যায়নি</h2>
        <p className="text-sm text-slate-500 mt-1">
          অনুগ্রহ করে মাদরাসা কর্তৃপক্ষের সাথে যোগাযোগ করে আপনার সন্তানের প্রোফাইল লিঙ্ক করুন।
        </p>
      </div>
    );
  }

  const { assignments } = await getAssignments();

  return (
    <ParentAssignmentsClient
      students={students}
      initialAssignments={assignments}
      selectedStudentId={params.student_id}
    />
  );
}
