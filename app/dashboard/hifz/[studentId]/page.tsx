import { getHifzLogs } from "@/app/actions/hifz";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { format } from "date-fns";
import AddLogForm from "./AddLogForm";
import { HifzLogActions } from "@/components/hifz/hifz-actions";

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
              <div className="divide-y divide-slate-100">
                {logs.map((log) => {
                  const stageLabels: Record<string, string> = {
                    HIFZ: "হিফজ (চলমান)",
                    QAIDA: "কায়দা / আমপারা",
                    NAZERA: "নাজেরা",
                    DAWR: "দাওর / খতম রিভিশন",
                  };
                  const stageName = stageLabels[log.hifz_stage] || log.hifz_stage || "হিফজ";

                  const sabakPageRange =
                    log.sabak_page_from && log.sabak_page_to
                      ? log.sabak_page_from === log.sabak_page_to
                        ? `পৃষ্ঠা ${log.sabak_page_from}`
                        : `পৃষ্ঠা ${log.sabak_page_from} হতে ${log.sabak_page_to}`
                      : log.sabak_page
                      ? `পৃষ্ঠা ${log.sabak_page}`
                      : "";

                  return (
                    <div key={log.id} className="p-6 hover:bg-slate-50/80 transition space-y-3">
                      {/* Header row */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-sm sm:text-base">
                            {format(new Date(log.log_date), "EEEE, d MMMM yyyy")}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {stageName}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          {log.performance_rating && (
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                log.performance_rating === "Excellent"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : log.performance_rating === "Good"
                                  ? "bg-blue-100 text-blue-800 border border-blue-200"
                                  : log.performance_rating === "Average"
                                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                                  : "bg-rose-100 text-rose-800 border border-rose-200"
                              }`}
                            >
                              {log.performance_rating === "Excellent"
                                ? "চমৎকার (মুমতাজ)"
                                : log.performance_rating === "Good"
                                ? "ভালো (জায়্যিদ জিদ্দান)"
                                : log.performance_rating === "Average"
                                ? "মোটামুটি (জায়্যিদ)"
                                : "দুর্বল (তাকীদ)"}
                            </span>
                          )}
                          <HifzLogActions log={log} studentId={studentId} />
                        </div>
                      </div>

                      {/* Info Badges & Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        {/* 1. Sabak Card */}
                        <div className="p-3 bg-emerald-50/50 border border-emerald-100/80 rounded-xl space-y-1">
                          <div className="text-[11px] font-bold text-emerald-900 uppercase">১. সবক (নতুন পাঠ)</div>
                          {log.is_sabak_paused ? (
                            <span className="inline-block text-xs font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200">
                              আজ সবক বন্ধ ছিল (রিভিশন)
                            </span>
                          ) : log.sabak_para || sabakPageRange ? (
                            <div className="text-xs font-semibold text-slate-800 space-y-0.5">
                              {log.sabak_para && <div>পারা: <span className="font-bold text-emerald-700">{log.sabak_para}</span></div>}
                              {sabakPageRange && <div>{sabakPageRange} {log.sabak_lines ? `(${log.sabak_lines})` : ""}</div>}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400">—</div>
                          )}
                        </div>

                        {/* 2. Saboki Card */}
                        <div className="p-3 bg-indigo-50/50 border border-indigo-100/80 rounded-xl space-y-1">
                          <div className="text-[11px] font-bold text-indigo-900 uppercase">২. সবকী (সাত সবক)</div>
                          {log.saboki_para || log.saboki_pages ? (
                            <div className="text-xs font-semibold text-slate-800 space-y-0.5">
                              {log.saboki_para && <div>পারা: <span className="font-bold text-indigo-700">{log.saboki_para}</span></div>}
                              {log.saboki_pages && <div>পরিমাণ: {log.saboki_pages}</div>}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400">—</div>
                          )}
                        </div>

                        {/* 3. Amukhta Card */}
                        <div className="p-3 bg-purple-50/50 border border-purple-100/80 rounded-xl space-y-1">
                          <div className="text-[11px] font-bold text-purple-900 uppercase">৩. আমুখতা (পুরাতন পাঠ)</div>
                          {log.amukhta_para || log.amukhta_amount || log.mistake_count > 0 ? (
                            <div className="text-xs font-semibold text-slate-800 space-y-1">
                              {log.amukhta_para && <div>পারা: <span className="font-bold text-purple-700">{log.amukhta_para}</span></div>}
                              {log.amukhta_amount && <div>পরিমাণ: {log.amukhta_amount}</div>}
                              {log.mistake_count > 0 && (
                                <div>
                                  <span className="inline-block text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200">
                                    লোকমা / ভুল: {log.mistake_count} টি
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400">—</div>
                          )}
                        </div>
                      </div>

                      {/* Daily Tilawat & Clean Notes */}
                      {(log.daily_tilawat || log.clean_notes) && (
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1 text-xs">
                          {log.daily_tilawat && (
                            <div className="font-semibold text-slate-700">
                              📖 <span className="text-slate-500">দৈনিক তেলাওয়াত:</span>{" "}
                              <span className="text-emerald-800 font-bold">{log.daily_tilawat}</span>
                            </div>
                          )}
                          {log.clean_notes && (
                            <div className="text-slate-600 font-medium pt-0.5">
                              💬 <span className="text-slate-500 font-semibold">উস্তাদের মন্তব্য:</span>{" "}
                              {log.clean_notes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
