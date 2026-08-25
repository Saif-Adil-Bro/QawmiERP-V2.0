import { getHifzLogs } from "@/app/actions/hifz";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { format } from "date-fns";
import AddLogForm from "./AddLogForm";
import { HifzDeleteButton } from "@/components/hifz/hifz-actions";

export default async function StudentHifzLogsPage({ params }: { params: Promise<{ studentId: string }> }) {
  const resolvedParams = await params;
  const studentId = resolvedParams.studentId;
  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("id, first_name, last_name, roll_number")
    .eq("id", studentId)
    .single();

  if (!student) {
    return <div>শিক্ষার্থী পাওয়া যায়নি।</div>;
  }

  const logs = await getHifzLogs(studentId);

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/dashboard/hifz" className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {student.first_name} {student.last_name}
          </h1>
          <p className="text-slate-500 text-sm">রোল নম্বর: {student.roll_number || 'N/A'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">দৈনন্দিন লগ যুক্ত করুন</h2>
            <AddLogForm studentId={student.id} />
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-lg font-bold text-slate-800">সাম্প্রতিক লগগুলো</h2>
            </div>
            
            {logs.length === 0 ? (
              <div className="p-8 text-center text-slate-500">কোনো লগ রেকর্ড করা হয়নি।</div>
            ) : (
              <div className="divide-y">
                {logs.map((log) => (
                  <div key={log.id} className="p-6 hover:bg-slate-50 transition">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-slate-800">
                        {format(new Date(log.log_date), "EEEE, MMMM d, yyyy")}
                      </div>
                      <div className="flex items-center space-x-3">
                        {log.performance_rating && (
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            log.performance_rating === 'Excellent' ? 'bg-green-100 text-green-800' :
                            log.performance_rating === 'Good' ? 'bg-blue-100 text-blue-800' :
                            log.performance_rating === 'Average' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {log.performance_rating === 'Excellent' ? 'চমৎকার' :
                             log.performance_rating === 'Good' ? 'ভালো' :
                             log.performance_rating === 'Average' ? 'মোটামুটি' : 'খারাপ'}
                          </span>
                        )}
                        <HifzDeleteButton logId={log.id} studentId={studentId} />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <div className="text-xs text-slate-500 mb-1">সবক (পারা)</div>
                        <div className="font-medium">{log.sabak_para || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">সবক (পৃষ্ঠা)</div>
                        <div className="font-medium">{log.sabak_page || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">সবকী (পারা)</div>
                        <div className="font-medium">{log.saboki_para || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">আমুখতা (পারা)</div>
                        <div className="font-medium">{log.amukhta_para || '-'}</div>
                      </div>
                    </div>
                    
                    {log.notes && (
                      <div className="mt-4 text-sm text-slate-600 bg-slate-50 p-3 rounded-md">
                        {log.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
