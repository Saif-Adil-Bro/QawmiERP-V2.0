"use client";
import { useState } from "react";
import { Counter, NumberField, type Submit } from "@/components/hifz/Controls";
import { bn } from "@/components/hifz/Report";
import {
  dailyFields,
  khatamCycles,
  memorizedParas,
  parseHifzLogNotes,
  sessionTimes,
  type HifzProfile,
} from "@/lib/hifz-utils";
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
  const cycle = khatamCycles([
    ...logs.filter((l) => l.log_date !== date),
    { ...d, log_date: date },
  ]);
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
                      label="শুরুর পৃষ্ঠা"
                      value={d[page]}
                      max={610}
                      onChange={(v) => update(page, v)}
                    />
                    <NumberField
                      label="শেষ পৃষ্ঠা"
                      value={d.sabak_page_to}
                      max={610}
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
            </fieldset>
          ))
        ) : (
          <>
            {sessionTimes.map((t) => (
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
                  <div className="hz-grid">
                    {[
                      ["para_from", "শুরুর পারা"],
                      ["para_to", "শেষ পারা"],
                      ["pages", "পৃষ্ঠা"],
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
                        max={k === "pages" ? 610 : 30}
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
                )}
              </fieldset>
            ))}
            <div className="hz-summary">
              <strong>
                এন্ট্রিসহ চলতি খতম: {bn(cycle.current_khatam_paras_done.length)}
                /৩০ · সম্পন্ন খতম {bn(cycle.total_khatams_completed)}
              </strong>
              <progress
                value={cycle.current_khatam_paras_done.length}
                max={30}
              />
              <p>
                শোনানো পারা:{" "}
                {cycle.current_khatam_paras_done.map(bn).join(", ") || "—"}
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
