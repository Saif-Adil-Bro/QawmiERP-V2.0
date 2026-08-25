import { createClient } from "@/lib/supabase/server";
import { GraduationCap, Book, Calendar, CreditCard, AlertCircle } from "lucide-react";
import Link from "next/link";

export default async function PortalOverview() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get user's madrasa
  const { data: userData } = await supabase.from("users").select("madrasa_id").eq("id", user.id).single();
  const madrasaId = userData?.madrasa_id;

  // For demonstration, we just pick the first student in the madrasa as the "child"
  // In a real app, there would be a junction table or parent_id on the student record
  const { data: students } = await supabase
    .from("students")
    .select("*, classes(name)")
    .eq("madrasa_id", madrasaId)
    .limit(1);

  const child = students?.[0];

  if (!child) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white rounded-lg shadow-sm border border-slate-200">
        <AlertCircle className="w-12 h-12 text-slate-400 mb-4" />
        <h2 className="text-xl font-semibold text-slate-800">No linked students found</h2>
        <p className="text-slate-500 mt-2">Please contact the Madrasa administration to link your child to your account.</p>
      </div>
    );
  }

  // Fetch recent attendance
  const { data: attendance } = await supabase
    .from("attendance")
    .select("*")
    .eq("student_id", child.id)
    .order("date", { ascending: false })
    .limit(5);

  // Fetch recent hifz logs
  const { data: hifzLogs } = await supabase
    .from("hifz_logs")
    .select("*")
    .eq("student_id", child.id)
    .order("log_date", { ascending: false })
    .limit(1);

  // Fetch recent fees
  const { data: fees } = await supabase
    .from("fees")
    .select("*")
    .eq("student_id", child.id)
    .order("payment_date", { ascending: false })
    .limit(1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome to Parent Portal</h1>
        <p className="text-slate-500">Here is the overview of your child's academic progress.</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex items-center space-x-6">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
          <GraduationCap className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">{child.first_name} {child.last_name}</h2>
          <div className="flex space-x-4 mt-2 text-sm text-slate-600">
            <p><strong>Roll:</strong> {child.roll_number || 'N/A'}</p>
            <p><strong>Class:</strong> {child.classes?.name || child.class_name || 'N/A'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Attendance Summary */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="flex flex-row items-center justify-between p-6 pb-2 border-b border-slate-100">
            <h3 className="text-sm font-medium text-slate-600">Recent Attendance</h3>
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>
          <div className="p-6 pt-4">
            {attendance && attendance.length > 0 ? (
              <ul className="space-y-3 mt-2">
                {attendance.map((record) => (
                  <li key={record.id} className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">{new Date(record.date).toLocaleDateString()}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      record.status === 'Present' ? 'bg-green-100 text-green-700' :
                      record.status === 'Absent' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {record.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 mt-2">No recent attendance records.</p>
            )}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <Link href="/portal/attendance" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                View Full Attendance &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* Hifz Progress */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="flex flex-row items-center justify-between p-6 pb-2 border-b border-slate-100">
            <h3 className="text-sm font-medium text-slate-600">Latest Hifz Sabak</h3>
            <Book className="w-4 h-4 text-slate-400" />
          </div>
          <div className="p-6 pt-4">
            {hifzLogs && hifzLogs.length > 0 ? (
              <div className="mt-2 space-y-2">
                <div className="text-sm">
                  <span className="text-slate-500">Date:</span>
                  <span className="font-medium text-slate-800 ml-2">{new Date(hifzLogs[0].log_date).toLocaleDateString()}</span>
                </div>
                {hifzLogs[0].sabak_para && (
                  <div className="text-sm">
                    <span className="text-slate-500">Sabak Para:</span>
                    <span className="font-medium text-slate-800 ml-2">{hifzLogs[0].sabak_para}</span>
                  </div>
                )}
                <div className="text-sm">
                  <span className="text-slate-500">Performance:</span>
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                    hifzLogs[0].performance_rating === 'Excellent' ? 'bg-green-100 text-green-700' :
                    hifzLogs[0].performance_rating === 'Good' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {hifzLogs[0].performance_rating || 'N/A'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-2">No recent Hifz logs found.</p>
            )}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <Link href="/portal/academic" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                View All Records &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* Fee Status */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="flex flex-row items-center justify-between p-6 pb-2 border-b border-slate-100">
            <h3 className="text-sm font-medium text-slate-600">Recent Payment</h3>
            <CreditCard className="w-4 h-4 text-slate-400" />
          </div>
          <div className="p-6 pt-4">
             {fees && fees.length > 0 ? (
              <div className="mt-2 space-y-2">
                <div className="text-2xl font-bold text-slate-800">
                  ৳{fees[0].amount}
                </div>
                <div className="text-sm text-slate-500">
                  Paid on {new Date(fees[0].payment_date).toLocaleDateString()}
                </div>
                <div className="text-sm text-slate-600 mt-2">
                  <span className="font-medium">Type:</span> {fees[0].fee_type}
                </div>
                {fees[0].fee_month && (
                  <div className="text-sm text-slate-600">
                    <span className="font-medium">Month:</span> {fees[0].fee_month} {fees[0].fee_year}
                  </div>
                )}
              </div>
             ) : (
               <p className="text-sm text-slate-500 mt-2">No recent payment records.</p>
             )}
             <div className="mt-4 pt-4 border-t border-slate-100">
              <Link href="/portal/fees" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                View Fee History &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
