export type WidgetPermission =
  | "students.read"
  | "finance.read"
  | "attendance.read"
  | "madrasa.read";

export const ALLOWED_WIDGET_PERMISSIONS: WidgetPermission[] = [
  "students.read",
  "finance.read",
  "attendance.read",
  "madrasa.read",
];

export type WidgetSize = "half" | "full";

export interface WidgetConfigItem {
  id: string;
  type: "builtin" | "custom";
  title: string;
  description?: string;
  version?: string;
  author?: string;
  enabled: boolean;
  order: number;
  size: WidgetSize;
  permissions?: WidgetPermission[];
  bundleHtml?: string;
  installedAt?: string;
}

export interface WidgetManifest {
  id: string;
  name: string;
  version?: string;
  description?: string;
  author?: string;
  entry?: string;
  size?: WidgetSize;
  permissions?: string[];
}

export interface ErpWidgetBridgeData {
  madrasaName?: string | null;
  studentsCount?: number;
  teachersCount?: number;
  classesCount?: number;
  todayPresent?: number;
  todayAbsent?: number;
  todayIncome?: number;
  todayExpense?: number;
  totalIncome?: number;
  totalExpense?: number;
}
