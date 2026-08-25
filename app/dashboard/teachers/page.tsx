import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Search, Edit } from "lucide-react";
import { TeacherDeleteButton } from "@/components/teachers/teacher-actions";

export default async function TeachersPage() {
  const supabase = await createClient();
  
  const { data: teachers } = await supabase
    .from("teachers")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">শিক্ষক ও স্টাফ</h1>
        <Link href="/dashboard/teachers/new" className="bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800 flex items-center space-x-2 transition">
          <Plus className="w-4 h-4" />
          <span>নতুন যুক্ত করুন</span>
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
                      <Link 
                        href={`/dashboard/teachers/${teacher.id}/subjects`}
                        className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 transition-colors"
                      >
                        Assign Subjects
                      </Link>
                      <Link 
                        href={`/dashboard/teachers/${teacher.id}/edit`} 
                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition"
                        title="সম্পাদনা করুন"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                      <TeacherDeleteButton id={teacher.id} />
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
  );
}
