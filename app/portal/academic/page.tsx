import { createClient } from "@/lib/supabase/server";
import { BookOpen, Award, FileText } from "lucide-react";

export default async function ParentPortalAcademic() {
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

  // Fetch Hifz Logs
  const { data: hifzLogs } = await supabase
    .from("hifz_logs")
    .select("*, teachers(first_name, last_name)")
    .eq("student_id", childId)
    .order("log_date", { ascending: false });

  // Fetch Exam Results
  const { data: examResults } = await supabase
    .from("exam_results")
    .select("*, exams(title, year, status)")
    .eq("student_id", childId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Academic & Hifz Progress</h1>
        <p className="text-slate-500">Track Sabak logs and recent examination results.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Hifz Progress Section */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center">
              <BookOpen className="w-5 h-5 mr-2 text-indigo-600" />
              Daily Hifz Logs (সবক)
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[600px] p-0">
            {hifzLogs && hifzLogs.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {hifzLogs.map(log => (
                  <li key={log.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold text-slate-800 text-sm">
                        {new Date(log.log_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                        log.performance_rating === 'Excellent' ? 'bg-green-100 text-green-700' :
                        log.performance_rating === 'Good' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {log.performance_rating || 'Not Rated'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 bg-slate-50 p-3 rounded-md border border-slate-100">
                      <div>
                        <div className="text-xs text-slate-500">Sabak Para</div>
                        <div className="font-medium text-sm text-slate-800">{log.sabak_para || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Saboki Para</div>
                        <div className="font-medium text-sm text-slate-800">{log.saboki_para || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Amukhta Para</div>
                        <div className="font-medium text-sm text-slate-800">{log.amukhta_para || '-'}</div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-slate-500 flex items-center">
                      <FileText className="w-3 h-3 mr-1" />
                      <span className="italic">{log.notes || 'No specific remarks.'}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">
                No Hifz logs found.
              </div>
            )}
          </div>
        </div>

        {/* Exam Results Section */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col">
           <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center">
              <Award className="w-5 h-5 mr-2 text-indigo-600" />
              Examination Results (ফলাফল)
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[600px] p-0">
             {examResults && examResults.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {examResults.map(result => {
                  const percentage = (result.marks_obtained / result.total_marks) * 100;
                  const isPass = percentage >= 40; // Example pass mark

                  return (
                    <li key={result.id} className="p-6 hover:bg-slate-50 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-slate-800">{result.exams?.title || 'Unknown Exam'} ({result.exams?.year})</h3>
                          <p className="text-sm text-slate-500 mt-1">{result.subject_name}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          isPass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {isPass ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-md border border-slate-100 flex justify-between items-center">
                        <div>
                          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Marks Obtained</div>
                          <div className="text-2xl font-bold text-slate-900">
                            {result.marks_obtained} <span className="text-sm font-medium text-slate-400">/ {result.total_marks}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Percentage</div>
                          <div className={`text-xl font-bold ${percentage >= 80 ? 'text-indigo-600' : 'text-slate-700'}`}>
                            {percentage.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">
                No examination results published yet.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
