"use client";

import React from "react";
import { BookOpen, Award, Calendar, Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import {
  computeStudent30ParaMap,
  LISTENING_MODE_LABELS_BN,
  type HifzSpecialSabinaRecord,
  type HifzStudentProfile,
  type HifzWeeklySabinaRecord,
} from "@/lib/hifz-upgrade-utils";
import { parseHifzLogNotes } from "@/lib/hifz-utils";

interface Props {
  studentId: string;
  profile: HifzStudentProfile | null;
  hifzLogs: any[];
  weeklySabinas: HifzWeeklySabinaRecord[];
  specialSabinas: HifzSpecialSabinaRecord[];
}

export default function PortalHifzUpgradeSection({
  studentId,
  profile,
  hifzLogs,
  weeklySabinas,
  specialSabinas,
}: Props) {
  const paraMap = computeStudent30ParaMap(profile, hifzLogs || [], weeklySabinas || []);
  const isKhatmi = profile?.hifz_category === "khatmi";
  const khatamDone = profile?.current_khatam_paras_done?.length || 0;
  const totalKhatams = profile?.total_khatams_completed || 0;

  // Filter special sabina sittings relevant to this student
  const relevantSpecials = (specialSabinas || []).filter((sp) =>
    (sp.session_logs || []).some(
      (log) => log.reciter_id === studentId || (log.listener_ids || []).includes(studentId)
    )
  );

  // Latest adaptive daily log preview (Sabqi vs Khatmi)
  const latestLog = hifzLogs?.[0];
  const latestParsed = latestLog ? parseHifzLogNotes(latestLog.notes) : null;

  return (
    <div className="space-y-5">
      {/* 1. 30-Para Visual Hifz Map */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-teal-600" />
              ৩০-পারা ভিজ্যুয়াল হিফজ ম্যাপ
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              বর্তমান স্তর:{" "}
              <strong className="text-teal-700">
                {isKhatmi
                  ? `খতমী (মোট খতম: ${toBanglaNumber(totalKhatams)} বার • চলমান: ${toBanglaNumber(khatamDone)}/৩০ পারা)`
                  : "সবকী (Sabqi)"}
              </strong>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
              পূর্বের মুখস্থ
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              সম্পন্ন
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300">
              চলমান
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
              দুর্বল পারা
            </span>
          </div>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-2">
          {paraMap.map((cell) => {
            const cls =
              cell.status === "weak"
                ? "bg-rose-50 text-rose-800 border-rose-300"
                : cell.status === "current"
                ? "bg-amber-50 text-amber-900 border-amber-400 ring-1 ring-amber-300"
                : cell.status === "pre_memorized"
                ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                : cell.status === "completed"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-slate-50 text-slate-500 border-slate-200";

            return (
              <div
                key={cell.para}
                className={`rounded-xl border p-2 text-center ${cls}`}
                title={
                  cell.lastMistakes !== undefined
                    ? `পারা ${toBanglaNumber(cell.para)} — সর্বশেষ সবিনা ভুল: ${toBanglaNumber(cell.lastMistakes)}`
                    : `পারা ${toBanglaNumber(cell.para)}`
                }
              >
                <div className="text-xs font-extrabold">{toBanglaNumber(cell.para)}</div>
                <div className="text-[9px] font-semibold mt-0.5 truncate">
                  {cell.status === "weak"
                    ? "দুর্বল"
                    : cell.status === "current"
                    ? "চলমান"
                    : cell.status === "pre_memorized"
                    ? "পূর্বের"
                    : cell.status === "completed"
                    ? "সম্পন্ন"
                    : "বাকি"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Adaptive Latest Khatmi Dual-Session Highlight */}
        {latestParsed?.meta?.student_category === "khatmi" && (
          <div className="rounded-xl bg-indigo-50/70 border border-indigo-200 p-3.5 text-xs space-y-1.5">
            <div className="font-bold text-indigo-900 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-indigo-600" />
              সর্বশেষ খতমী দাওর সেশন ({latestLog.log_date})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {latestParsed.meta.morning_session_done && (
                <div className="bg-white rounded-lg p-2.5 border border-indigo-100">
                  <strong>সকালের সেশন:</strong> পারা{" "}
                  {toBanglaNumber(latestParsed.meta.morning_para_from || "-")}–
                  {toBanglaNumber(latestParsed.meta.morning_para_to || "-")} • ভুল:{" "}
                  {toBanglaNumber(latestParsed.meta.morning_mistakes || 0)}
                </div>
              )}
              {latestParsed.meta.afternoon_session_done && (
                <div className="bg-white rounded-lg p-2.5 border border-indigo-100">
                  <strong>বিকেলের সেশন:</strong> পারা{" "}
                  {toBanglaNumber(latestParsed.meta.afternoon_para_from || "-")}–
                  {toBanglaNumber(latestParsed.meta.afternoon_para_to || "-")} • ভুল:{" "}
                  {toBanglaNumber(latestParsed.meta.afternoon_mistakes || 0)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Thursday Weekly Sabina Report */}
      {weeklySabinas.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            সাপ্তাহিক বৃহস্পতিবারের সবিনা রিপোর্ট
          </h3>
          <div className="space-y-3">
            {weeklySabinas.slice(0, 6).map((sab) => (
              <div
                key={sab.id}
                className="rounded-xl border border-slate-200 p-3.5 space-y-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-900">
                    তারিখ: {sab.sabina_date} • পারা{" "}
                    {toBanglaNumber(sab.assigned_para_from)}–{toBanglaNumber(sab.assigned_para_to)}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 font-bold text-slate-700">
                    মোট ভুল: {toBanglaNumber(sab.total_mistakes)}
                  </span>
                </div>
                {sab.listener_student_name && (
                  <div className="text-[11px] text-slate-500">
                    শ্রোতা সাথী: <strong className="text-slate-700">{sab.listener_student_name}</strong>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {(sab.para_breakdown || []).map((item) => (
                    <span
                      key={item.para}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-bold text-[11px] ${
                        item.status === "perfect"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : item.status === "good"
                          ? "bg-blue-50 text-blue-800 border-blue-200"
                          : "bg-rose-50 text-rose-800 border-rose-200"
                      }`}
                    >
                      {item.status === "perfect" ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : item.status === "weak" ? (
                        <AlertTriangle className="w-3 h-3" />
                      ) : null}
                      পারা {toBanglaNumber(item.para)} ({toBanglaNumber(item.mistakes)} ভুল)
                    </span>
                  ))}
                </div>
                {sab.remarks && (
                  <p className="text-[11px] text-slate-600 italic">মন্তব্য: {sab.remarks}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Special Multi-Mode Sabina Reports */}
      {relevantSpecials.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            বিশেষ সবিনা রিপোর্ট
          </h3>
          <div className="space-y-2.5">
            {relevantSpecials.map((sp) => (
              <div
                key={sp.id}
                className="rounded-xl border border-purple-200/70 bg-purple-50/30 p-3.5 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900">{sp.title}</span>
                  <span className="text-[11px] font-semibold text-purple-700">
                    {LISTENING_MODE_LABELS_BN[sp.listening_mode]}
                  </span>
                </div>
                {(sp.session_logs || [])
                  .filter(
                    (l) => l.reciter_id === studentId || (l.listener_ids || []).includes(studentId)
                  )
                  .slice(0, 5)
                  .map((l) => (
                    <div
                      key={l.id}
                      className="bg-white rounded-lg p-2 border border-purple-100 flex items-center justify-between gap-2"
                    >
                      <span>
                        <strong>{l.session_label}</strong> • পারা{" "}
                        {toBanglaNumber(l.para_from)}–{toBanglaNumber(l.para_to)}
                      </span>
                      <span className="font-bold text-slate-700">
                        ভুল: {toBanglaNumber(l.total_mistakes)}
                      </span>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
