import { toBanglaNumber } from "@/lib/numberToBangla";

const labels = {
  written_marks: "লিখিত",
  oral_marks: "মৌখিক",
  tutorial_marks: "টিউটোরিয়াল",
  attendance_marks: "উপস্থিতি",
};
export type Part = keyof typeof labels;
export const parts = Object.keys(labels) as Part[];
export type Mark = {
  marks_obtained: string;
  total_marks: string;
  components?: Partial<Record<Part, string>>;
};
export type SavedMark = {
  student_id: string;
  marks_obtained: number | string | null;
  total_marks: number | string;
} & Partial<Record<Part, number | string | null>>;

/** Shared by the desktop table and mobile cards. No focusable number fields in a frozen gradebook. */
export function MarkField({
  mark,
  readOnly,
  disabled,
  change,
}: {
  mark: Mark;
  readOnly: boolean;
  disabled: boolean;
  change: (field: Part | "marks_obtained", value: string) => void;
}) {
  const value = mark.marks_obtained === "" ? "—" : toBanglaNumber(mark.marks_obtained);
  const savedTotal = <span className="font-semibold text-slate-800">{value}</span>;
  const field = (name: Part | "marks_obtained", text: string) => (
    <input
      type="number"
      aria-label={name === "marks_obtained" ? "প্রাপ্ত নম্বর" : labels[name]}
      min="0"
      max={mark.total_marks}
      step="0.01"
      disabled={disabled}
      value={text}
      placeholder="নম্বর লিখুন..."
      onChange={(e) => change(name, e.target.value)}
      className="w-full min-h-[44px] md:min-h-0 md:w-28 px-2 py-2 text-sm font-bold text-purple-900 border border-purple-300 bg-purple-50/40 rounded-xl focus:bg-white"
    />
  );
  if (!mark.components) return readOnly ? savedTotal : field("marks_obtained", mark.marks_obtained);
  // A component-graded result's total must equal its parts. Edit the parts instead of offering a doomed total edit.
  return (
    <div className="space-y-1">
      <strong>মোট: {value}</strong>
      {parts
        .filter((k) => mark.components![k] !== undefined)
        .map((k) => (
          <label className="block text-xs text-slate-600" key={k}>
            {labels[k]}: {readOnly ? toBanglaNumber(mark.components![k]) : field(k, mark.components![k]!)}
          </label>
        ))}
    </div>
  );
}
