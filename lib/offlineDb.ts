import Dexie, { type Table } from "dexie";

export type OfflineEntity =
  | "students"
  | "teachers"
  | "classes"
  | "subjects"
  | "attendance"
  | "fees"
  | "feePayments"
  | "expenses"
  | "hifzLogs"
  | "kitabLogs"
  | "notices"
  | "exams"
  | "examResults"
  | "examSummaries"
  | "portalProfiles"
  | "routines"
  | "academicCalendar"
  | "homework"
  | "hifzProfiles"
  | "hifzWeeklySabina"
  | "hifzSpecialSabina";

export type SyncAction = "CREATE" | "UPDATE" | "DELETE";
export type SyncStatus = "pending" | "syncing" | "failed";

export interface SyncQueueItem {
  seq?: number;
  id: string;
  entity: OfflineEntity;
  action: SyncAction;
  payload: Record<string, unknown>;
  recordId?: string;
  endpoint?: string;
  timestamp: number;
  status: SyncStatus;
  retryCount: number;
  lastError?: string;
}

export interface OfflineOutboxItem {
  id: string;
  portal: "teacher" | "student" | "guardian";
  actionType: "attendance" | "hifz" | "kitab" | "exam_marks" | "leave_request" | "feedback";
  endpoint: string;
  method: "POST" | "PATCH" | "PUT";
  payload: Record<string, unknown>;
  createdAt: number;
  status: SyncStatus;
  retryCount: number;
  lastError?: string;
}

export interface SyncMetaRecord {
  entity: OfflineEntity | string;
  lastSyncedAt: number;
  lastError?: string;
}

export interface OfflineRecord {
  id: string;
  _offlinePending?: boolean;
  _deleted?: boolean;
  updated_at?: string;
  [key: string]: unknown;
}

export class QawmiERPOfflineDB extends Dexie {
  students!: Table<OfflineRecord, string>;
  teachers!: Table<OfflineRecord, string>;
  classes!: Table<OfflineRecord, string>;
  subjects!: Table<OfflineRecord, string>;
  attendance!: Table<OfflineRecord, string>;
  fees!: Table<OfflineRecord, string>;
  feePayments!: Table<OfflineRecord, string>;
  expenses!: Table<OfflineRecord, string>;
  hifzLogs!: Table<OfflineRecord, string>;
  kitabLogs!: Table<OfflineRecord, string>;
  notices!: Table<OfflineRecord, string>;
  exams!: Table<OfflineRecord, string>;
  examResults!: Table<OfflineRecord, string>;
  examSummaries!: Table<OfflineRecord, string>;
  portalProfiles!: Table<OfflineRecord, string>;
  routines!: Table<OfflineRecord, string>;
  academicCalendar!: Table<OfflineRecord, string>;
  homework!: Table<OfflineRecord, string>;
  hifzProfiles!: Table<OfflineRecord, string>;
  hifzWeeklySabina!: Table<OfflineRecord, string>;
  hifzSpecialSabina!: Table<OfflineRecord, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  offlineOutbox!: Table<OfflineOutboxItem, string>;
  syncMeta!: Table<SyncMetaRecord, string>;

