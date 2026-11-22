"use client";
import { useState } from "react";
import { Counter, NumberField, type Submit } from "@/components/hifz/Controls";
import { bn } from "@/components/hifz/Report";
import {
  dailyFields,
  getTotalPagesInPara,
  khatamCycles,
  memorizedParas,
  parseHifzLogNotes,
  sessionTimes,
  type HifzProfile,
} from "@/lib/hifz-utils";
import { computeKhatmiProgress, MUSHAF_TOTAL_PAGES } from "@/lib/hifz-mushaf";
export default function DailyEntry({
  profile: p,
  date,
  logs,
  submit,
}: {
  profile: HifzProfile;
  date: string;
  logs: any[];
  submit: Submit;
}) {
  const old = logs.find((l) => l.log_date === date);
  const { cleanNotes, meta } = parseHifzLogNotes(old?.notes);
  const [d, set] = useState<Record<string, any>>(() => ({
    ...dailyFields(old),
    ...meta,
    sabak_para: old?.sabak_para,
    sabak_page_from: meta.sabak_page_from ?? old?.sabak_page,
    sabak_page_to: meta.sabak_page_to ?? old?.sabak_page,
    saboki_para: old?.saboki_para,
    amukhta_para: old?.amukhta_para,
    student_category: old ? dailyFields(old).student_category : p.hifz_category,
    performance_rating: old?.performance_rating || "",
    notes: cleanNotes,
  }));
  const [expected, setExpected] = useState<string | null>(
    meta.entry_revision ?? null,
  );
  const update = (k: string, v: any) => set((prev) => ({ ...prev, [k]: v }));
  const sabqi = d.student_category === "sabqi";
  const mergedLogs = [
    ...logs.filter((l) => l.log_date !== date),
    { ...d, log_date: date },
  ];
  const cycle = khatamCycles(mergedLogs);
  const khatmiStats = computeKhatmiProgress(p, mergedLogs);
  const currentSabakMaxPages = getTotalPagesInPara(Number(d.sabak_para) || 1);
  const currentSabakPageTo = Number(d.sabak_page_to || d.sabak_page_from || 0);
  const promote = () =>
    submit({
      kind: "profile",
      student_id: p.student_id,
      hifz_category: "khatmi",
      previously_memorized_paras: p.previously_memorized_paras,
      default_sabina_partner_id: p.default_sabina_partner_id,
    });
  return (
    <div className="hz-stack">
      <form
        className="hz-card hz-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const change = crypto.randomUUID();
          const ok = await submit({
            kind: "daily",
            current_date: date,
            records: [
              {
                ...d,
                student_id: p.student_id,
                existing_id: old?.id || null,
                expected_revision: expected,
                change_id: change,
              },
            ],
          });
          if (ok) setExpected(change);
        }}
      >
        <div className="hz-title">
          <h2>{sabqi ? "সবকী · দৈনিক পাঠ" : "খতমী · দৈনিক দাওর"}</h2>
          <span className="hz-pill hz-good">
            {old ? "সংরক্ষিত এন্ট্রি সম্পাদনা" : "নতুন এন্ট্রি"}
          </span>
        </div>
        {sabqi && p.hifz_category === "khatmi" && (
          <button
            type="button"
            onClick={() => update("student_category", "khatmi")}
          >
            এই এন্ট্রিতে খতমী দাওর যোগ করুন
          </button>
        )}
        {sabqi ? (
          [
            ["নতুন সবক", "sabak_para", "sabak_page_from", "sabak_mistakes"],
            ["সাত সবক", "saboki_para", "saboki_pages", "sat_sabak_mistakes"],
            ["আমুখতা", "amukhta_para", "amukhta_amount", "amukhta_mistakes"],
          ].map(([title, para, page, mistake], i) => (
            <fieldset key={para}>
              <legend>{title}</legend>
              <div className="hz-grid">
                <NumberField
                  label={`${title} · পারা`}
                  value={d[para]}
                  onChange={(v) => update(para, v)}
                />
                {i === 0 ? (
                  <>
                    <NumberField
                      label={`শুরুর পৃষ্ঠা (১–${bn(currentSabakMaxPages)})`}
                      value={d[page]}
                      max={currentSabakMaxPages}
                      onChange={(v) => update(page, v)}
                    />
                    <NumberField
                      label={`শেষ পৃষ্ঠা (১–${bn(currentSabakMaxPages)})`}
                      value={d.sabak_page_to}
                      max={currentSabakMaxPages}
                      onChange={(v) => update("sabak_page_to", v)}
                    />
                  </>
                ) : (
                  <label>
                    {i === 1
                      ? "সাত সবকের পৃষ্ঠা"
                      : "আমুখতার পরিমাণ (পারা / পৃষ্ঠা)"}
                    <input
                      value={d[page] || ""}
                      onChange={(e) => update(page, e.target.value)}
                    />
                  </label>
                )}
                <Counter
                  label={`${title} · ভুল`}
                  value={Number(d[mistake]) || 0}
                  onChange={(v) => update(mistake, v)}
                />
              </div>
              {i === 0 && Number(d.sabak_para) >= 1 && (
                <p className="text-xs text-emerald-700 font-semibold mt-2">
                  পারা {bn(d.sabak_para)}-এর মোট পৃষ্ঠা: {bn(currentSabakMaxPages)} (কওমি মুসহাফ ৬১০ পৃষ্ঠা ফরম্যাট)
                  {currentSabakPageTo > 0 && (
                    <>
                      {" "}
                      • ১–{bn(Math.min(currentSabakPageTo, currentSabakMaxPages))} পৃষ্ঠা সম্পন্ন (
                      {bn(Math.min(100, Math.round((currentSabakPageTo / currentSabakMaxPages) * 100)))}%)
                      {currentSabakPageTo >= currentSabakMaxPages && " — পারাটি সম্পন্ন হবে ✓"}
                    </>
                  )}
                </p>
              )}
            </fieldset>
          ))
        ) : (
          <>
            {sessionTimes.map((t) => {
              const pFrom = Number(d[`${t}_para_from`]) || 1;
              const pMax = getTotalPagesInPara(pFrom);
              const enteredPages = Number(d[`${t}_pages`]) || 0;
              const partialPct =
                enteredPages > 0 && Number(d[`${t}_para_to`] || pFrom) === pFrom
                  ? Math.min(100, Math.round((enteredPages / pMax) * 100))
                  : null;
              return (
                <fieldset key={t}>
                  <legend>
                    {t === "morning" ? "সকালের দাওর" : "বিকেলের দাওর"}
                  </legend>
                  <label className="hz-check">
                    <input
                      type="checkbox"
                      checked={d[`${t}_session_done`]}
                      onChange={(e) =>
                        update(`${t}_session_done`, e.target.checked)
                      }
                    />
                    শোনানো হয়েছে
                  </label>
                  {d[`${t}_session_done`] && (
                    <>
                      <div className="hz-grid">
                        {[
                          ["para_from", "শুরুর পারা"],
                          ["para_to", "শেষ পারা"],
                          ["pages", "পৃষ্ঠা (আংশিক হলে লিখুন)"],
                        ].map(([k, l]) => (
                          <NumberField
                            key={k}
                            label={l}
                            value={d[`${t}_${k}`]}
                            min={
                              k === "pages"
                                ? 0
                                : k === "para_to"
                                  ? Number(d[`${t}_para_from`]) || 1
                                  : 1
                            }
                            max={k === "pages" ? MUSHAF_TOTAL_PAGES : 30}
                            required
                            onChange={(v) => update(`${t}_${k}`, v)}
                          />
                        ))}
                        <Counter
                          label="দাওরে ভুল"
                          value={d[`${t}_mistakes`]}
                          onChange={(v) => update(`${t}_mistakes`, v)}
                        />
                      </div>
                      {partialPct !== null && (
                        <p className="text-xs text-indigo-700 font-semibold mt-2">
                          পারা {bn(pFrom)} আংশিক অগ্রগতি: {bn(enteredPages)}/{bn(pMax)} পৃষ্ঠা ({bn(partialPct)}%)
                        </p>
                      )}
                    </>
                  )}
                </fieldset>
              );
            })}
            <div className="hz-summary">
              <strong>
                চলতি খতম: {bn(khatmiStats.currentCyclePagesDone)}/{bn(MUSHAF_TOTAL_PAGES)} পৃষ্ঠা (
                {bn(khatmiStats.currentCyclePercent)}%) · পূর্ণ পারা{" "}
                {bn(khatmiStats.completedParasInCycle.length)}/৩০ · সম্পন্ন খতম{" "}
                {bn(khatmiStats.totalKhatamsCompleted)}
              </strong>
              <progress
                value={khatmiStats.currentCyclePagesDone}
                max={MUSHAF_TOTAL_PAGES}
              />
              <p>
                পূর্ণ পারা:{" "}
                {khatmiStats.completedParasInCycle.map(bn).join(", ") || "—"}
                {khatmiStats.partialParasInCycle.length > 0 && (
                  <>
                    {" "}
                    · আংশিক:{" "}
                    {khatmiStats.partialParasInCycle
                      .map((item) => `পারা ${bn(item.para)} (${bn(item.percent)}%)`)
                      .join(", ")}
                  </>
                )}
              </p>
            </div>
          </>
        )}
        <div className="hz-grid">
          <label>
            মূল্যায়ন
            <select
              value={d.performance_rating}
              onChange={(e) => update("performance_rating", e.target.value)}
            >
              <option value="">নির্বাচন করুন</option>
              {old?.performance_rating &&
                !["Excellent", "Good", "Average", "Poor"].includes(
                  old.performance_rating,
                ) && <option>{old.performance_rating}</option>}
              {[
                ["Excellent", "মুমতাজ"],
                ["Good", "জায়্যিদ"],
                ["Average", "মধ্যম"],
                ["Poor", "আরও মনোযোগ প্রয়োজন"],
              ].map(([v, t]) => (
                <option value={v} key={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            উস্তাদের মন্তব্য
            <input
              maxLength={2000}
              value={d.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </label>
        </div>
        <button className="hz-save">দৈনিক এন্ট্রি সংরক্ষণ করুন</button>
      </form>
      {p.hifz_category === "sabqi" && memorizedParas(p, logs).length === 30 && (
        <button type="button" className="hz-save" onClick={promote}>
          খতমী স্তরে উন্নীত করুন
        </button>
      )}
    </div>
  );
}
