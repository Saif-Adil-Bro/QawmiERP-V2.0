import type {
  ErpWidgetBridgeData,
  WidgetConfigItem,
  WidgetPermission,
} from "./types";

export const DEFAULT_BUILTIN_WIDGETS: WidgetConfigItem[] = [
  {
    id: "builtin-kpi",
    type: "builtin",
    title: "প্রধান পরিসংখ্যান ও KPI কার্ড",
    description:
      "মোট শিক্ষার্থী, শিক্ষক, আজকের হাজিরা এবং আয়-ব্যয়ের সারসংক্ষেপ",
    version: "1.0.0",
    author: "QawmiERP Core",
    enabled: true,
    order: 1,
    size: "full",
  },
  {
    id: "builtin-early-warning",
    type: "builtin",
    title: "আর্লি ওয়ার্নিং ও ঝুঁকি সতর্কতা",
    description: "অনুপস্থিতি ও পরীক্ষার ফলাফল পতনের স্বয়ংক্রিয় সতর্কবার্তা",
    version: "1.0.0",
    author: "QawmiERP Core",
    enabled: true,
    order: 2,
    size: "full",
  },
  {
    id: "builtin-anomalies",
    type: "builtin",
    title: "আর্থিক অসঙ্গতি (Anomaly) সতর্কতা",
    description: "অস্বাভাবিক খরচ বা লেনদেন শনাক্তকরণ ব্যানার",
    version: "1.0.0",
    author: "QawmiERP Core",
    enabled: true,
    order: 3,
    size: "full",
  },
  {
    id: "builtin-charts",
    type: "builtin",
    title: "আয়-ব্যয় ও উপস্থিতি চার্ট",
    description: "মাসিক আয়-ব্যয়, হাজিরা ও পরীক্ষার পাসের হারের গ্রাফ",
    version: "1.0.0",
    author: "QawmiERP Core",
    enabled: true,
    order: 4,
    size: "full",
  },
  {
    id: "builtin-prayer-hijri",
    type: "builtin",
    title: "হিজরি তারিখ ও নামাজের সময়সূচি",
    description: "আজকের হিজরি, বাংলা ও ইংরেজি তারিখ এবং ওয়াক্তের সময়",
    version: "1.0.0",
    author: "QawmiERP Core",
    enabled: true,
    order: 5,
    size: "half",
  },
  {
    id: "builtin-quick-actions",
    type: "builtin",
    title: "দ্রুত অ্যাকশন ও শর্টকাট",
    description:
      "নতুন ভর্তি, ফি কালেকশন, হাজিরা ও অনুমোদন কিউ-তে দ্রুত যাওয়ার শর্টকাট",
    version: "1.0.0",
    author: "QawmiERP Core",
    enabled: true,
    order: 6,
    size: "half",
  },
  {
    id: "builtin-sick-students",
    type: "builtin",
    title: "অসুস্থ শিক্ষার্থী ও স্বাস্থ্য আপডেট",
    description:
      "বর্তমানে অসুস্থ ও চিকিৎসাধীন শিক্ষার্থীদের লাইভ তালিকা, গুরুতর সতর্কতা এবং দ্রুত অভিভাবক মেসেজ",
    version: "1.0.0",
    author: "QawmiERP Core",
    enabled: true,
    order: 7,
    size: "half",
  },
  {
    id: "builtin-hifz-tracker",
    type: "builtin",
    title: "হিফজুল কুরআন ও সবিনা সারসংক্ষেপ",
    description:
      "সবকী বনাম খতমী শিক্ষার্থী, আজকের এন্ট্রি, সাপ্তাহিক বৃহস্পতিবারের সবিনা ও চলমান বিশেষ সবিনা",
    version: "1.0.0",
    author: "QawmiERP Core",
    enabled: true,
    order: 8,
    size: "half",
  },
];

/**
 * Merges saved tenant widget configs with DEFAULT_BUILTIN_WIDGETS so
 * newly introduced built-in widgets appear automatically and custom widgets
 * keep their order, size, and bundleHtml.
 */
export function normalizeWidgetConfigs(
  saved: WidgetConfigItem[] | null | undefined
): WidgetConfigItem[] {
  const savedList = Array.isArray(saved) ? saved : [];
  const savedMap = new Map<string, WidgetConfigItem>();
  for (const item of savedList) {
    if (item && typeof item.id === "string") {
      savedMap.set(item.id, item);
    }
  }

  const merged: WidgetConfigItem[] = [];

  for (const builtin of DEFAULT_BUILTIN_WIDGETS) {
    const existing = savedMap.get(builtin.id);
    if (existing) {
      merged.push({
        ...builtin,
        enabled: typeof existing.enabled === "boolean" ? existing.enabled : builtin.enabled,
        order: typeof existing.order === "number" ? existing.order : builtin.order,
        size: existing.size === "half" || existing.size === "full" ? existing.size : builtin.size,
      });
    } else {
      merged.push({ ...builtin });
    }
  }

  for (const item of savedList) {
    if (item.type === "custom" && item.bundleHtml) {
      merged.push({
        ...item,
        enabled: typeof item.enabled === "boolean" ? item.enabled : true,
        order: typeof item.order === "number" ? item.order : merged.length + 1,
        size: item.size === "half" || item.size === "full" ? item.size : "half",
      });
    }
  }

  return merged
    .sort((a, b) => a.order - b.order)
    .map((w, idx) => ({ ...w, order: idx + 1 }));
}

/**
 * Filters ERP summary data strictly according to a custom widget's declared permissions.
 */
export function filterBridgeDataByPermissions(
  fullData: ErpWidgetBridgeData,
  permissions: WidgetPermission[] = []
): ErpWidgetBridgeData {
  const allowed = new Set(permissions);
  const filtered: ErpWidgetBridgeData = {};

  if (allowed.has("madrasa.read")) {
    filtered.madrasaName = fullData.madrasaName ?? null;
  }
  if (allowed.has("students.read")) {
    filtered.studentsCount = fullData.studentsCount ?? 0;
    filtered.teachersCount = fullData.teachersCount ?? 0;
    filtered.classesCount = fullData.classesCount ?? 0;
  }
  if (allowed.has("attendance.read")) {
    filtered.todayPresent = fullData.todayPresent ?? 0;
    filtered.todayAbsent = fullData.todayAbsent ?? 0;
  }
  if (allowed.has("finance.read")) {
    filtered.todayIncome = fullData.todayIncome ?? 0;
    filtered.todayExpense = fullData.todayExpense ?? 0;
    filtered.totalIncome = fullData.totalIncome ?? 0;
    filtered.totalExpense = fullData.totalExpense ?? 0;
  }

  return filtered;
}
