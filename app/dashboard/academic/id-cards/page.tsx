import { createClient } from "@/lib/supabase/server";
import IdCardClient from "./IdCardClient";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import { getIdCardsData } from "@/app/actions/id-card-management";
import { getStudents } from "@/app/actions/students";

export const metadata = {
  title: "আইডি কার্ড ও ডিজিটাল আইডি সিস্টেম | QawmiERP",
};

export default async function IdCardsPage(props: {
  searchParams?: Promise<{ class_id?: string; user_type?: string; status?: string; search?: string }>;
}) {
  const params = props.searchParams ? (await props.searchParams) || {} : {};
  const supabase = await createClient();
  const madrasaInfo = await getMadrasaInfo();

  const { data: classes } = await supabase.from("classes").select("id, name").order("name");

  const classId = params?.class_id;
  const userType = params?.user_type || "Student";
  const status = params?.status || "ALL";
  const search = params?.search || "";

  // Fetch all registered ID cards and statistics
  const idCardData = await getIdCardsData({
    class_id: classId,
    status: status,
    search: search,
  });

  // Fetch student records for issue/reissue modals
  const students = await getStudents();

  let users = [];
  if (userType === "Student" && classId && classId !== "ALL") {
    const { data } = await supabase.from("students").select("*, classes(name)").eq("class_id", classId);
    users = data || [];
  } else if (userType === "Teacher") {
    const { data } = await supabase.from("teachers").select("*");
    users = data || [];
  } else if (userType === "Student") {
    const { data } = await supabase.from("students").select("*, classes(name)").limit(20);
    users = data || [];
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">স্টুডেন্ট আইডি কার্ড ও কিউআর সিস্টেম</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            ডিজিটাল ও প্রিন্ট আইডি কার্ড তৈরি, লাইফসাইকেল ম্যানেজমেন্ট, বাল্ক জেনারেটর এবং কিউআর কোড ভেরিফিকেশন
          </p>
        </div>
      </div>

      <IdCardClient
        initialData={idCardData}
        allStudents={students}
        classes={classes || []}
        users={users}
        userType={userType}
        madrasaInfo={madrasaInfo}
      />
    </div>
  );
}
