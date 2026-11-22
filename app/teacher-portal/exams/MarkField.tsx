import { toBanglaNumber } from "@/lib/numberToBangla";
import type { ExamSubjectSubPart } from "@/lib/exam-subparts";

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
  sub_part_marks?: Record<string, string>;
  components?: Partial<Record<Part, string>>;
};
export type SavedMark = {
  student_id: string;
  marks_obtained: number | string | null;
  total_marks: number | string;
  sub_part_marks?: Record<string, number | string | null> | null;
} & Partial<Record<Part, number | string | null>>;

/** Shared by the desktop table and mobile cards. No focusable number fields in a frozen gradebook. */
export function MarkField({
  mark,
  subParts = [],
  readOnly,
  disabled,
  change,
  changeSubPart,
}: {
  mark: Mark;
  subParts?: ExamSubjectSubPart[];
  readOnly: boolean;
  disabled: boolean;
  change: (field: Part | "marks_obtained", value: string) => void;
  changeSubPart?: (partKey: string, value: string) => void;
}) {
  const value = mark.marks_obtained === "" ? "—" : toBanglaNumber(mark.marks_obtained);
  const savedTotal = <span className="font-semibold text-slate-800">{value}</span>;

  // Dynamic configured sub-parts take priority
  if (subParts.length > 0) {
    return (
      <div className="space-y-1.5">
        <div className="text-xs font-bold text-slate-800">
          মোট: <span className="text-emerald-700">{value}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {subParts.map((part) => {
            const val = mark.sub_part_marks?.[part.key] ?? "";
            return (
              <label className="block text-[11px] font-semibold text-slate-600" key={part.key}>
                <span className="block mb-0.5">
                  {part.name} ({toBanglaNumber(part.max_marks)})
                </span>
                {readOnly ? (
                  <span className="font-bold text-slate-800">
                    {val === "" ? "—" : toBanglaNumber(val)}
                  </span>
                ) : (
                  <input
                    type="number"
                    aria-label={`${part.name} (${part.max_marks})`}
                    min="0"
                    max={part.max_marks}
                    step="0.01"
                    disabled={disabled}
                    value={val}
                    placeholder={`০–${toBanglaNumber(part.max_marks)}`}
                    onChange={(e) => changeSubPart?.(part.key, e.target.value)}
                    className="w-24 min-h-[40px] md:min-h-0 px-2 py-1.5 text-sm font-bold text-emerald-900 border border-emerald-300 bg-emerald-50/40 rounded-lg focus:bg-white"
                  />
                )}
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  // Subjects WITHOUT sub-parts: clean single obtained marks field only
  const singleField = (
    <input
      type="number"
      aria-label="প্রাপ্ত নম্বর"
      min="0"
      max={mark.total_marks}
      step="0.01"
      disabled={disabled}
      value={mark.marks_obtained}
      placeholder="নম্বর লিখুন..."
      onChange={(e) => change("marks_obtained", e.target.value)}
      className="w-full min-h-[44px] md:min-h-0 md:w-28 px-2 py-2 text-sm font-bold text-purple-900 border border-purple-300 bg-purple-50/40 rounded-xl focus:bg-white"
    />
  );
  return readOnly ? savedTotal : singleField;
}
