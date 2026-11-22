"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getOfflineDb } from "@/lib/offlineDb";
import { browserSession, ownerKey } from "@/lib/offline-auth";
import { backgroundSync, postTeacherEntry } from "@/lib/portal-sync";
import {
  latestThursday,
  participantIds,
  type HifzBundle,
} from "@/lib/hifz-utils";
import { projectDraft, snapshotBundle } from "@/lib/hifz/drafts";
import { bn, studentName } from "@/components/hifz/Report";
import DailyEntry from "./DailyEntry";
import { ProfileForm, SpecialForm, WeeklyForm } from "./SabinaForms";
import HifzReportPrintModal from "@/components/hifz/HifzReportPrintModal";
export type HifzSeed = {
  classes: any[];
  students: any[];
  teachers: any[];
  bundle: HifzBundle;
  owner: string;
  asOf: number;
};
const tabs = [
  "দৈনিক এন্ট্রি",
  "বৃহস্পতিবারের সবিনা",
  "বিশেষ সবিনা",
  "শিক্ষার্থী প্রোফাইল",
];
export default function HifzForm({
  seed,
  currentDate,
  currentClassId,
  onSave,
}: {
  seed: HifzSeed;
  currentDate: string;
  currentClassId: string;
  onSave?: (body: Record<string, any>) => Promise<{ success?: boolean; error?: string }>;
}) {
  const { owner } = seed;
  const [tab, setTab] = useState(0),
    [cls, setClass] = useState(currentClassId || seed.classes[0]?.id || ""),
    [student, setStudent] = useState(""),
    [date, setDate] = useState(currentDate),
    [week, setWeek] = useState(latestThursday(currentDate)),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [changed, setChanged] = useState(false),
    [printOpen, setPrintOpen] = useState(false),
    saving = useRef(false);
  const [immediate, setImmediate] = useState<{ body: any; time: number }[]>([]);
  useEffect(() => {
    if (onSave) return;
    const change = () => setChanged(ownerKey(browserSession()) !== owner);
    window.addEventListener("storage", change);
    return () => window.removeEventListener("storage", change);
  }, [owner, onSave]);
  const local = useLiveQuery(async () => {
    if (onSave || ownerKey(browserSession()) !== owner) return null;
    const db = getOfflineDb(owner);
    const [snap, pending] = await Promise.all([
      db.portalSnapshots.get("teacher:"),
      db.offlineOutbox.where("actionType").equals("hifz").sortBy("createdAt"),
    ]);
    return { snap, pending };
  }, [owner, onSave]);
  const snap =
    local?.snap?.owner === owner && local.snap.syncedAt >= seed.asOf
      ? local.snap
      : undefined;
  const students = snap?.data.students ?? seed.students,
    teachers = snap?.data.hifzListeners ?? seed.teachers,
    classes = snap?.data.classes ?? seed.classes;
  const names = useMemo(
    () =>
      Object.fromEntries(
        [...students, ...teachers].map((s) => [s.id, studentName(s)]),
      ),
    [students, teachers],
  );
  const base = useMemo(
    () => (snap ? snapshotBundle(snap.data) : seed.bundle),
    [snap, seed],
  );
  const b = useMemo(() => {
    let b = base;
    const drafts = [
      ...immediate
        .filter((x) => x.time > (snap?.syncedAt || seed.asOf))
        .map((x) => x.body),
      ...(local?.pending || [])
        .filter((v) => !v.rejected)
        .map((v) => v.payload),
    ];
    for (const d of drafts) {
      try {
        b = projectDraft(b, d, names);
      } catch {
        /* Old incompatible queued entry; preserve for the server, do not corrupt the snapshot. */
      }
    }
    return b;
  }, [base, immediate, snap, seed.asOf, local, names]);
  const roster = students.filter((s) => s.class_id === cls),
    q = query
      .trim()
      .replace(/[০-৯]/g, (n) => String("০১২৩৪৫৬৭৮৯".indexOf(n)))
      .toLowerCase();
  const match = roster.filter(
    (s) =>
      (!q ||
        `${studentName(s)} ${s.roll_number ?? ""} ${s.student_id ?? ""}`
          .toLowerCase()
          .includes(q)) &&
      (!category ||
        b.hifz_profiles.find((p) => p.student_id === s.id)?.hifz_category ===
          category),
  );
  const current = match.find((s) => s.id === student) || match[0],
    id = current?.id,
    p = b.hifz_profiles.find((p) => p.student_id === id),
    peers = roster.filter((s) => s.id !== id);
  async function submit(input: Record<string, any>) {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (!cls) throw new Error("জামাত নির্বাচন করুন।");
      const body = { ...input, current_class_id: cls };
      projectDraft(b, body, names);
      if (onSave) {
        const res = await onSave(body);
        if (res?.error) throw new Error(res.error);
        setImmediate((old) => [...old, { body, time: Date.now() }]);
        setMessage("এন্ট্রি সফলভাবে সংরক্ষিত হয়েছে।");
        return true;
      }
      if (owner !== ownerKey(browserSession()))
        throw new Error("অ্যাকাউন্ট যাচাই করে পেজ খুলুন।");
      const r = await postTeacherEntry("hifz", body, owner);
      if (!r.offlineQueued) {
        setImmediate((old) => [...old, { body, time: Date.now() }]);
        void backgroundSync("teacher").catch(() => {});
      }
      setMessage(
        r.offlineQueued
          ? "ডিভাইসে সংরক্ষিত। সংযোগ ফিরলে সিঙ্ক হবে।"
          : "এন্ট্রি সংরক্ষিত হয়েছে।",
      );
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "সংরক্ষণ হয়নি।");
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  if (!onSave && changed) return <p>অ্যাকাউন্ট পরিবর্তিত হয়েছে। পেজ আবার খুলুন।</p>;
  return (
    <section className="hz">
      <link rel="stylesheet" href="/hifz.css" />
      <nav className="hz-tabs" aria-label="হিফজ এন্ট্রির ধরন">
        {tabs.map((t, i) => (
          <button
            key={t}
            aria-pressed={tab === i}
            onClick={() => {
              setTab(i);
              setMessage("");
            }}
          >
            {t}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPrintOpen(true)}
          style={{
            marginLeft: "auto",
            background: "#0f172a",
            color: "#ffffff",
            borderColor: "#0f172a",
          }}
        >
          🖨️ খাতা প্রিন্ট (A5 / A4)
        </button>
      </nav>
      <HifzReportPrintModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        students={roster.length ? roster : students}
        bundle={b}
        classes={classes}
        defaultStudentId={id}
      />
      <div className="hz-card hz-grid">
        <label>
          জামাত
          <select
            value={cls}
            onChange={(e) => {
              setClass(e.target.value);
              setStudent("");
              setMessage("");
            }}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {tab !== 2 && (
          <>
            <label>
              নাম বা রোল দিয়ে খুঁজুন
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="নাম / রোল"
              />
            </label>
            <label>
              শিক্ষার্থীর স্তর
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">সব স্তর</option>
                <option value="sabqi">সবকী</option>
                <option value="khatmi">খতমী</option>
              </select>
            </label>
            <label>
              শিক্ষার্থী
              <select
                value={id || ""}
                onChange={(e) => setStudent(e.target.value)}
              >
                {match.map((s) => (
                  <option key={s.id} value={s.id}>
                    {bn(s.roll_number)} · {studentName(s)}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {(tab === 0 || tab === 1) && (
          <label>
            {tab === 1 ? "বৃহস্পতিবার নির্বাচন" : "পাঠের তারিখ"}
            <input
              type="date"
              value={tab === 1 ? week : date}
              onChange={(e) => {
                const v = e.target.value;
                if (v) tab === 1 ? setWeek(v) : setDate(v);
              }}
            />
          </label>
        )}
      </div>
      <fieldset
        key={local ? "with-drafts" : "initial"}
        disabled={busy}
        style={{ padding: 0, background: "transparent", border: 0 }}
      >
        {tab === 2 ? (
          <SpecialForm
            key={cls}
            students={roster}
            teachers={teachers}
            date={date}
            events={b.hifz_special_sabina.filter((e) =>
              participantIds(e.participants).every((id) =>
                roster.some((s) => s.id === id),
              ),
            )}
            submit={submit}
          />
        ) : !current || !p ? (
          <p className="hz-card">এই ফিল্টারে কোনো শিক্ষার্থী নেই।</p>
        ) : tab === 0 ? (
          <DailyEntry
            key={[id, date, p.hifz_category].join(":")}
            profile={p}
            date={date}
            logs={b.hifz_logs.filter((l) => l.student_id === id)}
            submit={submit}
          />
        ) : tab === 1 ? (
          <WeeklyForm
            key={id}
            p={p}
            peers={peers}
            date={week}
            allWeekly={b.hifz_weekly_sabina}
            onDateChange={setWeek}
            submit={submit}
          />
        ) : (
          <ProfileForm key={id} p={p} peers={peers} submit={submit} />
        )}
      </fieldset>
      {!!local?.pending.length && (
        <p className="hz-summary">
          সিঙ্কের অপেক্ষায় {bn(local.pending.filter((v) => !v.rejected).length)}
          টি এন্ট্রি।{" "}
          {local.pending.find((v) => v.status === "failed")?.lastError}
        </p>
      )}
      {local?.pending
        .filter((i) => i.rejected === "HIFZ_REVIEW")
        .map((i) => (
          <details key={i.id} className="hz-card">
            <summary>
              পুনরায় যাচাই প্রয়োজন ·{" "}
              {
                (
                  {
                    daily: "দৈনিক পাঠ",
                    profile: "প্রোফাইল",
                    weekly: "সাপ্তাহিক সবিনা",
                    special: "বিশেষ সবিনা",
                    sitting: "আসর",
                    finish: "সমাপ্তি",
                  } as Record<string, string>
                )[String(i.payload.kind || "daily")]
              }
            </summary>
            <p>{i.lastError} · সর্বশেষ তথ্য দেখে নতুন এন্ট্রি দিন।</p>
            <button
              onClick={async () => {
                if (
                  ownerKey(browserSession()) === owner &&
                  confirm("এই মুলতবি খসড়া বাদ দেবেন?")
                )
                  await getOfflineDb(owner).offlineOutbox.delete(i.id);
              }}
            >
              খসড়া বাদ দিন
            </button>
          </details>
        ))}
      {(busy || message) && (
        <p className="hz-status" role="status">
          {busy ? "সংরক্ষণ হচ্ছে…" : message}
        </p>
      )}
    </section>
  );
}
