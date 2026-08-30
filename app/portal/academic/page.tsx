import { createClient } from "@/lib/supabase/server";
import {
  BookOpen,
  Award,
  Calendar,
  Star,
  CheckCircle2,
  FileText,
  User,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";
import { toBanglaNumber } from "@/lib/numberToBangla";

export const dynamic = "force-dynamic";

export default async function ParentPortalAcademic(props: {
  searchParams?: Promise<{ student_id?: string; tab?: string }>;
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

  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, student_id, class_name, classes(name)")
    .eq("madrasa_id", madrasaId)
    .order("roll_number", { ascending: true });

  if (!students || students.length === 0) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
        কোন শিক্ষার্থী সংযুক্ত পাওয়া যায়নি।
      </div>
    );
  }

  const selectedStudentId = params.student_id || students[0].id;
  const child = students.find((s) => s.id === selectedStudentId) || students[0];
  const activeTab = params.tab || "hifz";

  // Fetch Hifz Logs
  const { data: hifzLogs } = await supabase
    .from("hifz_logs")
    .select("*, teachers(first_name, last_name)")
    .eq("student_id", child.id)
    .order("log_date", { ascending: false });

  // Fetch Kitab Logs
  const { data: kitabLogs } = await supabase
    .from("kitab_logs")
    .select("*, teachers(first_name, last_name)")
    .eq("student_id", child.id)
    .order("date", { ascending: false });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-teal-50 text-teal-700 rounded-xl">
              <BookOpen className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">হিফজ ও কিতাব পাঠ অগ্রগতি</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            শিক্ষার্থী: <strong className="text-slate-800">{child.first_name} {child.last_name}</strong> (রোল: {toBanglaNumber(child.roll_number || child.student_id || "-")})
          </p>
        </div>

        {students.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {students.map((s) => (
              <Link
                key={s.id}
                href={`/portal/academic?student_id=${s.id}&tab=${activeTab}`}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  s.id === child.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {s.first_name} {s.last_name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Tabs: Hifz vs Kitab */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <Link
          href={`/portal/academic?student_id=${child.id}&tab=hifz`}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition ${
            activeTab === "hifz"
              ? "bg-teal-600 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>হিফজুল কুরআন (সবক, সবকি ও আমুখতা)</span>
        </Link>
        <Link
          href={`/portal/academic?student_id=${child.id}&tab=kitab`}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition ${
            activeTab === "kitab"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>কিতাব বিভাগ (পাঠ ডায়েরি)</span>
        </Link>
      </div>

      {/* HIFZ TAB CONTENT */}
      {activeTab === "hifz" && (
        <div className="space-y-4">
          {hifzLogs && hifzLogs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hifzLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-teal-300 transition space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <Calendar className="w-4 h-4 text-teal-600" />
                      <span>
                        {new Date(log.log_date).toLocaleDateString("bn-BD", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                      <Star className="w-3.5 h-3.5 fill-current text-amber-500" />
                      <span>{log.performance || "মুমতাজ"}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-teal-50/60 p-2.5 rounded-xl border border-teal-100">
                      <span className="text-[10px] font-bold text-teal-800 uppercase block">সবক (নতুন পাঠ)</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 block">
                        {log.para_number ? `পারা ${toBanglaNumber(log.para_number)}` : "-"}
                      </span>
                      <span className="text-[11px] text-slate-600 block truncate">
                        {log.surah_name || log.surah || "সূরা নিদিষ্ট"}
                      </span>
                    </div>

                    <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase block">সবকি (পারা পেছনের)</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 block">
                        {log.saboki_para ? `পারা ${toBanglaNumber(log.saboki_para)}` : log.sabqi || "-"}
                      </span>
                      <span className="text-[11px] text-slate-600 block truncate">
                        {log.saboki_page ? `পৃষ্ঠা ${toBanglaNumber(log.saboki_page)}` : "-"}
                      </span>
                    </div>

                    <div className="bg-blue-50/60 p-2.5 rounded-xl border border-blue-100">
                      <span className="text-[10px] font-bold text-blue-800 uppercase block">আমুখতা (দাওর)</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 block">
                        {log.amukhta_para ? `পারা ${toBanglaNumber(log.amukhta_para)}` : log.manzil || "-"}
                      </span>
                      <span className="text-[11px] text-slate-600 block truncate">
                        {log.amukhta_page ? `পৃষ্ঠা ${toBanglaNumber(log.amukhta_page)}` : "-"}
                      </span>
                    </div>
                  </div>

                  {log.remarks && (
                    <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <strong>উস্তাদের মন্তব্য:</strong> {log.remarks}
                    </div>
                  )}

                  {log.teachers && (
                    <div className="text-[11px] text-slate-400 flex items-center justify-end gap-1">
                      <User className="w-3.5 h-3.5" />
                      <span>উস্তাদ: {log.teachers.first_name} {log.teachers.last_name}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h4 className="font-bold text-slate-700">কোন হিফজ সবক রেকর্ড পাওয়া যায়নি</h4>
              <p className="text-xs text-slate-400 mt-1">শিক্ষক কর্তৃক নতুন সবক এন্ট্রি করা হলে এখানে দেখতে পাবেন।</p>
            </div>
          )}
        </div>
      )}

      {/* KITAB TAB CONTENT */}
      {activeTab === "kitab" && (
        <div className="space-y-4">
          {kitabLogs && kitabLogs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kitabLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-800">
                      {new Date(log.date).toLocaleDateString("bn-BD", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                      {log.subject_name || "কিতাব"}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm text-slate-800">
                    <p><strong>কিতাবের নাম:</strong> {log.kitab_name || log.subject_name}</p>
                    <p className="text-xs text-slate-600"><strong>পঠিত অধ্যায় / বাব:</strong> {log.chapter_name || log.bab || "-"}</p>
                    <p className="text-xs text-slate-600"><strong>পৃষ্ঠা নম্বর:</strong> {log.page_number ? toBanglaNumber(log.page_number) : "-"}</p>
                  </div>

                  {log.teacher_remarks && (
                    <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <strong>শিক্ষক মূল্যায়ন:</strong> {log.teacher_remarks}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h4 className="font-bold text-slate-700">কোন কিতাবাত রেকর্ড পাওয়া যায়নি</h4>
              <p className="text-xs text-slate-400 mt-1">শিক্ষক কর্তৃক কিতাব পাঠ ডায়েরি এন্ট্রি হলে এখানে দেখা যাবে।</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
