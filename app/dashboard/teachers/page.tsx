import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { getStaffMetadataFull } from "@/app/actions/staff";
import Link from "next/link";
import { Plus, Search, Edit, Briefcase, ChevronRight, UserCheck } from "lucide-react";
import { TeacherDeleteButton } from "@/components/teachers/teacher-actions";
import PermissionGuard from "@/components/permissions/PermissionGuard";

export default async function TeachersPage() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  
  let teachers: any[] = [];
  let madrasaId: string | null = null;

  if (user) {
    madrasaId = await getAuthMadrasaId(supabase, user);
  }

  // Sync staff metadata with SQL table
  const staffData = await getStaffMetadataFull();
  const staffMembers = staffData?.staff_members || [];

  if (madrasaId) {
    const { data } = await supabase
      .from("teachers")
      .select("*")
      .eq("madrasa_id", madrasaId)
      .order("created_at", { ascending: false });
    teachers = data || [];
  } else {
    const { data } = await supabase
      .from("teachers")
      .select("*")
      .order("created_at", { ascending: false });
    teachers = data || [];
  }

  // Merge staff_members from HR module into teacher list if not already present
  const existingTeacherIds = new Set(teachers.map((t) => t.id));
  staffMembers.forEach((s) => {
    if (!existingTeacherIds.has(s.id)) {
      teachers.push({
        id: s.id,
        first_name: s.personal.first_name || s.personal.full_name_bn || "শিক্ষক",
        last_name: s.personal.last_name || "",
        designation: s.employment.designation || "শিক্ষক",
        phone: s.contact?.phone || "-",
        email: s.contact?.email || "",
        created_at: s.created_at,
      });
    }
  });

  return (
    <PermissionGuard permission="teacher.view">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <span>শিক্ষক তালিকা</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                মোট: {teachers.length} জন
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">মাদ্রাসার সকল ওস্তাদ, শিক্ষক ও কর্মকর্তা ডিরেক্টরি</p>
          </div>
          <div className="flex items-center gap-2">
            <PermissionGuard permission="staff.view" hideFallback>
              <Link
                href="/dashboard/staff"
                className="bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-emerald-800 flex items-center space-x-1.5 transition shadow-xs"
              >
                <Briefcase className="w-4 h-4" />
                <span>সমন্বিত শিক্ষক ও স্টাফ (HR) মডিউল</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </PermissionGuard>
            <PermissionGuard permission="teacher.create" hideFallback>
              <Link href="/dashboard/teachers/new" className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-800 flex items-center space-x-2 transition">
                <Plus className="w-4 h-4" />
                <span>নতুন শিক্ষক যুক্ত করুন</span>
              </Link>
            </PermissionGuard>
          </div>
        </div>

        {/* Integration Notification Card */}
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 flex items-center justify-between text-xs text-emerald-900 gap-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              <strong>একীভূত মানবসম্পদ (Unified HR):</strong> শিক্ষক ও সাধারণ স্টাফ ডাটাবেজ এখন কেন্দ্রীয়ভাবে সংরক্ষিত। শিক্ষকগণের পূর্ণাঙ্গ সার্ভিস বুক, পে-রোল ও ডিজিটাল আইডি কার্ডের জন্য শিক্ষক ও স্টাফ মডিউল ব্যবহার করুন।
            </span>
          </div>
          <Link
            href="/dashboard/staff"
            className="shrink-0 px-3 py-1 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-lg font-bold transition"
          >
            এইচআর ড্যাশবোর্ড খুলুন
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="নাম বা পদবী দিয়ে খুঁজুন..." 
                className="w-full pl-9 pr-4 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b">
                <tr>
                  <th className="px-6 py-3">নাম</th>
                  <th className="px-6 py-3">পদবী / দায়িত্ব</th>
                  <th className="px-6 py-3">ফোন</th>
                  <th className="px-6 py-3 text-right">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700">
                {teachers && teachers.length > 0 ? (
                  teachers.map((teacher) => (
                    <tr key={teacher.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {teacher.first_name} {teacher.last_name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                          {teacher.designation || 'সাধারণ'}
                        </span>
                      </td>
                      <td className="px-6 py-4">{teacher.phone || '-'}</td>
                      <td className="px-6 py-4 text-right flex items-center justify-end space-x-4">
                        <PermissionGuard permission="academic.manage" hideFallback>
                          <Link 
                            href={`/dashboard/teachers/${teacher.id}/subjects`}
                            className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 transition-colors"
                          >
                            Assign Subjects
                          </Link>
                        </PermissionGuard>
                        <PermissionGuard permission="teacher.edit" hideFallback>
                          <Link 
                            href={`/dashboard/teachers/${teacher.id}/edit`} 
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition"
                            title="সম্পাদনা করুন"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                        </PermissionGuard>
                        <PermissionGuard permission="teacher.edit" hideFallback>
                          <TeacherDeleteButton id={teacher.id} />
                        </PermissionGuard>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <p className="text-slate-500 mb-2">কোনো শিক্ষক/স্টাফ পাওয়া যায়নি</p>
                      <p className="text-xs text-slate-400">নতুন স্টাফ নিবন্ধন করতে "নতুন যুক্ত করুন" এ ক্লিক করুন।</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}
