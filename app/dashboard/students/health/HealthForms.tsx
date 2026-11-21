"use client";
import { useState, type FormEvent } from "react";
import {
  createHealthRecordAction,
  addHealthFollowupAction,
  sendGuardianHealthAlertAction,
} from "@/app/actions/student-health";
import {
  severities,
  statuses,
  statusLabel,
  severityLabel,
  illnessTypes,
  guardianMessage,
  searchStudent,
  dialable,
  type Severity,
  type HealthStatus,
  type HealthStudent,
  type StaffCase,
  type HealthResult,
  type HealthChannel,
} from "@/lib/student-health/model";
import {
  Field,
  Badges,
  Modal,
  Timeline,
  btn,
  primary,
  input,
} from "@/components/student-health/HealthUI";
import { MessageSquare, Phone, Send } from "lucide-react";
type Common = { close: () => void; done: (message: string) => void };
export function classChoices(students: HealthStudent[]) {
  return [
    ...new Map(
      students
        .filter((s) => s.class_id)
        .map((s) => [s.class_id!, s.class_name || "নামহীন জামাত"]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1], "bn"));
}
function useSubmit(done: Common["done"]) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(fn: () => Promise<HealthResult<unknown>>, ok: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fn();
      if (r.ok) done(ok + (r.warning ? " " + r.warning : ""));
      else setError(r.error);
    } catch {
      setError(
        "সার্ভারের সঙ্গে সংযোগ হয়নি। আবার চেষ্টা করার আগে নথিটি যাচাই করুন।",
      );
    } finally {
      setBusy(false);
    }
  }
  return { busy, run, error };
}
const ErrorText = ({ text }: { text: string }) =>
  text ? (
    <p
      role="alert"
      className="rounded-xl bg-rose-100 p-3 text-sm text-rose-900 dark:bg-rose-950 dark:text-rose-100"
    >
      {text}
    </p>
  ) : null;
