import {ownerKey,browserSession} from './offline-auth';
import type {PortalSnapshotData} from './portal/offline-snapshot';
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
  | "homework";

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
  leaseUntil?: number;
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
  leaseUntil?: number;
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
  syncQueue!: Table<SyncQueueItem, string>;
  offlineOutbox!: Table<OfflineOutboxItem, string>;
  syncMeta!: Table<SyncMetaRecord, string>;

  portalSnapshots!: Table<{id:string,owner:string,studentId:string|null,syncedAt:number,data:PortalSnapshotData},string>;
  constructor(name = 'QawmiERPOfflineDB') {
    super(name);

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
    this.version(4).stores({portalSnapshots:'id, owner, studentId'});
  }

  getEntityTable(entity: OfflineEntity): Table<OfflineRecord, string> {
    return this[entity] as Table<OfflineRecord, string>;
  }
}

// Never import the legacy, unowned database into a signed-in account. Record IDs (e.g.
// metadata IDs) need not be globally unique. Admin caches and portal outboxes are isolated too.
const databases = new Map<string,QawmiERPOfflineDB>();
export function getOfflineDb(owner = ownerKey(browserSession())):QawmiERPOfflineDB {
  if (typeof window === 'undefined') throw new Error('IndexedDB requires a browser');
  const name = `QawmiERP-scope-${owner || 'guest'}`;
  if (!databases.has(name)) databases.set(name,new QawmiERPOfflineDB(name));
  return databases.get(name)!;
}

export function generateOfflineId(prefix = "offline"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
