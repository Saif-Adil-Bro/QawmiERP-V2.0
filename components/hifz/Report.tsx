import {
  buildStudentHifzReportFromLogs,
  dailyFields,
  marksLabel,
  modes,
  parseHifzLogNotes,
  sessionTimes,
  type HifzBundle,
  type ParaResult,
  type SpecialSabina,
} from "@/lib/hifz-utils";
export const bn = (v: unknown) =>
  String(v ?? "—").replace(/\d/g, (n) => "০১২৩৪৫৬৭৮৯"[+n]);
export const studentName = (s: any) =>
  [s.first_name, s.last_name].filter(Boolean).join(" ");
export function ParaMarks({ rows }: { rows: ParaResult[] }) {
  return (
    <div className="hz-row">
      {rows.map((r) => (
        <span key={r.para} className={`hz-pill hz-${r.status}`}>
          পারা {bn(r.para)} · {bn(r.mistakes)} ভুল · {marksLabel[r.status]}
        </span>
      ))}
    </div>
  );
}
export function EventReport({ event: e }: { event: SpecialSabina }) {
  const names = e.participants.names || {};
  const paras = new Set(
    e.session_logs.flatMap((s) => s.para_wise_mistakes.map((r) => r.para)),
  );
  return (
    <article className="hz-card hz-stack">
      <div className="hz-title">
        <h3>{e.title}</h3>
        <span
          className={
            "hz-pill " + (e.status === "ongoing" ? "hz-perfect" : "hz-good")
          }
        >
          {e.status === "ongoing" ? "● চলমান" : "সম্পন্ন"}
        </span>
      </div>
      <p>
        {modes[e.listening_mode]} · {bn(e.start_date)} — {bn(e.end_date)} (
        {bn(e.duration_days)} দিন){e.group_label && ` · ${e.group_label}`}
      </p>
      {!e.student_id && (
        <p>
          পাঠকারী:{" "}
          {e.participants.reciter_group_ids.map((id) => names[id]).join(", ")} ·
          শ্রোতা:{" "}
          {[
            ...e.participants.listener_group_ids,
            ...e.participants.teacher_listener_ids,
          ]
            .map((id) => names[id])
            .join(", ")}
        </p>
      )}
      <p>
        {e.student_id ? "নিজের পাঠ" : "আয়োজনের পাঠ"}: {bn(paras.size)}/৩০ পারা ·{" "}
        {bn(e.session_logs.reduce((n, l) => n + l.total_mistakes, 0))} ভুল
      </p>
      <progress aria-label="পারা অগ্রগতি" max={30} value={paras.size} />
      {!!e.heard_sittings?.length && (
        <details>
          <summary>
            শ্রোতা হিসেবে অংশগ্রহণ ({bn(e.heard_sittings.length)} আসর)
          </summary>
          {e.heard_sittings.map((s, i) => (
            <p key={i}>
              {bn(s.timestamp.slice(0, 10))} · {s.session_label} · পাঠকারী:{" "}
              {s.partner}
            </p>
          ))}
        </details>
      )}
      {e.session_logs.map((s) => (
        <details key={s.id}>
          <summary>
            {bn(s.timestamp.slice(0, 10))} · {s.session_label} ·{" "}
            {names[s.reciter_id] || "নিজের পাঠ"} · পারা {bn(s.para_from)}–
            {bn(s.para_to)} · {bn(s.total_mistakes)} ভুল
          </summary>
          <p>
            শ্রোতা:{" "}
            {(s.listener_names || s.listener_ids.map((id) => names[id])).join(
              ", ",
            ) || "—"}
          </p>
          <ParaMarks rows={s.para_wise_mistakes} />
        </details>
      ))}
    </article>
  );
}
export function StudentReport({
  bundle: b,
  studentId,
  showDaily = true,
}: {
  bundle: HifzBundle;
  studentId: string;
  showDaily?: boolean;
}) {
  const p = b.hifz_profiles.find((r) => r.student_id === studentId);
  if (!p) return null;
  const logs = b.hifz_logs.filter((l) => l.student_id === studentId),
    weekly = b.hifz_weekly_sabina.filter((w) => w.student_id === studentId);
  const grid = buildStudentHifzReportFromLogs({
    student: { id: studentId },
    studentProfile: p,
    allStudentLogs: logs,
  }).para_grid;
  const events = b.hifz_special_sabina.filter(
    (e) =>
      e.student_id === studentId ||
      e.participants.reciter_group_ids.includes(studentId) ||
      e.participants.listener_group_ids.includes(studentId),
  );
  const weak = new Set(
    [
      ...weekly.flatMap((w) => w.para_breakdown),
      ...events.flatMap((e) =>
        e.session_logs
          .filter((s) => s.reciter_id === studentId)
          .flatMap((s) => s.para_wise_mistakes),
      ),
    ]
      .filter((r) => r.status === "weak")
      .map((r) => r.para),
  );
  return (
    <section className="hz">
      <link rel="stylesheet" href="/hifz.css" />
      <article className="hz-card hz-stack">
        <h2>
          {p.hifz_category === "khatmi" ? "খতমী" : "সবকী"} শিক্ষার্থীর পারা
          মানচিত্র
        </h2>
        <p>
          সম্পন্ন খতম {bn(p.total_khatams_completed)} · চলতি খতম{" "}
          {bn(p.current_khatam_paras_done.length)}/৩০ পারা
        </p>
        <div className="hz-row">
          {[
            ["prev", "আগে মুখস্থ"],
            ["complete", "সম্পূর্ণ"],
            ["running", "চলমান"],
            ["weak", "দুর্বল"],
          ].map(([c, l]) => (
            <span key={c} className={"hz-pill hz-" + c}>
              {l}
            </span>
          ))}
        </div>
        <div className="hz-paras">
          {grid.map((g) => {
            const [color, label] = weak.has(g.para)
              ? ["weak", "দুর্বল"]
              : p.previously_memorized_paras.includes(g.para)
                ? ["prev", "আগে মুখস্থ"]
                : p.current_khatam_paras_done.includes(g.para) ||
                    g.status === "COMPLETED"
                  ? ["complete", "সম্পূর্ণ"]
                  : g.status === "RUNNING"
                    ? ["running", "চলমান"]
                    : ["", "বাকি"];
            return (
              <span
                key={g.para}
                className={"hz-" + color}
                aria-label={`পারা ${bn(g.para)} · ${label}`}
                title={label}
              >
                {bn(g.para)}
              </span>
            );
          })}
        </div>
      </article>
      {showDaily && (
        <article className="hz-card hz-stack">
          <h2>দৈনিক পাঠ ও উস্তাদের মন্তব্য</h2>
          {!logs.length && <p>এখনও দৈনিক এন্ট্রি নেই।</p>}
          {logs.map((l) => {
            const { cleanNotes, tilawatText, meta } = parseHifzLogNotes(
              l.notes,
            );
            const f = dailyFields(l, meta);
            return (
              <div className="hz-card" key={l.id || l.log_date}>
                <h4>
                  {bn(l.log_date)} ·{" "}
                  {f.student_category === "khatmi" ? "খতমী" : "সবকী"}{" "}
                  {l.performance_rating && ` · ${l.performance_rating}`}
                </h4>
                {f.student_category === "khatmi" ? (
                  sessionTimes.map((t) => (
                    <p key={t}>
                      {t === "morning" ? "সকাল" : "বিকেল"}:{" "}
                      {f[`${t}_session_done`]
                        ? `পারা ${bn(f[`${t}_para_from`])}–${bn(f[`${t}_para_to`])} · ${bn(f[`${t}_pages`])} পৃষ্ঠা · ${bn(f[`${t}_mistakes`])} ভুল`
                        : "শোনানো হয়নি"}
                    </p>
                  ))
                ) : (
                  <>
                    <p>
                      সবক:{" "}
                      {meta.is_sabak_paused
                        ? "বন্ধ"
                        : `পারা ${bn(l.sabak_para)} · পৃষ্ঠা ${bn(meta.sabak_page_from ?? l.sabak_page)}–${bn(meta.sabak_page_to ?? l.sabak_page)}`}{" "}
                      · ভুল {bn(f.sabak_mistakes)}
                    </p>
                    <p>
                      সাত সবক: পারা {bn(l.saboki_para)} · পৃষ্ঠা{" "}
                      {bn(meta.saboki_pages || "—")} · ভুল{" "}
                      {bn(f.sat_sabak_mistakes)}
                    </p>
                    <p>
                      আমুখতা: পারা {bn(l.amukhta_para)} · পরিমাণ{" "}
                      {bn(meta.amukhta_amount || "—")} · ভুল{" "}
                      {bn(f.amukhta_mistakes)}
                    </p>
                  </>
                )}
                {tilawatText && <p>তেলাওয়াত: {tilawatText}</p>}
                {cleanNotes && <p>উস্তাদের মন্তব্য: {cleanNotes}</p>}
                {l.teachers && (
                  <small>
                    উস্তাদ:{" "}
                    {studentName(
                      Array.isArray(l.teachers) ? l.teachers[0] : l.teachers,
                    )}
                  </small>
                )}
              </div>
            );
          })}
        </article>
      )}
      <article className="hz-card hz-stack">
        <h2>বৃহস্পতিবারের সবিনা</h2>
        {!weekly.length && <p>এখনও সাপ্তাহিক সবিনার রেকর্ড নেই।</p>}
        {weekly.map((w) => (
          <div key={w.id}>
            <h4>
              {bn(w.sabina_date)} ·{" "}
              {w.status === "completed" ? "সম্পন্ন" : "নির্ধারিত"} · পারা{" "}
              {bn(w.assigned_para_from)}–{bn(w.assigned_para_to)}
            </h4>
            <p>
              শ্রোতা: {w.listener_name || "নির্ধারিত নেই"} · শোনানো পারা{" "}
              {bn(w.total_paras_recited)} · মোট ভুল {bn(w.total_mistakes)}
            </p>
            <ParaMarks rows={w.para_breakdown} />
            {w.remarks && <p>{w.remarks}</p>}
          </div>
        ))}
      </article>
      <h2>বিশেষ সবিনার আসর</h2>
      {events.length ? (
        events.map((e) => <EventReport key={e.id} event={e} />)
      ) : (
        <p>বিশেষ সবিনার কোনো রেকর্ড নেই।</p>
      )}
    </section>
  );
}
