"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HeartPulse, Phone, RefreshCw } from "lucide-react";
import { acknowledgeHealthAlertAction } from "@/app/actions/student-health";
import { useOfflinePortalSnapshot } from "@/hooks/useOfflinePortalData";
import { initialFullSync } from "@/lib/portal-sync";
import {
  displayTime,
  urgent,
  priority,
  recentRecovery,
  dialable,
  type PortalCase,
} from "@/lib/student-health/model";
import { Badges, Modal, Timeline, btn, primary } from "./HealthUI";
export default function FamilyHealthPanel({
  records,
  phone,
  owner,
  childId,
  name,
  offline = false,
}: {
  records: PortalCase[] | null;
  phone: string;
  owner: string;
  childId: string;
  name: string;
  offline?: boolean;
}) {
  const router = useRouter(),
    [pending, start] = useTransition(),
    [popup, setPopup] = useState(""),
    [hidden, setHidden] = useState<string[]>([]),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false);
  const list = (records || []).filter((r) => r.student_id === childId),
    active = list
      .filter((r) => r.status !== "recovered")
      .sort((a, b) => priority(b) - priority(a)),
    recovered = list.filter((r) => recentRecovery(r));
  const key = (r: PortalCase) =>
    `health-seen:${owner}:${childId}:${r.id}:${r.updated_at}`;
  const activeKeys = active.map(key).join("|");
  useEffect(() => {
    const next = activeKeys.split("|").find((k) => {
      if (!k || hidden.includes(k)) return false;
      try {
        return !sessionStorage.getItem(k);
      } catch {
        return true;
      }
    });
    setPopup(next || "");
    setError("");
  }, [activeKeys, hidden]);
  const selected = active.find((r) => key(r) === popup),
    contact = dialable(phone || "");
  const refresh = () => {
    start(() => router.refresh());
    if (navigator.onLine)
      void initialFullSync("student", { studentId: childId });
  };
  function dismiss() {
    if (!popup) return;
    try {
      sessionStorage.setItem(popup, "1");
    } catch {}
    setHidden((v) => [...v, popup]);
    setPopup("");
    setError("");
  }
  async function ack(r: PortalCase) {
    if (working) return;
    if (offline || !navigator.onLine) {
      setError("প্রাপ্তি নিশ্চিত করতে ইন্টারনেট সংযোগ প্রয়োজন।");
      return;
    }
    setWorking(true);
    setError("");
    try {
      const result = await acknowledgeHealthAlertAction(r.id, r.updated_at);
      if (result.ok) {
        dismiss();
        refresh();
      } else setError(result.error);
    } catch {
      setError("প্রাপ্তি নিশ্চিত হয়নি। সংযোগ ফিরে এলে আবার চেষ্টা করুন।");
    } finally {
      setWorking(false);
    }
  }
  const call = contact ? (
    <a className={btn} href={`tel:${contact}`}>
      <Phone size={16} />
      মাদরাসায় ফোন করুন · {phone}
    </a>
  ) : (
    <span className="text-sm">মাদরাসার জরুরি নম্বর সংরক্ষিত নেই।</span>
  );
  if (records === null)
    return (
      <div role="status" className="rounded-xl border border-amber-300 p-3">
        স্বাস্থ্য আপডেট পাওয়া যায়নি।{" "}
        {offline ? (
          "সংযোগ ফিরলে সর্বশেষ তথ্য দেখুন।"
        ) : (
          <button className={btn} onClick={refresh}>
            আবার চেষ্টা করুন
          </button>
        )}
      </div>
    );
  if (!active.length && !recovered.length) return null;
  function details(r: PortalCase) {
    const v = r.timeline[0];
    return (
      <div className="grid gap-2 text-sm">
        <p>
          চিকিৎসক/হাসপাতাল: <b>{r.doctor_or_hospital || "উল্লেখ নেই"}</b>
        </p>
        <p className="whitespace-pre-wrap break-words">
          ওষুধ ও পরিচর্যা: {r.treatment_notes || "এখনো নির্দেশনা দেওয়া হয়নি"}
        </p>
        {v && (
          <p className="whitespace-pre-wrap break-words">
            সর্বশেষ পর্যবেক্ষণ: {v.note}
            {v.temperature && ` · তাপমাত্রা: ${v.temperature}`}
          </p>
        )}
        <p>
          <time dateTime={r.updated_at}>
            আপডেট: {displayTime(r.updated_at)}
          </time>
        </p>
        <details>
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">
            চিকিৎসার বিস্তারিত ধারাবিবরণী
          </summary>
          <Timeline items={r.timeline} />
        </details>
      </div>
    );
  }
  return (
    <section
      aria-label="সন্তানের স্বাস্থ্য আপডেট"
      className="space-y-3 text-slate-900 dark:text-slate-100"
    >
      {active.map((r) => (
        <article
          key={r.id}
          className={`space-y-3 rounded-2xl border-s-4 p-4 ${urgent(r) ? "border-rose-600 bg-rose-50 dark:bg-rose-950" : "border-amber-500 bg-amber-50 dark:bg-amber-950"}`}
        >
          <h2 className="flex items-center gap-2 font-bold">
            <HeartPulse size={20} />
            {urgent(r) ? "জরুরি স্বাস্থ্য সতর্কতা" : "স্বাস্থ্য আপডেট"} · {name}
          </h2>
          <p className="flex flex-wrap items-center gap-2">
            <b>{r.illness_type}</b>
            <Badges {...r} />
          </p>
          {details(r)}
          <div className="flex flex-wrap items-center gap-2">
            {call}
            <button
              className={btn}
              onClick={refresh}
              disabled={offline || pending}
            >
              <RefreshCw size={16} />
              রিফ্রেশ
            </button>
            {!r.guardian_acknowledged_at && (
              <button className={btn} onClick={() => setPopup(key(r))}>
                বার্তাটি পড়ুন
              </button>
            )}
          </div>
          {r.guardian_acknowledged_at && (
            <p className="text-sm">
              প্রাপ্তি নিশ্চিত হয়েছে · {displayTime(r.guardian_acknowledged_at)}
            </p>
          )}
        </article>
      ))}
      {recovered.map((r) => (
        <article
          key={r.id}
          className="space-y-2 rounded-2xl border-s-4 border-emerald-500 bg-emerald-50 p-4 dark:bg-emerald-950"
        >
          <h2 className="font-bold">আলহামদুলিল্লাহ, আপনার সন্তান এখন সুস্থ</h2>
          <p>
            {name} · {r.illness_type} · {displayTime(r.recovered_at!)}
          </p>
          {details(r)}
        </article>
      ))}
      {selected && (
        <Modal
          title={
            urgent(selected)
              ? "জরুরি: সন্তানের স্বাস্থ্য সংবাদ"
              : "সন্তানের স্বাস্থ্য সংবাদ"
          }
          busy={working}
          close={dismiss}
        >
          <div
            className={`space-y-2 rounded-xl p-3 ${urgent(selected) ? "bg-rose-100 dark:bg-rose-950" : "bg-amber-100 dark:bg-amber-950"}`}
          >
            <h3 className="text-lg font-bold">
              {name} · {selected.illness_type}
            </h3>
            <Badges {...selected} />
          </div>
          {details(selected)}
          {call}
          {error && <p role="alert">{error}</p>}
          {offline && (
            <p>সংরক্ষিত কপি। প্রাপ্তি নিশ্চিত করতে ইন্টারনেট সংযোগ প্রয়োজন।</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              className={primary}
              disabled={working || offline}
              onClick={() => ack(selected)}
            >
              {working ? "সংরক্ষণ হচ্ছে…" : "আমি অবগত হয়েছি (Acknowledge)"}
            </button>
            <button className={btn} disabled={working} onClick={dismiss}>
              পরে দেখব
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

export function ScopedFamilyHealth({
  health,
  ...props
}: {
  health: { health_records: PortalCase[]; emergency_phone: string } | null;
  owner: string;
  childId: string;
  name: string;
}) {
  const offline = useOfflinePortalSnapshot();
  const cache = offline?.activeStudent?.id === props.childId ? offline : null;
  return (
    <FamilyHealthPanel
      {...props}
      records={
        cache ? (cache.healthRecords ?? null) : (health?.health_records ?? null)
      }
      phone={cache ? cache.emergencyPhone : health?.emergency_phone || ""}
      offline={!!cache}
    />
  );
}
