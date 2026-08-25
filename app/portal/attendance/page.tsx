import { createClient } from "@/lib/supabase/server";
import { Calendar, CheckCircle2, XCircle, Clock } from "lucide-react";

export default async function ParentPortalAttendance() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userData } = await supabase.from("users").select("madrasa_id").eq("id", user.id).single();
  const madrasaId = userData?.madrasa_id;

  const { data: students } = await supabase
    .from("students")
    .select("id")
    .eq("madrasa_id", madrasaId)
    .limit(1);

  const childId = students?.[0]?.id;

  if (!childId) return <div>No linked students found.</div>;

  const { data: attendanceLogs } = await supabase
    .from("attendance")
    .select("*")
    .eq("student_id", childId)
    .order("date", { ascending: false });

  const totalDays = attendanceLogs?.length || 0;
  const presentDays = attendanceLogs?.filter(log => log.status === 'Present').length || 0;
  const absentDays = attendanceLogs?.filter(log => log.status === 'Absent').length || 0;
  const lateDays = attendanceLogs?.filter(log => log.status === 'Late').length || 0;
  const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Attendance History</h1>
        <p className="text-slate-500">View your child's daily presence and absence records.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 rounded-lg border-none shadow-sm">
          <div className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
               <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Days</p>
              <p className="text-2xl font-bold text-slate-900">{totalDays}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-green-50 rounded-lg border-none shadow-sm">
          <div className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-green-200 text-green-700 rounded-full">
               <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-800">Present</p>
              <p className="text-2xl font-bold text-green-900">{presentDays}</p>
            </div>
          </div>
        </div>

        <div className="bg-red-50 rounded-lg border-none shadow-sm">
          <div className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-red-200 text-red-700 rounded-full">
               <XCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-800">Absent</p>
              <p className="text-2xl font-bold text-red-900">{absentDays}</p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 rounded-lg border-none shadow-sm">
          <div className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-amber-200 text-amber-700 rounded-full">
               <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-800">Attendance Rate</p>
              <p className="text-2xl font-bold text-amber-900">{attendancePercentage}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-800">Attendance Records</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-3 text-sm font-semibold text-slate-600">Date</th>
                <th className="px-6 py-3 text-sm font-semibold text-slate-600">Status</th>
                <th className="px-6 py-3 text-sm font-semibold text-slate-600">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attendanceLogs && attendanceLogs.length > 0 ? (
                attendanceLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-800">
                      {new Date(log.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        log.status === 'Present' ? 'bg-green-100 text-green-800' :
                        log.status === 'Absent' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {log.notes || '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                    No attendance records found.
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
