import { createClient } from "@/lib/supabase/server";
import { BookOpen } from "lucide-react";
import Link from "next/link";

export default async function AssignmentsDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Academic Assignments (অ্যাসাইনমেন্ট)</h1>
        <p className="text-slate-500">Manage class subjects and teacher assignments.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-slate-800">Class Subjects</h2>
              <p className="text-sm text-slate-500">Assign subjects to classes</p>
            </div>
          </div>
          <Link
            href="/dashboard/classes"
            className="mt-auto bg-slate-50 hover:bg-slate-100 border text-center py-2 rounded-lg text-sm font-medium text-slate-700 transition-colors"
          >
            Manage via Classes →
          </Link>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-slate-800">Teacher Assignments</h2>
              <p className="text-sm text-slate-500">Assign teachers to class subjects</p>
            </div>
          </div>
          <Link
            href="/dashboard/teachers"
            className="mt-auto bg-slate-50 hover:bg-slate-100 border text-center py-2 rounded-lg text-sm font-medium text-slate-700 transition-colors"
          >
            Manage via Teachers →
          </Link>
        </div>
      </div>
    </div>
  );
}
