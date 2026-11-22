"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Search, ChevronRight } from "lucide-react";
import HifzSummaryWidget from "@/components/widgets/HifzSummaryWidget";
import HifzForm, { type HifzSeed } from "@/app/teacher-portal/hifz/HifzForm";
import { saveAdminHifzWorkspaceAction } from "@/app/actions/hifz";
import type { HifzSummary } from "@/lib/hifz-utils";
import { toBanglaNumber } from "@/lib/numberToBangla";

export default function AdminHifzWorkspaceClient({
  seed,
  summary,
  currentClassId,
  currentDate,
}: {
  seed: HifzSeed;
  summary: HifzSummary;
  currentClassId: string;
  currentDate: string;
}) {
  const [directoryClass, setDirectoryClass] = useState<string>("All");
  const [directorySearch, setDirectorySearch] = useState<string>("");

  const profileByStudent = useMemo(
    () =>
      new Map(
        (seed.bundle.hifz_profiles || []).map((p) => [p.student_id, p]),
      ),
    [seed.bundle.hifz_profiles],
  );

  const classNameById = useMemo(
    () => new Map((seed.classes || []).map((c: any) => [c.id, c.name])),
    [seed.classes],
  );

  const filteredStudents = useMemo(() => {
    const q = directorySearch.trim().toLowerCase();
    return (seed.students || []).filter((s: any) => {
      if (directoryClass !== "All" && s.class_id !== directoryClass) return false;
      if (!q) return true;
      const name = `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase();
      const roll = String(s.roll_number || "").toLowerCase();
      return name.includes(q) || roll.includes(q);
    });
  }, [seed.students, directoryClass, directorySearch]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            হিফজুল কুরআন ও সবিনা ট্র্যাকিং
          </h1>
          <p className="text-slate-500 text-sm">
            সবকী ও খতমী দৈনিক পাঠ, বৃহস্পতিবারের সাপ্তাহিক সবিনা, বিশেষ সবিনা এবং ৩০-পারা প্রোফাইল ব্যবস্থাপনা
          </p>
        </div>

        <Link
          href="/dashboard/hifz/report"
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs transition"
        >
          <BookOpen className="w-4 h-4" />
          <span>মাসিক প্রোগ্রেস ও কওমি সামারি রিপোর্ট</span>
        </Link>
      </div>

      {/* Unified Hifz Overview */}
      <HifzSummaryWidget summary={summary} />

      {/* Full 4-Tab Hifz Workspace (Daily Sabqi/Khatmi, Thursday Sabina, Special Sabina, 30-Para Profile) */}
      <HifzForm
        seed={seed}
        currentClassId={currentClassId}
        currentDate={currentDate}
        onSave={saveAdminHifzWorkspaceAction}
      />

      {/* Pure Hifz Student Directory (No Noorani/Unrelated Columns) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-800">
            হিফজ শিক্ষার্থী তালিকা ও বিস্তারিত রিপোর্ট ({toBanglaNumber(filteredStudents.length)} জন)
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={directorySearch}
                onChange={(e) => setDirectorySearch(e.target.value)}
                placeholder="নাম বা রোল..."
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <select
              value={directoryClass}
              onChange={(e) => setDirectoryClass(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50"
            >
              <option value="All">সকল জামাত</option>
              {seed.classes.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">
            কোনো শিক্ষার্থী পাওয়া যায়নি।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-slate-700 border-b border-slate-200/80">
                <tr>
                  <th className="px-5 py-3 font-bold text-xs">রোল</th>
                  <th className="px-5 py-3 font-bold text-xs">শিক্ষার্থীর নাম</th>
                  <th className="px-5 py-3 font-bold text-xs">জামাত</th>
                  <th className="px-5 py-3 font-bold text-xs">হিফজ স্তর</th>
                  <th className="px-5 py-3 font-bold text-xs">পূর্বের পারা / খতম</th>
                  <th className="px-5 py-3 font-bold text-xs text-right">বিস্তারিত</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((s: any) => {
                  const prof = profileByStudent.get(s.id);
                  const preCount = prof?.previously_memorized_paras?.length || 0;
                  const khatamCount = prof?.total_khatams_completed || 0;
                  const doneInCycle = prof?.current_khatam_paras_done?.length || 0;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-3.5 font-bold font-mono text-slate-900">
                        {s.roll_number || "-"}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-900">
                        {s.first_name} {s.last_name}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                          {classNameById.get(s.class_id) || s.class_name || "N/A"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            prof?.hifz_category === "khatmi"
                              ? "bg-indigo-100 text-indigo-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {prof?.hifz_category === "khatmi" ? "খতমী (Khatmi)" : "সবকী (Sabqi)"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600">
                        {prof?.hifz_category === "khatmi" ? (
                          <span>
                            মোট খতম: <strong>{toBanglaNumber(khatamCount)}</strong> • চলমান:{" "}
                            <strong>{toBanglaNumber(doneInCycle)}/৩০</strong> পারা
                          </span>
                        ) : (
                          <span>
                            পূর্বের মুখস্থ: <strong>{toBanglaNumber(preCount)}</strong> পারা
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/dashboard/hifz/${s.id}`}
                          className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-bold text-xs bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200/70 transition"
                        >
                          <span>৩০-পারা রিপোর্ট</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
