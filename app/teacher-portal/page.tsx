import { createClient } from "@/lib/supabase/server";
import { Users, BookOpen, ClipboardList, TrendingUp } from "lucide-react";
import Link from "next/link";

export default async function TeacherPortalOverview() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userData } = await supabase.from("users").select("madrasa_id, full_name").eq("id", user.id).single();
  const madrasaId = userData?.madrasa_id;

  // Let's find the teacher record matching this user
  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, first_name, last_name")
    .eq("madrasa_id", madrasaId)
    .eq("email", user.email)
    .single();

  const teacherId = teacher?.id;

  // For overview: total assigned classes? Or just quick stats for the madrasa or teacher.
  // We'll show some quick links and stats.

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {teacher?.first_name || userData?.full_name || 'Teacher'}!</h1>
        <p className="text-slate-500">Manage your daily classes, attendance, and student progress.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/teacher-portal/attendance" className="block group">
          <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Take Attendance</h3>
            <p className="text-sm text-slate-500 mt-2">Mark daily presence and absence for your students.</p>
          </div>
        </Link>

        <Link href="/teacher-portal/hifz" className="block group">
          <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <BookOpen className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Daily Sabak</h3>
            <p className="text-sm text-slate-500 mt-2">Update Hifz lessons, Sabak, and Amukhta progress.</p>
          </div>
        </Link>

        <Link href="/teacher-portal/exams" className="block group">
          <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <ClipboardList className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Exam Marks</h3>
            <p className="text-sm text-slate-500 mt-2">Enter student marks for terminal and annual exams.</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
