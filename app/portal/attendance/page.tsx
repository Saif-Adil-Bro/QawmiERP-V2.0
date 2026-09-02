import { createClient } from "@/lib/supabase/server";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  GraduationCap,
  CalendarCheck,
} from "lucide-react";
import Link from "next/link";
import { toBanglaNumber } from "@/lib/numberToBangla";

export const dynamic = "force-dynamic";

export default async function ParentPortalAttendance(props: {
  searchParams?: Promise<{ student_id?: string; month?: string }>;
}) {
  const params = props.searchParams ? (await props.searchParams) || {} : {};
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userData } = await supabase
    .from("users")
    .select("madrasa_id")
    .eq("id", user.id)
    .single();
  const madrasaId = userData?.madrasa_id;

  const { getUserDataAccessScope } = await import("@/lib/data-access-guards");
  const scope = await getUserDataAccessScope();

  let studentsQuery = supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, student_id, class_name, classes(name)")
    .eq("madrasa_id", madrasaId)
    .order("roll_number", { ascending: true });

  if (!scope.isUnrestricted) {
    if (scope.allowedStudentIds.length === 0) {
      return (
        <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
          কোন শিক্ষার্থী সংযুক্ত পাওয়া যায়নি।
        </div>
      );
    }
    studentsQuery = studentsQuery.in("id", scope.allowedStudentIds);
  }

  const { data: students } = await studentsQuery;

  if (!students || students.length === 0) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
        কোন শিক্ষার্থী সংযুক্ত পাওয়া যায়নি।
      </div>
    );
  }

  const selectedStudentId = params.student_id || students[0].id;
  const child = students.find((s) => s.id === selectedStudentId) || students[0];

  // Fetch attendance records
  const { data: attendanceLogs } = await supabase
    .from("attendance")
    .select("*")
    .eq("student_id", child.id)
    .order("date", { ascending: false });

  const totalDays = attendanceLogs?.length || 0;
  const presentDays = attendanceLogs?.filter((log) => log.status === "Present").length || 0;
  const absentDays = attendanceLogs?.filter((log) => log.status === "Absent").length || 0;
  const lateDays = attendanceLogs?.filter((log) => log.status === "Late").length || 0;
  const leaveDays = attendanceLogs?.filter((log) => log.status === "Leave").length || 0;
  const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">দৈনিক হাজিরা রেকর্ড ও উপস্থিতি</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            শিক্ষার্থী: <strong className="text-slate-800">{child.first_name} {child.last_name}</strong> (রোল: {toBanglaNumber(child.roll_number || child.student_id || "-")})
          </p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase">মোট কার্যদিবস</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900">{toBanglaNumber(totalDays)} দিন</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-emerald-600 uppercase">উপস্থিত</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-700">{toBanglaNumber(presentDays)} দিন</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-red-50 text-red-600 rounded-xl">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-red-600 uppercase">অনুপস্থিত</p>
            <p className="text-xl sm:text-2xl font-bold text-red-700">{toBanglaNumber(absentDays)} দিন</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-amber-600 uppercase">বিলম্ব / ছুটি</p>
            <p className="text-xl sm:text-2xl font-bold text-amber-700">{toBanglaNumber(lateDays + leaveDays)} দিন</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-purple-600 uppercase">উপস্থিতির হার</p>
            <p className="text-xl sm:text-2xl font-bold text-purple-800">{toBanglaNumber(attendancePercentage)}%</p>
          </div>
        </div>
      </div>

      {/* Attendance Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base">দৈনিক হাজিরার বিস্তারিত তালিকা</h3>
          <span className="text-xs text-slate-500 font-medium">সর্বশেষ এন্ট্রি প্রথম</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3.5">তারিখ ও বার</th>
                <th className="px-4 py-3.5">অবস্থা (Status)</th>
                <th className="px-4 py-3.5">মন্তব্য (Remarks)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {attendanceLogs && attendanceLogs.length > 0 ? (
                attendanceLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {new Date(log.date).toLocaleDateString("bn-BD", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          log.status === "Present"
                            ? "bg-emerald-100 text-emerald-800"
                            : log.status === "Absent"
                            ? "bg-red-100 text-red-800"
                            : log.status === "Late"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {log.status === "Present" ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : log.status === "Absent" ? (
                          <XCircle className="w-3.5 h-3.5" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {log.status === "Present"
                            ? "উপস্থিত"
                            : log.status === "Absent"
                            ? "অনুপস্থিত"
                            : log.status === "Late"
                            ? "বিলম্ব"
                            : "ছুটি"}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {log.notes || "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="text-center py-10 text-slate-400 text-sm">
                    কোন হাজিরার রেকর্ড পাওয়া যায়নি।
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
