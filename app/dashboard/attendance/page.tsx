import Link from "next/link";
import { Users, GraduationCap, CalendarDays, FileBarChart } from "lucide-react";

export default function AttendanceDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">উপস্থিতি (Attendance)</h1>
        <p className="text-slate-500">শিক্ষার্থী ও স্টাফদের দৈনিক উপস্থিতি পরিচালনা করুন</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/dashboard/attendance/students" className="block">
          <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:border-slate-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-blue-50 p-3 rounded-lg group-hover:bg-blue-100 transition">
                <GraduationCap className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">শিক্ষার্থী উপস্থিতি</h2>
            </div>
            <p className="text-sm text-slate-600">ক্লাস অনুযায়ী শিক্ষার্থীদের দৈনিক উপস্থিতি এন্ট্রি করুন।</p>
          </div>
        </Link>

        <Link href="/dashboard/attendance/teachers" className="block">
          <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:border-slate-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-emerald-50 p-3 rounded-lg group-hover:bg-emerald-100 transition">
                <Users className="w-6 h-6 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">স্টাফ উপস্থিতি</h2>
            </div>
            <p className="text-sm text-slate-600">শিক্ষক এবং অন্যান্য স্টাফদের দৈনিক উপস্থিতি রেকর্ড করুন।</p>
          </div>
        </Link>

        <Link href="/dashboard/attendance/reports" className="block">
          <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:border-slate-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-purple-50 p-3 rounded-lg group-hover:bg-purple-100 transition">
                <FileBarChart className="w-6 h-6 text-purple-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">উপস্থিতি রিপোর্ট</h2>
            </div>
            <p className="text-sm text-slate-600">মাসিক উপস্থিতির রিপোর্ট দেখুন এবং ডাউনলোড করুন।</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