  constructor() {
    super("QawmiERPOfflineDB");

    this.version(1).stores({
      students: "id, madrasa_id, class_id, student_id_code, status, updated_at",
      teachers: "id, madrasa_id, status, updated_at",
      classes: "id, madrasa_id, department, updated_at",
      subjects: "id, madrasa_id, class_id, updated_at",
      attendance: "id, student_id, date, status, class_id, updated_at",
      fees: "id, student_id, status, due_date, updated_at",
      feePayments: "id, student_id, payment_date, updated_at",
      expenses: "id, madrasa_id, category, date, updated_at",
      hifzLogs: "id, student_id, date, status, updated_at",
      kitabLogs: "id, student_id, date, updated_at",
      notices: "id, madrasa_id, created_at, updated_at",
      exams: "id, madrasa_id, session_id, updated_at",
      examResults: "id, exam_id, student_id, subject_id, updated_at",
      syncQueue: "id, entity, action, timestamp, status, retryCount, recordId",
      syncMeta: "entity, lastSyncedAt",
    });

    this.version(2).stores({
      students: "id, madrasa_id, class_id, student_id_code, status, updated_at",
      teachers: "id, madrasa_id, status, updated_at",
      classes: "id, madrasa_id, department, updated_at",
      subjects: "id, madrasa_id, class_id, updated_at",
      attendance: "id, student_id, date, status, class_id, updated_at",
      fees: "id, student_id, status, due_date, updated_at",
      feePayments: "id, student_id, payment_date, updated_at",
      expenses: "id, madrasa_id, category, date, updated_at",
      hifzLogs: "id, student_id, date, status, updated_at",
      kitabLogs: "id, student_id, date, updated_at",
      notices: "id, madrasa_id, created_at, updated_at",
      exams: "id, madrasa_id, session_id, updated_at",
      examResults: "id, exam_id, student_id, subject_id, updated_at",
      portalProfiles: "id, role, madrasa_id, updated_at",
      routines: "id, class_id, teacher_id, day_of_week, updated_at",
      academicCalendar: "id, madrasa_id, start_date, updated_at",
      homework: "id, class_id, subject_id, due_date, updated_at",
      syncQueue: "id, entity, action, timestamp, status, retryCount, recordId",
      offlineOutbox: "id, portal, actionType, createdAt, status, retryCount",
      syncMeta: "entity, lastSyncedAt",
    });

    this.version(3).stores({
      students: "id, madrasa_id, class_id, student_id_code, status, updated_at",
      teachers: "id, madrasa_id, status, updated_at",
      classes: "id, madrasa_id, department, updated_at",
      subjects: "id, madrasa_id, class_id, updated_at",
      attendance: "id, student_id, date, status, class_id, updated_at",
      fees: "id, student_id, status, due_date, updated_at",
      feePayments: "id, student_id, payment_date, updated_at",
      expenses: "id, madrasa_id, category, date, updated_at",
      hifzLogs: "id, student_id, date, status, updated_at",
      kitabLogs: "id, student_id, date, updated_at",
      notices: "id, madrasa_id, created_at, updated_at",
      exams: "id, madrasa_id, session_id, updated_at",
      examResults: "id, exam_id, student_id, subject_id, updated_at",
      examSummaries: "id, exam_id, student_id, updated_at",
      portalProfiles: "id, role, madrasa_id, updated_at",
      routines: "id, class_id, teacher_id, day_of_week, updated_at",
      academicCalendar: "id, madrasa_id, start_date, updated_at",
      homework: "id, class_id, subject_id, due_date, updated_at",
      syncQueue: "id, entity, action, timestamp, status, retryCount, recordId",
      offlineOutbox: "id, portal, actionType, createdAt, status, retryCount",
      syncMeta: "entity, lastSyncedAt",
    });

    this.version(4).stores({
      students: "id, madrasa_id, class_id, student_id_code, status, updated_at",
      teachers: "id, madrasa_id, status, updated_at",
      classes: "id, madrasa_id, department, updated_at",
      subjects: "id, madrasa_id, class_id, updated_at",
      attendance: "id, student_id, date, status, class_id, updated_at",
      fees: "id, student_id, status, due_date, updated_at",
      feePayments: "id, student_id, payment_date, updated_at",
      expenses: "id, madrasa_id, category, date, updated_at",
      hifzLogs: "id, student_id, date, status, updated_at",
      kitabLogs: "id, student_id, date, updated_at",
      notices: "id, madrasa_id, created_at, updated_at",
      exams: "id, madrasa_id, session_id, updated_at",
      examResults: "id, exam_id, student_id, subject_id, updated_at",
      examSummaries: "id, exam_id, student_id, updated_at",
      portalProfiles: "id, role, madrasa_id, updated_at",
      routines: "id, class_id, teacher_id, day_of_week, updated_at",
      academicCalendar: "id, madrasa_id, start_date, updated_at",
      homework: "id, class_id, subject_id, due_date, updated_at",
      hifzProfiles: "id, student_id, madrasa_id, hifz_category, updated_at",
      hifzWeeklySabina: "id, madrasa_id, student_id, sabina_date",
      hifzSpecialSabina: "id, madrasa_id, status, start_date",
      syncQueue: "id, entity, action, timestamp, status, retryCount, recordId",
      offlineOutbox: "id, portal, actionType, createdAt, status, retryCount",
      syncMeta: "entity, lastSyncedAt",
    });
  }

  getEntityTable(entity: OfflineEntity): Table<OfflineRecord, string> {
    return this[entity] as Table<OfflineRecord, string>;
  }
}

let dbInstance: QawmiERPOfflineDB | null = null;

export function getOfflineDb(): QawmiERPOfflineDB {
  if (typeof window === "undefined") {
    throw new Error("OfflineDB can only be accessed in the browser.");
  }
  if (!dbInstance) {
    dbInstance = new QawmiERPOfflineDB();
  }
  return dbInstance;
}

export function generateOfflineId(prefix = "offline"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
