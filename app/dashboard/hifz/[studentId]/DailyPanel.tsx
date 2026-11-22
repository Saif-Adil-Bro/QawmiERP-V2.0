"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveStudentHifzEntry } from "@/app/actions/hifz";
import DailyEntry from "@/app/teacher-portal/hifz/DailyEntry";
import type { HifzBundle } from "@/lib/hifz-utils";
import AddLogForm from "./AddLogForm";
export default function DailyPanel({
  id,
  bundle,
  initialDate,
}: {
  id: string;
  bundle: HifzBundle;
  initialDate: string;
}) {
  const [date, setDate] = useState(initialDate),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  useEffect(() => setDate(initialDate), [initialDate]);
  const p = bundle.hifz_profiles[0];
  return (
    <div id="daily-entry" className="hz">
      <div className="hz-card">
        <label>
          পাঠের তারিখ
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </label>
      </div>
      <fieldset disabled={busy}>
        <DailyEntry
          key={date + p.hifz_category}
          profile={p}
          date={date}
          logs={bundle.hifz_logs}
          submit={async (body) => {
            setBusy(true);
            try {
              const r = await saveStudentHifzEntry(id, body);
              setMessage(r.error || "সংরক্ষিত হয়েছে।");
              if (r.success) router.refresh();
              return !!r.success;
            } finally {
              setBusy(false);
            }
          }}
        />
      </fieldset>
      {message && <p role="status">{message}</p>}
      {p.hifz_category === "sabqi" && (
        <details className="hz-card">
          <summary>বিস্তারিত সবক, কায়দা ও নাজেরা এন্ট্রি</summary>
          <AddLogForm studentId={id} />
        </details>
      )}
    </div>
  );
}
