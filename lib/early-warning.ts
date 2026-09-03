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
}
