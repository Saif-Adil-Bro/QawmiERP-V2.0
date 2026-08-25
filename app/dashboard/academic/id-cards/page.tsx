import { createClient } from "@/lib/supabase/server";
import PrintButton from "@/app/components/PrintButton";
import IdCardClient from "./IdCardClient";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";

export default async function IdCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ class_id?: string; user_type?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const madrasaInfo = await getMadrasaInfo();

  const { data: classes } = await supabase.from("classes").select("id, name");

  const classId = params?.class_id;
  const userType = params?.user_type || "Student";

  let users = [];

  if (userType === "Student" && classId) {
    const { data } = await supabase.from("students").select("*, classes(name)").eq("class_id", classId);
    users = data || [];
  } else if (userType === "Teacher") {
    const { data } = await supabase.from("teachers").select("*");
    users = data || [];
  } else if (userType === "Student") {
    const { data } = await supabase.from("students").select("*, classes(name)").limit(10); // Show max 10 initially if no class
    users = data || [];
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">আইডি কার্ড জেনারেটর (ID Cards)</h1>
          <p className="text-slate-500">শিক্ষার্থী ও শিক্ষকদের জন্য ডিজিটাল আইডি কার্ড তৈরি এবং প্রিন্ট করুন</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm print:hidden">
        <form className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">কার জন্য?</label>
            <select name="user_type" className="w-full p-2 border rounded-md" defaultValue={userType}>
              <option value="Student">ছাত্র (Student)</option>
              <option value="Teacher">শিক্ষক (Teacher)</option>
            </select>
          </div>
          {userType === "Student" && (
             <div>
               <label className="block text-sm font-medium text-slate-700 mb-1">জামাত (Class)</label>
               <select name="class_id" className="w-full p-2 border rounded-md" defaultValue={classId || ""}>
                 <option value="">সকল জামাত</option>
                 {classes?.map((c) => (
                   <option key={c.id} value={c.id}>{c.name}</option>
                 ))}
               </select>
             </div>
          )}
          <div>
            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition">
              খুঁজুন
            </button>
          </div>
        </form>
      </div>

      
      <IdCardClient users={users} userType={userType} madrasaInfo={madrasaInfo} />
    </div>
  );
}
