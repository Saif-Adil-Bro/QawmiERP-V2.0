import { readHifz } from "@/lib/hifz/read";
import FamilyReport from "@/components/hifz/FamilyReport";
import LiveStudentHifzReport from "@/components/hifz/LiveStudentHifzReport";
import { getStudentParaRevisions } from "@/app/actions/hifz";
import { childLogs } from "@/lib/portal/queries";
import {
  BookOpen,
  FileText,
  User,
} from "lucide-react";
import Link from "next/link";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { getPortalStudentData } from "@/lib/portal-data";

export const dynamic = "force-dynamic";

export default async function ParentPortalAcademic(props: {
  searchParams?: Promise<{ student_id?: string; tab?: string }>;
}) {
  const params = props.searchParams ? (await props.searchParams) || {} : {};
  const portalData = await getPortalStudentData(params.student_id);

  if (!portalData || !portalData.user) return null;

  const { students, child, adminClient } = portalData;

  if (students.length === 0 || !child) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
        কোন শিক্ষার্থী সংযুক্ত পাওয়া যায়নি।
      </div>
    );
  }

  const activeTab = params.tab || "hifz";

  const [hifz, kitabLogs, paraRevisions] = await Promise.all([
    readHifz(adminClient, portalData.madrasaId, [child], portalData.meta.student_profiles, true),
    childLogs(adminClient, portalData.madrasaId, "kitab_logs", [child.id]),
    getStudentParaRevisions(portalData.madrasaId, child.id),
  ]);
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {child.photo_url ? (
            <img
              src={child.photo_url}
              alt=""
              className="w-12 h-12 rounded-xl object-cover border border-teal-200 shrink-0 shadow-2xs"
            />
          ) : (
            <div className="p-2.5 bg-teal-50 text-teal-700 rounded-xl shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">হিফজ ও কিতাব পাঠ অগ্রগতি</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>শিক্ষার্থী: <strong className="text-slate-800">{child.first_name} {child.last_name}</strong></span>
              {(child.student_id || child.student_id_formatted) && (
                <span className="font-mono bg-teal-50 text-teal-700 px-2 py-0.5 rounded text-xs border border-teal-200 font-bold">
                  আইডি: {child.student_id || child.student_id_formatted}
                </span>
              )}
              <span>(রোল: {toBanglaNumber(child.roll_number || "-")})</span>
            </p>
          </div>
        </div>

        {students.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {students.map((s: any) => (
              <Link
                key={s.id}
                href={`/portal/academic?student_id=${s.id}&tab=${activeTab}`}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                  s.id === child.id
                    ? "bg-teal-700 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                <span>{s.first_name} {s.last_name}</span>
                {(s.student_id || s.student_id_formatted) && (
                  <span className="text-[10px] font-mono opacity-85">
                    ({s.student_id || s.student_id_formatted})
                  </span>
                )}
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
        <div className="space-y-6">
          <LiveStudentHifzReport
            studentId={child.id}
            studentName={`${child.first_name} ${child.last_name || ""}`.trim()}
            rollNumber={child.roll_number}
            bundle={hifz}
            initialRevisions={paraRevisions}
            canEditRevision={false}
          />
          <FamilyReport bundle={hifz} studentId={child.id} />
        </div>
      )}

      {/* KITAB TAB CONTENT */}
      {activeTab === "kitab" && (
        <div className="space-y-4">
          {kitabLogs && kitabLogs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kitabLogs.map((log: any) => (
                <div
                  key={log.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-800">
                      {new Date(log.log_date || log.created_at).toLocaleDateString("bn-BD", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                      {log.performance_rating || "—"}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm text-slate-800">
                    <p><strong>কিতাবের নাম:</strong> {log.kitab_name || log.subject_name || "—"}</p>
                    <p className="text-xs text-slate-600"><strong>পঠিত অংশ / পৃষ্ঠা:</strong> {log.page_from ? `পৃষ্ঠা ${toBanglaNumber(log.page_from)} হতে ${toBanglaNumber(log.page_to || log.page_from)}` : "-"}</p>
                  </div>

                  {(log.notes || log.teacher_remarks) && (
                    <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <strong>শিক্ষক মূল্যায়ন:</strong> {log.notes || log.teacher_remarks}
                    </div>
                  )}

                  {log.teachers && (
                    <div className="text-[11px] text-slate-400 flex items-center justify-end gap-1">
                      <User className="w-3.5 h-3.5" />
                      <span>উস্তাদ: {Array.isArray(log.teachers) ? `${log.teachers[0]?.first_name} ${log.teachers[0]?.last_name}` : `${log.teachers.first_name} ${log.teachers.last_name}`}</span>
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
