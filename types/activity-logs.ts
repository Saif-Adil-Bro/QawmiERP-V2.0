export type ActivityActionType =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "ARCHIVE"
  | "RESTORE"
  | "APPROVE"
  | "REJECT"
  | "PAYMENT"
  | "ATTENDANCE"
  | "EXAM"
  | "BACKUP"
  | "NOTICE"
  | "SETTINGS";

export type ActivityModule =
  | "STUDENTS"
  | "ADMISSIONS"
  | "ACADEMIC"
  | "HIFZ"
  | "ATTENDANCE"
  | "EXAMS"
  | "FINANCE"
  | "BACKUP"
  | "COMMUNICATION"
  | "SETTINGS";

export interface GlobalActivityLogItem {
  id: string;
  action_type: ActivityActionType;
  module: ActivityModule;
  module_name_bn: string;
  title: string;
  description: string;
  actor_name: string;
  actor_role: string;
  actor_email?: string;
  timestamp: string; // ISO format
  severity: "SUCCESS" | "INFO" | "WARNING" | "CRITICAL";
  ip_address?: string;
  device?: string;
  entity_id?: string;
  entity_type?: string;
  link?: string;
  metadata?: Record<string, any>;
}

export interface ActivityLogFilters {
  module?: string;
  action_type?: string;
  severity?: string;
  search?: string;
  timeRange?: "all" | "today" | "week" | "month";
  limit?: number;
}

export interface ActivityStats {
  totalLogs: number;
  todayCount: number;
  weekCount: number;
  successCount: number;
  moduleCounts: Record<string, number>;
}

export const MODULE_BANGLA_NAMES: Record<ActivityModule, string> = {
  STUDENTS: "ছাত্র ব্যবস্থাপনা",
  ADMISSIONS: "ভর্তি ব্যবস্থাপনা",
  ACADEMIC: "জামাত ও রুটিন",
  HIFZ: "হিফজুল কুরআন",
  ATTENDANCE: "হাজিরা ও ছুটি",
  EXAMS: "পরীক্ষা ও মূল্যায়ন",
  FINANCE: "হিসাব ও ফি",
  BACKUP: "ব্যাকআপ ও রিস্টোর",
  COMMUNICATION: "অভিভাবক যোগাযোগ",
  SETTINGS: "সিস্টেম ও সেটিংস",
};
