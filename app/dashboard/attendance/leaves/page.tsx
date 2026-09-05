import { getAllLeaveData } from "@/app/actions/leaves";
import LeaveManagementClient from "./LeaveManagementClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ছুটির দরখাস্ত ও অনুমোদন ব্যবস্থাপনা | QawmiERP",
  description: "শিক্ষক এবং শিক্ষার্থীদের ছুটির আবেদন অনুমোদন, সময়সীমা পরিবর্তন, মন্তব্য ও স্বয়ংক্রিয় হাজিরা সিঙ্ক সিস্টেম",
};

export default async function LeaveManagementPage() {
  const data = await getAllLeaveData();

  if ("error" in data) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-rose-200 text-rose-700">
        <h2 className="text-lg font-bold mb-1">ছুটির তথ্য লোড করতে সমস্যা হয়েছে</h2>
        <p className="text-xs">{data.error}</p>
      </div>
    );
  }

  return (
    <LeaveManagementClient
      initialStudentLeaves={data.studentLeaves || []}
      initialTeacherLeaves={data.teacherLeaves || []}
      students={data.students || []}
      teachers={data.teachers || []}
      classes={data.classes || []}
    />
  );
}
