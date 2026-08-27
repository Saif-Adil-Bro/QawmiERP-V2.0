"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Calendar, Edit3, Trash2, Printer, CheckCircle2, User, Award, Plus } from "lucide-react";
import { format } from "date-fns";
import AddKitabLogForm from "@/app/dashboard/kitab/[studentId]/AddLogForm";
import { KitabDeleteButton, EditKitabLogModal } from "@/components/kitab/kitab-actions";
import { useRouter } from "next/navigation";

interface StudentKitabLogsClientProps {
  student: any;
  logs: any[];
}

export default function StudentKitabLogsClient({
  student,
  logs,
}: StudentKitabLogsClientProps) {
  const router = useRouter();
  const [editingLog, setEditingLog] = useState<any | null>(null);

  const handleRefresh = () => {
    router.refresh();
  };

  // Performance calculations
  const totalLogs = logs.length;
  const excellentCount = logs.filter((l) => l.performance_rating === "Excellent").length;
  const goodCount = logs.filter((l) => l.performance_rating === "Good").length;
  const uniqueKitabs = Array.from(new Set(logs.map((l) => l.kitab_name).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/kitab"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition border border-slate-200/60"
            title="কিতাব তালিকায় ফিরে যান"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">
                {student.first_name} {student.last_name}
              </h1>
              <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
                {student.class_name || student.classes?.name || "কিতাব বিভাগ"}
              </span>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              রোল নম্বর: <span className="font-bold text-slate-700">{student.roll_number || 'N/A'}</span> | পিতা: <span className="text-slate-700">{student.father_name || 'N/A'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link
            href={`/dashboard/students/${student.id}`}
            className="text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl transition flex items-center gap-1.5"
          >
            <User className="w-3.5 h-3.5" />
            <span>প্রোফাইল দেখুন</span>
          </Link>

          <button
            onClick={() => window.print()}
            className="text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 p-2 rounded-xl transition"
            title="প্রিন্ট করুন"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">মোট সবক রেকর্ড</div>
          <div className="text-lg font-black text-slate-800 mt-1">{totalLogs} টি</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">পঠিত কিতাবসমূহ</div>
          <div className="text-lg font-black text-slate-800 mt-1">{uniqueKitabs.length} টি</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-emerald-600 font-medium">চমৎকার (Excellent)</div>
          <div className="text-lg font-black text-emerald-700 mt-1">{excellentCount} টি</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-blue-600 font-medium">ভালো (Good)</div>
          <div className="text-lg font-black text-blue-700 mt-1">{goodCount} টি</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Add New Log */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <Plus className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-800">নতুন কিতাব সবক / লগ এন্ট্রি</h2>
            </div>
            <AddKitabLogForm studentId={student.id} />
          </div>
        </div>

        {/* Right Column: Logs History with Edit & Delete */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-slate-600" />
                <h2 className="text-sm font-bold text-slate-800">সাম্প্রতিক কিতাব সবক ও পাঠের ইতিহাস</h2>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                মোট {logs.length} টি
              </span>
            </div>
            
            {logs.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <BookOpen className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-sm font-medium text-slate-700">এখনও কোনো কিতাব সবক রেকর্ড করা হয়নি</p>
                <p className="text-xs text-slate-400">বামপাশের ফর্ম পূরণ করে প্রথম সবকটি রেকর্ড করুন।</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <div key={log.id} className="p-5 hover:bg-slate-50/60 transition group">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="font-bold text-slate-800 text-sm">
                          {log.log_date ? format(new Date(log.log_date), "EEEE, dd MMMM yyyy") : "-"}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {log.performance_rating && (
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            log.performance_rating === 'Excellent' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            log.performance_rating === 'Good' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                            log.performance_rating === 'Average' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}>
                            {log.performance_rating === 'Excellent' ? 'চমৎকার' :
                             log.performance_rating === 'Good' ? 'ভালো' :
                             log.performance_rating === 'Average' ? 'মোটামুটি' : 'উন্নতি প্রয়োজন'}
                          </span>
                        )}

                        {/* Edit Button */}
                        <button
                          onClick={() => setEditingLog(log)}
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition"
                          title="লগ সম্পাদনা করুন"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <KitabDeleteButton 
                          logId={log.id} 
                          studentId={student.id} 
                          onDeleted={handleRefresh}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/80 p-3.5 rounded-lg border border-slate-200/60">
                      <div className="sm:col-span-1">
                        <div className="text-[11px] font-medium text-slate-500 mb-0.5">কিতাবের নাম</div>
                        <div className="font-bold text-slate-900 text-sm">{log.kitab_name}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-slate-500 mb-0.5">পৃষ্ঠা (শুরু)</div>
                        <div className="font-semibold text-slate-700 text-sm">{log.page_from || '১'}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-slate-500 mb-0.5">পৃষ্ঠা (শেষ)</div>
                        <div className="font-semibold text-slate-700 text-sm">{log.page_to || '-'}</div>
                      </div>
                    </div>
                    
                    {log.notes && (
                      <div className="mt-3 text-xs text-slate-600 bg-white border border-slate-100 p-2.5 rounded-md">
                        <span className="font-bold text-slate-700">মন্তব্য: </span>
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

      {/* Edit Log Modal */}
      <EditKitabLogModal
        log={editingLog}
        isOpen={!!editingLog}
        onClose={() => setEditingLog(null)}
        onUpdated={handleRefresh}
      />
    </div>
  );
}
