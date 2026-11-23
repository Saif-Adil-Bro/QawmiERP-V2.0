"use client";
import { useState } from "react";
import { RangeRows, type Submit } from "@/components/hifz/Controls";
import { bn, EventReport, studentName } from "@/components/hifz/Report";
import {
  datePlus,
  modes,
  participantIds,
  type HifzProfile,
  type ListeningMode,
  type SpecialSabina,
  type WeeklySabina,
} from "@/lib/hifz-utils";
import { toDhakaDateString } from "@/lib/date-utils";
export function ProfileForm({
  p,
  peers,
  submit,
}: {
  p: HifzProfile;
  peers: any[];
  submit: Submit;
}) {
  const [done, setDone] = useState(p.previously_memorized_paras),
    [partner, setPartner] = useState(p.default_sabina_partner_id || "");
  return (
    <form
      className="hz-card hz-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void submit({
          kind: "profile",
          student_id: p.student_id,
          hifz_category: p.hifz_category,
          previously_memorized_paras: done,
          default_sabina_partner_id: partner || null,
        });
      }}
    >
      <h2>শিক্ষার্থী প্রোফাইল</h2>
      <p>আগে মুখস্থ করা পারায় চাপ দিন। আবার চাপলে নির্বাচন সরবে।</p>
      <div className="hz-paras">
        {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`পারা ${bn(n)}`}
            aria-pressed={done.includes(n)}
            onClick={() =>
              setDone(
                done.includes(n) ? done.filter((v) => v !== n) : [...done, n],
              )
            }
          >
            {bn(n)}
          </button>
        ))}
      </div>
      <p>নির্বাচিত {bn(done.length)}/৩০ পারা</p>
      <label>
        নিয়মিত সবিনার সঙ্গী
        <select value={partner} onChange={(e) => setPartner(e.target.value)}>
          <option value="">নির্ধারিত নেই</option>
          {peers.map((s) => (
            <option key={s.id} value={s.id}>
              {studentName(s)}
            </option>
          ))}
        </select>
      </label>
      <button className="hz-save">প্রোফাইল সংরক্ষণ করুন</button>
    </form>
  );
}
export function WeeklyForm({
  p,
  peers,
  date,
  allWeekly = [],
  onDateChange,
  submit,
}: {
  p: HifzProfile;
  peers: any[];
  date: string;
  allWeekly?: WeeklySabina[];
  onDateChange?: (nextDate: string) => void;
  submit: Submit;
}) {
  const initialMonth = date.slice(0, 7);
  const [monthKey, setMonthKey] = useState(initialMonth);
  const [weekNumber, setWeekNumber] = useState<number>(() => {
    const existing = allWeekly.find(
      (w) => w.student_id === p.student_id && w.sabina_date === date,
    );
    if (existing?.week_number) return existing.week_number;
    return Math.min(5, Math.max(1, Math.ceil(Number(date.slice(8, 10)) / 7)));
  });
  const [sabinaDate, setSabinaDate] = useState(date);

  const matchedOld = allWeekly.find(
    (w) =>
      w.student_id === p.student_id &&
      (w.sabina_date === sabinaDate ||
        ((w.month_key || w.sabina_date.slice(0, 7)) === monthKey &&
          w.week_number === weekNumber)),
  );

  const [hijriMonth, setHijriMonth] = useState(matchedOld?.hijri_month_label || "");
  const [from, setFrom] = useState(matchedOld?.assigned_para_from || 1);
  const [to, setTo] = useState(matchedOld?.assigned_para_to || 1);
  const [counts, setCounts] = useState<Record<number, number>>(
    Object.fromEntries(
      (matchedOld?.para_breakdown || []).map((r) => [r.para, r.mistakes]),
    ),
  );
  const [partner, setPartner] = useState(
    matchedOld?.listener_student_id || p.default_sabina_partner_id || "",
  );
  const [note, setNote] = useState(matchedOld?.remarks || "");
  const [status, setStatus] = useState<"assigned" | "completed">(
    matchedOld?.status || "completed",
  );

  const syncFromExisting = (nextMonth: string, nextWeek: number, nextDate: string) => {
    const found = allWeekly.find(
      (w) =>
        w.student_id === p.student_id &&
        (w.sabina_date === nextDate ||
          ((w.month_key || w.sabina_date.slice(0, 7)) === nextMonth &&
            w.week_number === nextWeek)),
    );
    if (found) {
      setHijriMonth(found.hijri_month_label || "");
      setFrom(found.assigned_para_from || 1);
      setTo(found.assigned_para_to || 1);
      setCounts(
        Object.fromEntries(
          (found.para_breakdown || []).map((r) => [r.para, r.mistakes]),
        ),
      );
      setPartner(found.listener_student_id || p.default_sabina_partner_id || "");
      setNote(found.remarks || "");
      setStatus(found.status || "completed");
    } else {
      setCounts({});
      setNote("");
      setStatus("completed");
    }
  };

  const handleSelectWeek = (nextMonth: string, nextWeek: number) => {
    const [yStr, mStr] = nextMonth.split("-");
    const year = Number(yStr) || new Date().getFullYear();
    const month = Math.max(1, Math.min(12, Number(mStr) || 1));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const thursdays: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(Date.UTC(year, month - 1, d));
      if (dt.getUTCDay() === 4) {
        thursdays.push(
          `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        );
      }
    }
    const nextDate =
      thursdays[nextWeek - 1] ||
      `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    setMonthKey(nextMonth);
    setWeekNumber(nextWeek);
    setSabinaDate(nextDate);
    onDateChange?.(nextDate);
    syncFromExisting(nextMonth, nextWeek, nextDate);
  };

  return (
    <form
      className="hz-card hz-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void submit({
          kind: "weekly",
          student_id: p.student_id,
          sabina_date: sabinaDate,
          week_number: weekNumber,
          month_key: monthKey,
          hijri_month_label: hijriMonth,
          listener_student_id: partner || null,
          para_from: from,
          para_to: to,
          counts,
          remarks: note,
          status,
        });
      }}
    >
      <h2>
        সাপ্তাহিক সবিনা · {["১ম", "২য়", "৩য়", "৪র্থ", "৫ম"][weekNumber - 1]} সপ্তাহ ({bn(sabinaDate)})
      </h2>

      {/* Custom Week & Month Selector */}
      <div className="hz-grid">
        <label>
          মাস ও বছর (ইংরেজি)
          <input
            type="month"
            value={monthKey}
            onChange={(e) => {
              if (e.target.value) handleSelectWeek(e.target.value, weekNumber);
            }}
          />
        </label>
        <label>
          আরবি / হিজরি মাস (ঐচ্ছিক)
          <input
            type="text"
            value={hijriMonth}
            onChange={(e) => setHijriMonth(e.target.value)}
            placeholder="যেমন: জুমাদাল উলা ১৪৪৮ হি."
          />
        </label>
        <label>
          সবিনার তারিখ (কাস্টম তারিখ দেওয়া যাবে)
          <input
            type="date"
            value={sabinaDate}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              setSabinaDate(v);
              setMonthKey(v.slice(0, 7));
              onDateChange?.(v);
              syncFromExisting(v.slice(0, 7), weekNumber, v);
            }}
          />
        </label>
      </div>

      <div>
        <div style={{ fontSize: "0.82rem", fontWeight: 700, marginBottom: "0.35rem" }}>
          সপ্তাহ নং নির্বাচন করুন:
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
          {[1, 2, 3, 4, 5].map((wk) => {
            const active = weekNumber === wk;
            return (
              <button
                key={wk}
                type="button"
                aria-pressed={active}
                onClick={() => handleSelectWeek(monthKey, wk)}
                style={{
                  padding: "0.4rem 0.75rem",
                  borderRadius: "0.6rem",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: active ? "1.5px solid #047857" : "1px solid #cbd5e1",
                  background: active ? "#059669" : "#ffffff",
                  color: active ? "#ffffff" : "#334155",
                }}
              >
                {["১ম", "২য়", "৩য়", "৪র্থ", "৫ম"][wk - 1]} সপ্তাহ
              </button>
            );
          })}
        </div>
      </div>

      <div className="hz-grid">
        <label>
          শ্রোতা / সঙ্গী
          <select value={partner} onChange={(e) => setPartner(e.target.value)}>
            <option value="">সঙ্গী নির্ধারিত নেই</option>
            {peers.map((s) => (
              <option key={s.id} value={s.id}>
                {studentName(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          অবস্থা
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="completed">শোনানো সম্পন্ন</option>
            <option value="assigned">শুধু পারা নির্ধারণ</option>
          </select>
        </label>
      </div>
      <RangeRows {...{ from, to, setFrom, setTo, counts, setCounts }} />
      <label>
        মন্তব্য
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button className="hz-save">সাপ্তাহিক সবিনা সংরক্ষণ করুন</button>
    </form>
  );
}
function Multi({
  label,
  items,
  selected,
  set,
}: {
  label: string;
  items: any[];
  selected: string[];
  set: (v: string[]) => void;
}) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="hz-grid">
        {items.map((s) => (
          <label key={s.id} className="hz-check">
            <input
              type="checkbox"
              checked={selected.includes(s.id)}
              onChange={(e) =>
                set(
                  e.target.checked
                    ? [...selected, s.id]
                    : selected.filter((id) => id !== s.id),
                )
              }
            />
            {studentName(s)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
function SittingForm({
  event: e,
  submit,
}: {
  event: SpecialSabina;
  submit: Submit;
}) {
  const p = e.participants,
    names = p.names || {},
    pair = e.listening_mode === "one_to_one",
    reciters = pair ? participantIds(p) : p.reciter_group_ids;
  const [reciter, setReciter] = useState(reciters[0]),
    [label, setLabel] = useState("ফজর"),
    [date, setDate] = useState(() => {
      const day = toDhakaDateString();
      return day < e.start_date || day > e.end_date ? e.start_date : day;
    }),
    [from, setFrom] = useState(1),
    [to, setTo] = useState(1),
    [counts, setCounts] = useState<Record<number, number>>({}),
    [excluded, setExcluded] = useState<string[]>([]);
  const possible = (
    pair
      ? participantIds(p)
      : [...p.listener_group_ids, ...p.teacher_listener_ids]
  ).filter((id) => id !== reciter);
  const [sessionId, setId] = useState(() => crypto.randomUUID());
  return (
    <form
      className="hz-stack"
      onSubmit={async (ev) => {
        ev.preventDefault();
        const hour = (
          { ফজর: "05", যোহর: "13", আসর: "16", মাগরিব: "18" } as Record<
            string,
            string
          >
        )[label];
        if (
          await submit({
            kind: "sitting",
            id: sessionId,
            event_id: e.id,
            session_label: label,
            reciter_id: reciter,
            listener_ids: possible.filter((id) => !excluded.includes(id)),
            para_from: from,
            para_to: to,
            counts,
            timestamp: `${date}T${hour}:00:00+06:00`,
          })
        ) {
          setId(crypto.randomUUID());
          setCounts({});
        }
      }}
    >
      <div className="hz-grid">
        <label>
          আসরের তারিখ
          <input
            type="date"
            min={e.start_date}
            max={e.end_date}
            value={date}
            required
            onChange={(ev) => setDate(ev.target.value)}
          />
        </label>
        <label>
          আসর
          <select value={label} onChange={(ev) => setLabel(ev.target.value)}>
            {["ফজর", "যোহর", "আসর", "মাগরিব"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          পাঠকারী
          <select
            value={reciter}
            onChange={(ev) => {
              setReciter(ev.target.value);
              setExcluded([]);
            }}
          >
            {reciters.map((id) => (
              <option key={id} value={id}>
                {names[id]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Multi
        label="উপস্থিত শ্রোতা"
        items={possible.map((id) => ({ id, first_name: names[id] }))}
        selected={possible.filter((id) => !excluded.includes(id))}
        set={(v) => setExcluded(possible.filter((id) => !v.includes(id)))}
      />
      <RangeRows {...{ from, to, setFrom, setTo, counts, setCounts }} />
      <button
        className="hz-save"
        disabled={possible.every((id) => excluded.includes(id))}
      >
        আসরের পাঠ সংরক্ষণ করুন
      </button>
    </form>
  );
}
export function SpecialForm({
  students,
  teachers,
  events,
  date,
  submit,
}: {
  students: any[];
  teachers: any[];
  events: SpecialSabina[];
  date: string;
  submit: Submit;
}) {
  const [mode, setMode] = useState<ListeningMode>("one_to_one"),
    [duration, setDuration] = useState(3),
    [title, setTitle] = useState(""),
    [start, setStart] = useState(date),
    [reciters, setReciters] = useState<string[]>([]),
    [listeners, setListeners] = useState<string[]>([]),
    [panel, setPanel] = useState<string[]>([]),
    [id, setId] = useState(() => crypto.randomUUID());
  const n = listeners.length + panel.length,
    valid =
      mode === "one_to_one"
        ? reciters.length === 1 && listeners.length === 1
        : mode === "one_to_many"
          ? reciters.length === 1 && n > 1
          : reciters.length > 0 && listeners.length > 0;
  return (
    <div className="hz-stack">
      <details className="hz-card" open={!events.length || undefined}>
        <summary>নতুন বিশেষ সবিনার আয়োজন</summary>
        <form
          className="hz-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await submit({
                kind: "special",
                id,
                title,
                start_date: start,
                duration_days: duration,
                listening_mode: mode,
                participants: {
                  reciter_group_ids: reciters,
                  listener_group_ids: listeners,
                  teacher_listener_ids: panel,
                },
              })
            ) {
              setTitle("");
              setId(crypto.randomUUID());
            }
          }}
        >
          <label>
            আয়োজনের নাম
            <input
              required
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <div className="hz-grid">
            <label>
              শুরুর তারিখ
              <input
                type="date"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              মেয়াদ
              <select
                value={duration}
                onChange={(e) => setDuration(+e.target.value)}
              >
                {[1, 3, 7].map((n) => (
                  <option key={n} value={n}>
                    {bn(n)} দিন
                  </option>
                ))}
              </select>
            </label>
            <label>
              শ্রবণ পদ্ধতি
              <select
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value as ListeningMode);
                  setPanel([]);
                  setListeners([]);
                  setReciters([]);
                }}
              >
                {Object.entries(modes).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p>শেষ তারিখ: {start ? bn(datePlus(start, duration - 1)) : "—"}</p>
          <Multi
            label="পাঠকারী নির্বাচন"
            items={students.filter((s) => !listeners.includes(s.id))}
            selected={reciters}
            set={(v) =>
              setReciters(mode === "group_to_group" ? v : v.slice(-1))
            }
          />
          <Multi
            label="শ্রোতা নির্বাচন"
            items={students.filter((s) => !reciters.includes(s.id))}
            selected={listeners}
            set={(v) => setListeners(mode === "one_to_one" ? v.slice(-1) : v)}
          />
          {mode === "one_to_many" && (
            <Multi
              label="শিক্ষক প্যানেল"
              items={teachers}
              selected={panel}
              set={setPanel}
            />
          )}
          <button disabled={!valid} className="hz-save">
            আয়োজন শুরু করুন
          </button>
        </form>
      </details>
      {events.map((e) => (
        <div className="hz-card hz-stack" key={e.id}>
          <EventReport event={e} />
          {e.status === "ongoing" && (
            <>
              <details>
                <summary>আসরের এন্ট্রি দিন</summary>
                <SittingForm event={e} submit={submit} />
              </details>
              <button
                onClick={() => {
                  if (confirm("এই আয়োজন সমাপ্ত করবেন?"))
                    void submit({ kind: "finish", event_id: e.id });
                }}
              >
                আয়োজন সমাপ্ত করুন
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
