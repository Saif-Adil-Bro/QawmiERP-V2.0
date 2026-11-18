export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type InterventionStatus =
  | "PENDING"
  | "CONTACTED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "DISMISSED";

export interface StudentRiskInput {
  studentId?: string;
  studentName?: string;
  department?: "HIFZ" | "KITAB" | "NOORANI" | "GENERAL" | string;
  daysSinceAdmission?: number | null;

  // Attendance signals (40% weight, max 40)
  consecutiveAbsences?: number | null;
  attendanceRate?: number | null;
  attendanceRate30d?: number | null;
  recentAttendanceRate?: number | null;
  prevAttendanceRate30d?: number | null;
  absentDays30d?: number | null;
  attendanceRecordsCount?: number | null;

  // Academic / Exam / Hifz / Kitab / Noorani signals (30% weight, max 30)
  previousExamPercentage?: number | null;
  previousExamAvg?: number | null;
  currentExamPercentage?: number | null;
  recentExamAvg?: number | null;
  examRecordsCount?: number | null;

  // Hifz specific
  hifzSabakPaused?: boolean | null;
  hifzSabakPausedDays?: number | null;
  hifzPoorRatingCount?: number | null;
  hifzMistakeCount?: number | null;

  // Kitab specific
  kitabPoorRatingCount?: number | null;

  // Noorani specific
  nooraniCurrentTakhti?: number | null;
  nooraniStalledDays?: number | null;
  nooraniTakhtiStalledDays?: number | null;
  nooraniMakhrajWeaknessCount?: number | null;

  // Fee default signals (30% weight, max 30)
  overdueInvoiceCount?: number | null;
  overdueMonthsCount?: number | null;
  overdueDays?: number | null;
  overdueAmount?: number | null;
  totalDueAmount?: number | null;
  totalPayableAmount?: number | null;
  isWaived?: boolean | null;
  feeStatus?: string | null;
}

export interface ComputedStudentRisk {
  compositeScore: number; // 0..100
  riskScore?: number; // alias of compositeScore
  riskLevel: RiskLevel;
  attendanceScore: number; // 0..40
  academicScore: number; // 0..30
  feeScore: number; // 0..30
  factors: string[];
  recommendations: string[];
}

export interface StudentRiskScoreRecord {
  id?: string;
  madrasa_id: string;
  student_id: string;
  class_id?: string | null;
  class_name?: string | null;
  student_name?: string | null;
  roll_number?: string | null;
  parent_phone?: string | null;
  composite_score: number;
  risk_level: RiskLevel;
  attendance_score: number;
  academic_score: number;
  fee_score: number;
  factors: string[];
  recommendations: string[];
  intervention_status: InterventionStatus;
  intervention_notes?: string | null;
  intervened_by?: string | null;
  intervened_at?: string | null;
  last_calculated_at: string;
  created_at?: string;
  updated_at?: string;
}

export interface RiskDistribution {
  LOW: number;
  MEDIUM: number;
  HIGH: number;
  CRITICAL: number;
  total: number;
}

export interface AttendanceDropAlert {
  student_id: string;
  student_name: string;
  roll_number?: string;
  class_id?: string;
  class_name: string;
  parent_phone?: string;
  consecutive_absent_days: number; // e.g. 3 or more
  last_absent_dates: string[]; // e.g. ["2026-09-01", "2026-09-02", "2026-09-03"]
  last_present_date?: string;
  alert_level: "HIGH" | "CRITICAL";
  remarks?: string;
}

export interface ExamScoreDropAlert {
  student_id: string;
  student_name: string;
  roll_number?: string;
  class_id?: string;
  class_name: string;
  parent_phone?: string;
  previous_exam_id: string;
  previous_exam_title: string;
  previous_percentage: number;
  current_exam_id: string;
  current_exam_title: string;
  current_percentage: number;
  drop_percentage: number; // e.g. 18.5%
  alert_level: "HIGH" | "CRITICAL";
}

export interface EarlyWarningSummary {
  attendance_alerts: AttendanceDropAlert[];
  exam_drop_alerts: ExamScoreDropAlert[];
  total_critical_students: number;
  checked_at: string;
  risk_scores?: StudentRiskScoreRecord[];
  risk_distribution?: RiskDistribution;
}
