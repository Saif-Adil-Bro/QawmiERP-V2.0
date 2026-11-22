import { bn } from "./Report";
import { breakdown, marksLabel } from "@/lib/hifz-utils";
export type Submit = (body: Record<string, any>) => Promise<boolean>;
export function Counter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <small>{label}</small>
      <div className="hz-count">
        <button
          type="button"
          aria-label={`${label} কমান`}
          disabled={!value}
          onClick={() => onChange(value - 1)}
        >
          −
        </button>
        <output aria-label={label}>{bn(value)}</output>
        <button
          type="button"
          aria-label={`${label} বাড়ান`}
          onClick={() => onChange(Math.min(9999, value + 1))}
        >
          +
        </button>
      </div>
    </div>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  min = 1,
  max = 30,
  required = false,
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        required={required}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function RangeRows({
  from,
  to,
  setFrom,
  setTo,
  counts,
  setCounts,
}: {
  from: number;
  to: number;
  setFrom: (n: number) => void;
  setTo: (n: number) => void;
  counts: Record<number, number>;
  setCounts: (c: Record<number, number>) => void;
}) {
  const rows = breakdown(from, to, counts);
  return (
    <>
      <div className="hz-grid">
        <NumberField
          label="শুরুর পারা"
          value={from || ""}
          required
          onChange={(v) => setFrom(+v)}
        />
        <NumberField
          label="শেষ পারা"
          value={to || ""}
          required
          min={from || 1}
          onChange={(v) => setTo(+v)}
        />
      </div>
      {rows.map((r) => (
        <div key={r.para} className="hz-tr">
          <strong>পারা {bn(r.para)}</strong>
          <span className={"hz-pill hz-" + r.status}>
            {marksLabel[r.status]}
          </span>
          <Counter
            label={`পারা ${bn(r.para)} · ভুল`}
            value={r.mistakes}
            onChange={(v) => setCounts({ ...counts, [r.para]: v })}
          />
        </div>
      ))}
      <p className="hz-summary">
        শোনানো পারা {bn(rows.length)} · মোট ভুল{" "}
        {bn(rows.reduce((s, r) => s + r.mistakes, 0))} · নির্ভুল{" "}
        {bn(rows.filter((r) => !r.mistakes).length)} · দুর্বল{" "}
        {bn(rows.filter((r) => r.status === "weak").length)}
      </p>
    </>
  );
}
