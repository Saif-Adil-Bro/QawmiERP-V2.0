/**
 * Unified Notification Template Renderer (Feature 2.2)
 *
 * Supports both `{VarName}` (English/camelCase/snake_case) and `[বাংলা ট্যাগ]`
 * placeholders, with clean cross-mapping and strict unresolved-placeholder
 * stripping so `"undefined"`, `"null"`, or raw `{...}` / `[...]` tags never leak.
 */

const ALIAS_GROUPS: string[][] = [
  ["StudentName", "studentName", "student_name", "name", "ছাত্রের নাম", "শিক্ষার্থীর নাম"],
  ["RollNumber", "rollNumber", "roll_number", "roll", "Id", "id", "রোল", "রোল নম্বর", "আইডি"],
  ["ClassName", "className", "class_name", "class", "জামাত", "শ্রেণি", "জামাত/শ্রেণি"],
  ["ParentName", "parentName", "parent_name", "guardianName", "guardian_name", "fatherName", "father_name", "পিতার নাম", "অভিভাবকের নাম"],
  ["Phone", "phone", "parentPhone", "parent_phone", "mobile", "মোবাইল", "ফোন"],
  ["DueAmount", "dueAmount", "due_amount", "totalDue", "total_due", "বকেয়া টাকা", "বকেয়া টাকা", "বকেয়া", "বকেয়া"],
  ["PaidAmount", "paidAmount", "paid_amount", "amount", "Amount", "পরিমাণ", "টাকা", "আদায়কৃত টাকা"],
  ["Month", "month", "billingPeriod", "billing_period", "period", "Period", "মাস"],
  ["Date", "date", "TodayDate", "todayDate", "today_date", "তারিখ", "আজকের তারিখ"],
  ["DayName", "dayName", "day_name", "বার", "দিন"],
  ["MadrasaName", "madrasaName", "madrasa_name", "মাদরাসা", "মাদ্রাসা", "মাদ্রাসার নাম"],
  ["PaymentUrl", "paymentUrl", "payment_url", "paymentLink", "payment_link", "পেমেন্ট লিংক", "লিংক"],
  ["Title", "title", "শিরোনাম"],
  ["Status", "status", "অবস্থা", "স্ট্যাটাস"],
  ["ReceiptNo", "receiptNo", "receipt_no", "রসিদ নম্বর", "রশিদ নম্বর"],
  ["ExamTitle", "examTitle", "exam_title", "পরীক্ষার নাম", "পরীক্ষা"],
];

const KEY_TO_GROUP = new Map<string, string[]>();
for (const group of ALIAS_GROUPS) {
  for (const key of group) {
    KEY_TO_GROUP.set(key.toLowerCase(), group);
  }
}

function buildLookupMap(
  variables: Record<string, string | number | null | undefined>
): Map<string, string> {
  const lookup = new Map<string, string>();
  if (!variables || typeof variables !== "object") return lookup;

  for (const [rawKey, rawVal] of Object.entries(variables)) {
    if (rawVal === null || rawVal === undefined) continue;
    const strVal = String(rawVal);
    if (strVal === "undefined" || strVal === "null") continue;

    const trimmedKey = rawKey.trim();
    if (!trimmedKey) continue;

    lookup.set(trimmedKey, strVal);
    lookup.set(trimmedKey.toLowerCase(), strVal);

    const group = KEY_TO_GROUP.get(trimmedKey.toLowerCase());
    if (group) {
      for (const alias of group) {
        if (!lookup.has(alias)) lookup.set(alias, strVal);
        if (!lookup.has(alias.toLowerCase())) lookup.set(alias.toLowerCase(), strVal);
      }
    }
  }

  return lookup;
}

export function renderNotificationTemplate(
  template: string,
  variables: Record<string, string | number | null | undefined> = {}
): string {
  if (!template || typeof template !== "string") return "";

  const lookup = buildLookupMap(variables);

  // Single-pass replacement so `[...]` inside substituted `{VarName}` values is preserved
  let rendered = template.replace(
    /\{([^{}]+)\}|\[([^\[\]]+)\]/g,
    (_match, braceKey?: string, bracketKey?: string) => {
      const key = String(braceKey ?? bracketKey ?? "").trim();
      const val = lookup.get(key) ?? lookup.get(key.toLowerCase());
      return val !== undefined ? val : "";
    }
  );

  // Collapse extra spaces caused by stripped placeholders while preserving newlines
  rendered = rendered
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +\n/g, "\n")
    .replace(/\n +/g, "\n")
    .trim();

  return rendered;
}