function StateFields({
  status,
  severity,
  setStatus,
  setSeverity,
  allowRecovered = false,
}: {
  status: HealthStatus;
  severity: Severity;
  setStatus: (v: HealthStatus) => void;
  setSeverity: (v: Severity) => void;
  allowRecovered?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="অবস্থা">
        <select
          className={input}
          value={status}
          onChange={(e) => setStatus(e.target.value as HealthStatus)}
        >
          {statuses
            .filter((s) => allowRecovered || s !== "recovered")
            .map((s) => (
              <option key={s} value={s}>
                {statusLabel[s]}
              </option>
            ))}
        </select>
      </Field>
      <Field label="তীব্রতা">
        <select
          className={input}
          value={severity}
          onChange={(e) => setSeverity(e.target.value as Severity)}
        >
          {severities.map((s) => (
            <option key={s} value={s}>
              {severityLabel[s]}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
function Notify({
  preview,
  checked,
  set,
}: {
  preview: string;
  checked: boolean;
  set: (v: boolean) => void;
}) {
  return (
    <div className="rounded-xl bg-teal-50 p-3 dark:bg-teal-950">
      <label className="flex min-h-11 items-center gap-3 font-semibold">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => set(e.target.checked)}
        />
        সংরক্ষণের সঙ্গে অভিভাবককে এসএমএস পাঠান
      </label>
      {checked && (
        <p className="text-sm leading-relaxed">বার্তার খসড়া: {preview}</p>
      )}
    </div>
  );
}
function value(f: FormData, key: string) {
  return String(f.get(key) || "").trim();
}
export function NewReport({
  students,
  close,
  done,
}: Common & { students: HealthStudent[] }) {
  const [group, setGroup] = useState(""),
    [term, setTerm] = useState(""),
    [id, setId] = useState(""),
    [preset, setPreset] = useState(illnessTypes[0]),
    [custom, setCustom] = useState(""),
    [status, setStatus] = useState<HealthStatus>("observing"),
    [severity, setSeverity] = useState<Severity>("mild"),
    [notify, setNotify] = useState(false);
  const s = students.find((s) => s.id === id),
    illness = preset === "অন্যান্য" ? custom : preset,
    options = students.filter(
      (s) => (!group || s.class_id === group) && searchStudent(s, term),
    );
  const { run, busy, error } = useSubmit(done);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!s) return;
    const f = new FormData(e.currentTarget);
    void run(
      () =>
        createHealthRecordAction({
          student_id: s.id,
          illness_type: illness,
          severity,
          status,
          symptoms: value(f, "symptoms"),
          temperature: value(f, "temperature"),
          treatment_notes: value(f, "care"),
          doctor_or_hospital: value(f, "doctor"),
          boarding_diet_note: value(f, "diet"),
          notifyGuardian: notify,
        }),
      "স্বাস্থ্য নথি সংরক্ষিত হয়েছে।",
    );
  }
  return (
    <Modal title="নতুন স্বাস্থ্য নথি" close={close} busy={busy}>
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="জামাত">
            <select
              className={input}
              value={group}
              onChange={(e) => {
                setGroup(e.target.value);
                setId("");
              }}
            >
              <option value="">সব জামাত</option>
              {classChoices(students).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="রোল, আইডি বা নাম দিয়ে খুঁজুন">
            <input
              className={input}
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setId("");
              }}
            />
          </Field>
        </div>
        <Field label="শিক্ষার্থী নির্বাচন *">
          <select
            className={input}
            required
            value={id}
            onChange={(e) => setId(e.target.value)}
          >
            <option value="">
              {options.length
                ? "শিক্ষার্থী বেছে নিন"
                : "কোনো শিক্ষার্থী মেলেনি"}
            </option>
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.class_name} · রোল {s.roll_number || "—"} ·{" "}
                {s.student_id_code}
              </option>
            ))}
          </select>
        </Field>
        {s && (
          <div className="flex items-center gap-3 rounded-xl border border-teal-300 p-3">
            {s.photo_url ? (
              <img
                alt={s.name}
                src={s.photo_url}
                className="size-14 rounded-full object-cover"
              />
            ) : (
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-teal-100 text-xl font-bold text-teal-800">
                {s.name[0]}
              </span>
            )}
            <div>
              <b>{s.name}</b>
              <p className="text-sm">
                {s.class_name} · রোল {s.roll_number || "—"}
              </p>
              <p className="text-sm">
                অভিভাবক: {s.guardian_name || "নাম নেই"} ·{" "}
                {s.parent_phone || "নম্বর নেই"}
              </p>
            </div>
          </div>
        )}
        <Field label="অসুস্থতার ধরন">
          <select
            className={input}
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
          >
            {illnessTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        {preset === "অন্যান্য" && (
          <Field label="অসুস্থতার নাম *">
            <input
              required
              className={input}
              maxLength={160}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          </Field>
        )}
        <StateFields {...{ status, severity, setStatus, setSeverity }} />
        <Field label="উপসর্গ">
          <textarea className={input} name="symptoms" maxLength={2400} />
        </Field>
        <Field label="তাপমাত্রা (এককসহ)">
          <input
            className={input}
            name="temperature"
            maxLength={40}
            placeholder="যেমন ৩৮°সে."
          />
        </Field>
        <Field label="ওষুধ ও পরিচর্যার নির্দেশনা">
          <textarea className={input} name="care" maxLength={2400} />
        </Field>
        <Field label="চিকিৎসক বা হাসপাতাল">
          <input className={input} name="doctor" maxLength={160} />
        </Field>
        <Field label="বোর্ডিংয়ের বিশেষ খাবারের নির্দেশনা">
          <input className={input} name="diet" maxLength={2400} />
        </Field>
        <Notify
          preview={guardianMessage(
            s?.name || "আপনার সন্তান",
            illness || "অসুস্থতা",
            { status, severity },
          )}
          checked={notify}
          set={setNotify}
        />
        <ErrorText text={error} />
        <button disabled={busy || !s} className={primary}>
          {busy ? "সংরক্ষণ হচ্ছে…" : "নথি সংরক্ষণ করুন"}
        </button>
      </form>
    </Modal>
  );
}
export function FollowupForm({
  record: r,
  recover,
  close,
  done,
}: Common & { record: StaffCase; recover: boolean }) {
  const [severity, setSeverity] = useState(r.severity),
    [status, setStatus] = useState<HealthStatus>(
      recover ? "recovered" : r.status,
    ),
    [notify, setNotify] = useState(false);
  const { run, busy, error } = useSubmit(done);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run(
      () =>
        addHealthFollowupAction(r.id, {
          status,
          severity,
          note: value(f, "note"),
          temperature: value(f, "temperature"),
          treatment_notes: recover ? undefined : value(f, "care"),
          boarding_diet_note: recover ? undefined : value(f, "diet"),
          expectedUpdatedAt: r.updated_at,
          notifyGuardian: notify,
        }),
      "স্বাস্থ্য নথি হালনাগাদ হয়েছে।",
    );
  }
  return (
    <Modal
      title={recover ? "সুস্থতা নিশ্চিত করুন" : "স্বাস্থ্য নথি ও ফলো-আপ"}
      close={close}
      busy={busy}
    >
      <div>
        <b>
          {r.student.name} · {r.illness_type}
        </b>
        <p>{r.symptoms}</p>
        <Badges {...r} />
      </div>
      {!recover && (
        <>
          <p>চিকিৎসক/হাসপাতাল: {r.doctor_or_hospital || "উল্লেখ নেই"}</p>
          <h3 className="font-bold">চিকিৎসার ধারাবিবরণী</h3>
          <Timeline items={r.timeline} />
        </>
      )}
      {r.status !== "recovered" && (
        <form
          className="space-y-3 border-t border-slate-300 pt-4"
          onSubmit={submit}
        >
          {!recover && (
            <StateFields
              {...{ status, severity, setStatus, setSeverity }}
              allowRecovered
            />
          )}
          <Field label="ফলো-আপ মন্তব্য *">
            <textarea
              className={input}
              name="note"
              maxLength={2400}
              required
              defaultValue={recover ? "সুস্থতা নিশ্চিত করা হয়েছে।" : ""}
            />
          </Field>
          {!recover && (
            <>
              <Field label="তাপমাত্রা (এককসহ)">
                <input className={input} name="temperature" maxLength={40} />
              </Field>
              <Field label="ওষুধ ও পরিচর্যার নির্দেশনা">
                <textarea
                  className={input}
                  name="care"
                  defaultValue={r.treatment_notes}
                  maxLength={2400}
                />
              </Field>
              <Field label="বিশেষ খাবারের নির্দেশনা">
                <input
                  className={input}
                  name="diet"
                  defaultValue={r.boarding_diet_note || ""}
                  maxLength={2400}
                />
              </Field>
            </>
          )}
          <Notify
            preview={guardianMessage(r.student.name, r.illness_type, {
              status,
              severity,
            })}
            checked={notify}
            set={setNotify}
          />
          <ErrorText text={error} />
          <button disabled={busy} className={primary}>
            {busy
              ? "সংরক্ষণ হচ্ছে…"
              : recover
                ? "সুস্থ হিসেবে সংরক্ষণ করুন"
                : "ফলো-আপ সংরক্ষণ করুন"}
          </button>
        </form>
      )}
    </Modal>
  );
}
export function AlertForm({
  record: r,
  close,
  done,
}: Common & { record: StaffCase }) {
  const [message, setMessage] = useState(
      guardianMessage(r.student.name, r.illness_type, r),
    ),
    { run, busy, error } = useSubmit(done);
  const phone = dialable(r.student.parent_phone);
  function send(channel: HealthChannel) {
    void run(
      () =>
        sendGuardianHealthAlertAction(r.id, {
          customMessage: message.trim(),
          channels: [channel],
          expectedUpdatedAt: r.updated_at,
        }),
      "অভিভাবককে বার্তা পাঠানো হয়েছে।",
    );
  }
  return (
    <Modal title="অভিভাবককে স্বাস্থ্য আপডেট" close={close} busy={busy}>
      <p>
        {r.student.name} · {r.student.guardian_name || "অভিভাবক"} ·{" "}
        {phone || "নম্বর নেই"}
      </p>
      <Field label="বার্তা (সম্পাদনা করা যাবে)">
        <textarea
          className={input}
          rows={5}
          maxLength={1200}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </Field>
      <ErrorText text={error} />
      <div className="flex flex-wrap gap-2">
        <button
          className={primary}
          disabled={busy || !phone || !message.trim()}
          onClick={() => send("sms")}
        >
          <Send size={16} />
          এসএমএস পাঠান
        </button>
        <button
          className={btn}
          disabled={busy || !phone || !message.trim()}
          onClick={() => send("whatsapp")}
        >
          <MessageSquare size={16} />
          হোয়াটসঅ্যাপ
        </button>
        <button
          className={btn}
          disabled={busy || !message.trim()}
          onClick={() => send("push")}
        >
          পুশ বার্তা
        </button>
        {phone && (
          <a className={btn} href={`tel:${phone}`}>
            <Phone size={16} />
            ফোন করুন
          </a>
        )}
      </div>
    </Modal>
  );
}
