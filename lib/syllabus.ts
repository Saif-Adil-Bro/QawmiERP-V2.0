// lib/syllabus.ts
// QawmiERP Advanced Syllabus, Daily Class & Progress Intelligence Engine
// Deep integration with Daily Class, Revision, Attendance, Holidays & Remaining Working Days

import { AcademicHoliday } from "@/lib/holidays";

export type TopicProgressStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export type ClassType =
  | "NEW_LESSON"
  | "REVISION"
  | "NEW_AND_REVISION"
  | "PRACTICE"
  | "ASSESSMENT"
  | "NO_ACADEMIC_CLASS";

export type CancellationReason =
  | "TEACHER_ABSENT"
  | "INSTITUTIONAL_PROGRAM"
  | "EMERGENCY"
  | "HOLIDAY"
  | "EXAM"
  | "OTHER";

export type StudentEvaluationRating = "GOOD" | "MEDIUM" | "WEAK" | "NOT_ASSESSED";

export interface StudentEvaluation {
  student_id: string;
  student_name: string;
  rating: StudentEvaluationRating;
  notes?: string;
}

export interface TopicRevisionEntry {
  id: string;
  date: string; // YYYY-MM-DD
  teacher_id?: string;
  teacher_name?: string;
  class_type: ClassType;
  notes?: string;
  student_evaluations?: StudentEvaluation[];
}

export interface StudentAbsentFollowup {
  student_id: string;
  student_name: string;
  roll_number?: string;
  missed_date: string;
  is_makeup_done: boolean;
  makeup_date?: string;
}

export interface SyllabusTopic {
  id: string;
  name: string; // e.g. "اسم کی تعریف", "اسم کی اقسام"
  code?: string;
  estimated_periods?: number;
  progress_percentage: number; // 0 to 100
  status: TopicProgressStatus;
  initial_completed_date?: string;
  initial_completed_by_teacher_id?: string;
  initial_completed_by_teacher_name?: string;
  revision_count: number;
  last_revised_date?: string;
  revision_history: TopicRevisionEntry[];
  absent_followup?: StudentAbsentFollowup[];
}

export interface SyllabusChapter {
  id: string;
  name: string; // e.g. "اسم", "فعل", "حرف"
  order: number;
  topics: SyllabusTopic[];
}

export interface Syllabus {
  id: string;
  madrasa_id: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  book_name?: string; // কিতাব / বইয়ের নাম
  total_pages?: number; // বইয়ের মোট পৃষ্ঠা
  start_page?: number; // পাঠ শুরুর পৃষ্ঠা (default 1)
  end_page?: number; // পাঠ সমাপ্তির পৃষ্ঠা
  current_page?: number; // বর্তমান পঠিত পৃষ্ঠা
  planned_daily_pages?: number; // পরিকল্পিত দৈনিক পৃষ্ঠা
  planned_daily_topics?: number; // পরিকল্পিত দৈনিক টপিক
  teacher_id?: string;
  teacher_name?: string;
  session_id?: string;
  academic_year?: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  chapters: SyllabusChapter[];
  revision_interval_days: number; // default: 7
  status: "ACTIVE" | "ARCHIVED" | "COMPLETED";
  created_at: string;
  updated_at: string;
}

export interface DailyClassRecord {
  id: string;
  madrasa_id: string;
  syllabus_id?: string;
  date: string; // YYYY-MM-DD
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  teacher_id?: string;
  teacher_name?: string;
  class_type: ClassType;
  cancellation_reason?: CancellationReason;
  cancellation_notes?: string;
  chapter_id?: string;
  chapter_name?: string;
  new_topic_ids: string[];
  new_topic_names: string[];
  new_topic_progress?: Record<string, number>; // topicId -> new %
  revision_topic_ids: string[];
  revision_topic_names: string[];
  page_from?: string;
  page_to?: string;
  notes?: string;
  student_attendance_summary?: {
    total: number;
    present: number;
    absent: number;
    leave: number;
    absent_students: Array<{ id: string; name: string; roll?: string }>;
  };
  student_evaluations?: StudentEvaluation[];
  created_at: string;
  updated_at: string;
}

export interface WorkingDayCalculationResult {
  total_calendar_days: number;
  total_working_days: number;
  elapsed_working_days: number;
  remaining_working_days: number;
  all_working_dates: string[];
  holidays_count: number;
  fridays_count: number;
  is_today_working_day: boolean;
}

export interface SyllabusIntelligenceMetrics {
  syllabus_id: string;
  subject_name: string;
  book_name?: string;
  class_name: string;
  teacher_name: string;
  // Page-level metrics
  total_pages: number;
  start_page: number;
  end_page: number;
  current_page: number;
  completed_pages: number;
  remaining_pages: number;
  pages_progress_percentage: number;
  required_pages_per_day: number;
  current_pages_per_day: number;
  target_pages_label: string;
  target_weekly_pages_label: string;
  // Topic-level metrics
  total_topics: number;
  completed_topics: number;
  in_progress_topics: number;
  unstarted_topics: number;
  remaining_topics: number;
  actual_progress_percentage: number;
  expected_progress_percentage: number;
  // Working days & calendar metrics
  total_calendar_days: number;
  fridays_count: number;
  holidays_count: number;
  total_working_days: number;
  elapsed_working_days: number;
  remaining_working_days: number;
  weekly_routine_periods: number;
  remaining_scheduled_classes: number;
  current_pace_per_day: number;
  required_pace_per_day: number;
  current_pace_per_class: number;
  required_pace_per_class: number;
  status: "COMPLETED" | "ON_TRACK" | "AT_RISK" | "BEHIND";
  status_label: string;
  status_description: string;
  today_target_label: string;
  weekly_target_label: string;
  catch_up_target_label: string;
  forecast_completion_date: string;
  forecast_variance_days: number; // positive = early, negative = delayed
  forecast_label: string;
  total_revisions_done: number;
  revision_due_count: number;
  revision_due_topics: SyllabusTopic[];
}

/**
 * -------------------------------------------------------------
 * 1. ACADEMIC WORKING DAY CALCULATOR
 * -------------------------------------------------------------
 * Rules:
 * 1. Friday MUST be excluded (Friday is the Islamic weekly holiday).
 * 2. Academic holidays and vacations MUST be excluded.
 * 3. Exam or officially configured non-teaching days excluded.
 */
export class AcademicWorkingDayCalculator {
  /**
   * Helper to format Date to YYYY-MM-DD
   */
  static formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  /**
   * Calculates total, elapsed, and remaining working days in a date range.
   */
  static calculateWorkingDays(
    startDateStr: string,
    endDateStr: string,
    holidays: AcademicHoliday[] = [],
    referenceDateStr?: string
  ): WorkingDayCalculationResult {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const todayStr = referenceDateStr || this.formatDate(new Date());
    const today = new Date(todayStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return {
        total_calendar_days: 0,
        total_working_days: 0,
        elapsed_working_days: 0,
        remaining_working_days: 0,
        all_working_dates: [],
        holidays_count: 0,
        fridays_count: 0,
        is_today_working_day: false,
      };
    }

    // Build holiday lookup set of all holiday dates
    const holidayDateSet = new Set<string>();
    holidays
      .filter((h) => !h.is_archived)
      .forEach((h) => {
        try {
          const hStart = new Date(h.start_date);
          const hEnd = new Date(h.end_date);
          const curr = new Date(hStart);
          let guard = 0;
          while (curr <= hEnd && guard < 100) {
            holidayDateSet.add(this.formatDate(curr));
            curr.setDate(curr.getDate() + 1);
            guard++;
          }
        } catch {
          // ignore malformed date
        }
      });

    const allWorkingDates: string[] = [];
    let fridaysCount = 0;
    let holidaysCount = 0;

    const curr = new Date(start);
    let guard = 0;
    while (curr <= end && guard < 500) {
      const dateStr = this.formatDate(curr);
      const isFriday = curr.getDay() === 5; // 5 = Friday
      const isHoliday = holidayDateSet.has(dateStr);

      if (isFriday) {
        fridaysCount++;
      } else if (isHoliday) {
        holidaysCount++;
      } else {
        allWorkingDates.push(dateStr);
      }

      curr.setDate(curr.getDate() + 1);
      guard++;
    }

    const totalWorkingDays = allWorkingDates.length;
    const elapsedWorkingDays = allWorkingDates.filter((d) => d <= todayStr).length;
    const remainingWorkingDays = allWorkingDates.filter((d) => d > todayStr).length;
    const isTodayWorkingDay = allWorkingDates.includes(todayStr);

    return {
      total_calendar_days: guard,
      total_working_days: totalWorkingDays,
      elapsed_working_days: elapsedWorkingDays,
      remaining_working_days: remainingWorkingDays,
      all_working_dates: allWorkingDates,
      holidays_count: holidaysCount,
      fridays_count: fridaysCount,
      is_today_working_day: isTodayWorkingDay,
    };
  }

  /**
   * Smart Syllabus Plan Generator:
   * Takes book details (pages, start/end date, holidays) and calculates:
   * Net teaching days, Friday holidays, General holidays, and daily/weekly page targets.
   */
  static calculateSmartSyllabusPlan(params: {
    start_date: string;
    end_date: string;
    total_pages?: number;
    start_page?: number;
    end_page?: number;
    total_topics?: number;
    holidays?: AcademicHoliday[];
  }) {
    const workingDays = this.calculateWorkingDays(
      params.start_date,
      params.end_date,
      params.holidays || []
    );

    const startPage = params.start_page || 1;
    const endPage = params.end_page || params.total_pages || 100;
    const totalPages = Math.max(1, endPage - startPage + 1);
    const netTeachingDays = Math.max(1, workingDays.total_working_days);

    const dailyPages = Number((totalPages / netTeachingDays).toFixed(1));
    const weeklyPages = Number((dailyPages * 6).toFixed(1));

    const totalTopics = params.total_topics || 0;
    const dailyTopics = totalTopics > 0 ? Number((totalTopics / netTeachingDays).toFixed(2)) : 0;
    const weeklyTopics = Number((dailyTopics * 6).toFixed(1));

    return {
      workingDays,
      totalPages,
      startPage,
      endPage,
      netTeachingDays,
      dailyPages,
      weeklyPages,
      dailyTopics,
      weeklyTopics,
      dailyPagesLabel: `প্রতিদিন গড়ে ${dailyPages} পৃষ্ঠা`,
      weeklyPagesLabel: `প্রতি সপ্তাহে গড়ে ${weeklyPages} পৃষ্ঠা`,
      summaryBengali: `মোট ${workingDays.total_calendar_days} দিনের মধ্যে ${workingDays.fridays_count}টি শুক্রবার ও ${workingDays.holidays_count}টি ছুটি বাদে নিট পাঠদান কর্মদিবস ${netTeachingDays} দিন। সম্পূর্ণ সিলেবাস শেষ করতে প্রতিদিন গড়ে ${dailyPages} পৃষ্ঠা পড়তে হবে।`,
    };
  }
}

/**
 * -------------------------------------------------------------
 * 2. SYLLABUS PROGRESS & INTELLIGENCE ENGINE
 * -------------------------------------------------------------
 */
export class SyllabusProgressEngine {
  /**
   * Calculates comprehensive intelligence metrics for a single syllabus.
   */
  static calculateMetrics(
    syllabus: Syllabus,
    dailyRecords: DailyClassRecord[] = [],
    holidays: AcademicHoliday[] = [],
    routines: any[] = [],
    referenceDateStr?: string
  ): SyllabusIntelligenceMetrics {
    const todayStr = referenceDateStr || AcademicWorkingDayCalculator.formatDate(new Date());

    // 1. Working days
    const workingDays = AcademicWorkingDayCalculator.calculateWorkingDays(
      syllabus.start_date,
      syllabus.end_date,
      holidays,
      todayStr
    );

    // 2. Count topics & progress
    let totalTopics = 0;
    let completedTopics = 0;
    let inProgressTopics = 0;
    let unstartedTopics = 0;
    let totalProgressSum = 0;
    let totalRevisionsDone = 0;

    const revisionDueTopics: SyllabusTopic[] = [];
    const intervalDays = syllabus.revision_interval_days || 7;

    for (const ch of syllabus.chapters || []) {
      for (const t of ch.topics || []) {
        totalTopics++;
        totalProgressSum += t.progress_percentage || 0;
        totalRevisionsDone += t.revision_count || 0;

        if (t.status === "COMPLETED" || (t.progress_percentage || 0) >= 100) {
          completedTopics++;

          // Check if revision is due
          const lastDateStr = t.last_revised_date || t.initial_completed_date;
          if (lastDateStr) {
            const diffDays = Math.floor(
              (new Date(todayStr).getTime() - new Date(lastDateStr).getTime()) / (1000 * 60 * 60 * 24)
            );
            if (diffDays >= intervalDays) {
              revisionDueTopics.push(t);
            }
          } else {
            revisionDueTopics.push(t);
          }
        } else if ((t.progress_percentage || 0) > 0) {
          inProgressTopics++;
        } else {
          unstartedTopics++;
        }
      }
    }

    // 2.1 Page-level calculation
    const startPage = syllabus.start_page || 1;
    const endPage = syllabus.end_page || syllabus.total_pages || (totalTopics > 0 ? totalTopics * 10 : 100);
    const totalPages = Math.max(1, endPage >= startPage ? endPage - startPage + 1 : (syllabus.total_pages || 100));
    const currentPage = Math.max(startPage, Math.min(endPage, syllabus.current_page || startPage));
    const completedPages = Math.max(0, Math.min(totalPages, currentPage - startPage + (currentPage > startPage ? 1 : 0)));
    const remainingPages = Math.max(0, totalPages - completedPages);
    const pagesProgressPercentage = totalPages > 0 ? Math.min(100, Math.round((completedPages / totalPages) * 100)) : 0;

    const remainingTopics = totalTopics > 0 ? totalTopics - completedTopics : remainingPages;
    let actualProgressPercentage = totalTopics > 0 ? Math.round(totalProgressSum / totalTopics) : pagesProgressPercentage;

    // Expected progress based on elapsed working days
    const expectedProgressPercentage =
      workingDays.total_working_days > 0
        ? Math.min(100, Math.round((workingDays.elapsed_working_days / workingDays.total_working_days) * 100))
        : 0;

    // 3. Routine integration
    const matchingRoutines = routines.filter((r) => {
      const classMatches = r.class_id === syllabus.class_id;
      const subjectMatches =
        r.subject_id === syllabus.subject_id ||
        (r.subjects?.name && r.subjects.name.trim() === syllabus.subject_name.trim());
      return classMatches && (subjectMatches || !r.subject_id);
    });

    const scheduledDaysOfWeek = new Set(
      matchingRoutines.map((r) => String(r.day_of_week).toLowerCase().trim())
    );

    const weeklyRoutinePeriods = matchingRoutines.length > 0 ? matchingRoutines.length : 4; // fallback 4 periods/wk

    const dayMap: Record<number, string> = {
      0: "sunday",
      1: "monday",
      2: "tuesday",
      3: "wednesday",
      4: "thursday",
      5: "friday",
      6: "saturday",
    };

    const remainingWorkingDates = workingDays.all_working_dates.filter((d) => d > todayStr);
    let remainingScheduledClasses = 0;

    if (scheduledDaysOfWeek.size > 0) {
      for (const dStr of remainingWorkingDates) {
        const dObj = new Date(dStr);
        const dayName = dayMap[dObj.getDay()];
        if (dayName && scheduledDaysOfWeek.has(dayName)) {
          remainingScheduledClasses++;
        }
      }
    }

    if (remainingScheduledClasses === 0) {
      remainingScheduledClasses = Math.max(
        1,
        Math.round((workingDays.remaining_working_days * (weeklyRoutinePeriods / 6)))
      );
    }

    // 4. Paces
    const elapsedDays = Math.max(1, workingDays.elapsed_working_days);
    const remDays = Math.max(1, workingDays.remaining_working_days);
    const remClasses = Math.max(1, remainingScheduledClasses);

    const currentPacePerDay = Number((completedTopics / elapsedDays).toFixed(2));
    const requiredPacePerDay = Number((remainingTopics / remDays).toFixed(2));

    const currentPacePerClass = Number((completedTopics / Math.max(1, elapsedDays * (weeklyRoutinePeriods / 6))).toFixed(2));
    const requiredPacePerClass = Number((remainingTopics / remClasses).toFixed(2));

    const requiredPagesPerDay = remDays > 0 ? Number((remainingPages / remDays).toFixed(1)) : 0;
    const currentPagesPerDay = elapsedDays > 0 ? Number((completedPages / elapsedDays).toFixed(1)) : 0;
    const targetPagesLabel = remainingPages === 0 ? "কিতাব সমাপ্ত" : `প্রতিদিন গড়ে ${requiredPagesPerDay} পৃষ্ঠা`;
    const targetWeeklyPagesLabel = remainingPages === 0 ? "কিতাব সমাপ্ত" : `প্রতি সপ্তাহে গড়ে ${Math.round(requiredPagesPerDay * 6)} পৃষ্ঠা`;

    // 5. Status determination
    let status: "COMPLETED" | "ON_TRACK" | "AT_RISK" | "BEHIND" = "ON_TRACK";
    let statusLabel = "নির্ধারিত সময় অনুযায়ী এগিয়ে আছেন";
    let statusDesc = "বর্তমান গতি বজায় রাখলে নির্ধারিত সময়ের পূর্বেই সিলেবাস সফলভাবে সম্পন্ন হবে।";

    if (remainingTopics === 0 && remainingPages === 0) {
      status = "COMPLETED";
      statusLabel = "সিলেবাস সম্পন্ন";
      statusDesc = "মাশাআল্লাহ! নির্ধারিত সিলেবাস সফলভাবে শতভাগ সম্পন্ন হয়েছে।";
    } else if (currentPacePerDay >= requiredPacePerDay || actualProgressPercentage >= expectedProgressPercentage) {
      status = "ON_TRACK";
      statusLabel = "সময়মতো এগিয়ে আছেন (On Track)";
      statusDesc = "আপনি নির্ধারিত সময় অনুযায়ী সঠিক গতিতে এগিয়ে আছেন।";
    } else if (currentPacePerDay >= requiredPacePerDay * 0.75) {
      status = "AT_RISK";
      statusLabel = "সামান্য বেশি গতি প্রয়োজন (At Risk)";
      statusDesc = "সিলেবাস সময়মতো শেষ করতে বর্তমান গতির চেয়ে সামান্য বেশি গতি প্রয়োজন।";
    } else {
      status = "BEHIND";
      statusLabel = "অতিরিক্ত গতি প্রয়োজন (Behind)";
      statusDesc = "নির্ধারিত সময়ের মধ্যে শেষ করতে ক্লাসের গতি বৃদ্ধি বা অতিরিক্ত ক্লাস প্রয়োজন।";
    }

    // 6. Human-friendly targets (Bengali numbers / text)
    const dailyTargetNum = Math.ceil(requiredPacePerDay);
    const todayTargetLabel =
      remainingTopics === 0 && remainingPages === 0
        ? "সিলেবাস সম্পন্ন (রিভিশন করান)"
        : totalPages > 0
        ? `আজকের লক্ষ্য: ≈ ${requiredPagesPerDay} পৃষ্ঠা`
        : dailyTargetNum <= 1
        ? "আজকের লক্ষ্য: ১টি Topic"
        : `আজকের লক্ষ্য: ${dailyTargetNum - 1}–${dailyTargetNum}টি Topic`;

    const weeklyTargetNum = Math.ceil(requiredPacePerDay * (workingDays.total_working_days > 0 ? 5 : 6));
    const weeklyTargetLabel =
      remainingTopics === 0 && remainingPages === 0
        ? "রিভিশন ও মূল্যায়ন"
        : totalPages > 0
        ? `এই সপ্তাহের লক্ষ্য: ≈ ${Math.round(requiredPagesPerDay * 6)} পৃষ্ঠা`
        : `এই সপ্তাহের লক্ষ্য: ≈ ${weeklyTargetNum}টি Topic`;

    // Catch up target over next 10 working days
    const catchUpDailyNum = Math.ceil((remainingTopics / Math.min(remDays, 10)) * 0.8);
    const catchUpTargetLabel =
      status === "BEHIND" || status === "AT_RISK"
        ? `আগামী ১০ কর্মদিবসে প্রতিদিন গড়ে ${Math.max(1, catchUpDailyNum)}টি Topic বা ${Math.max(1, Math.round(requiredPagesPerDay * 1.3))} পৃষ্ঠা সম্পন্ন করলে সময়মতো শেষ করা সম্ভব।`
        : "বর্তমান পাঠদান গতি বজায় রাখুন।";

    // 7. Forecast completion date
    const sustainablePace = currentPacePerDay > 0.1 ? currentPacePerDay : (currentPagesPerDay > 0 ? currentPagesPerDay / 10 : 0.5);
    const itemsToComplete = totalTopics > 0 ? remainingTopics : remainingPages;
    const daysNeeded = Math.ceil(itemsToComplete / sustainablePace);
    let forecastDateStr = syllabus.end_date;
    let forecastVarianceDays = 0;

    if (daysNeeded <= remainingWorkingDates.length) {
      forecastDateStr = remainingWorkingDates[daysNeeded - 1] || syllabus.end_date;
      forecastVarianceDays = remainingWorkingDates.length - daysNeeded;
    } else {
      const extraDaysNeeded = daysNeeded - remainingWorkingDates.length;
      const endObj = new Date(syllabus.end_date);
      endObj.setDate(endObj.getDate() + extraDaysNeeded * 1.4);
      forecastDateStr = AcademicWorkingDayCalculator.formatDate(endObj);
      forecastVarianceDays = -extraDaysNeeded;
    }

    let forecastLabel = "";
    if (remainingTopics === 0 && remainingPages === 0) {
      forecastLabel = "সিলেবাস ইতিমধ্যে সম্পন্ন হয়েছে";
    } else if (forecastVarianceDays >= 0) {
      forecastLabel = `সম্ভাব্য সমাপ্তি: ${forecastDateStr} (নির্ধারিত সময়ের পূর্বে/সময়মতো)`;
    } else {
      forecastLabel = `সম্ভাব্য সমাপ্তি: ${forecastDateStr} (আনুমানিক ${Math.abs(forecastVarianceDays)} কর্মদিবস পিছিয়ে)`;
    }

    return {
      syllabus_id: syllabus.id,
      subject_name: syllabus.subject_name,
      book_name: syllabus.book_name || syllabus.subject_name,
      class_name: syllabus.class_name,
      teacher_name: syllabus.teacher_name || "অনির্ধারিত",
      // Page metrics
      total_pages: totalPages,
      start_page: startPage,
      end_page: endPage,
      current_page: currentPage,
      completed_pages: completedPages,
      remaining_pages: remainingPages,
      pages_progress_percentage: pagesProgressPercentage,
      required_pages_per_day: requiredPagesPerDay,
      current_pages_per_day: currentPagesPerDay,
      target_pages_label: targetPagesLabel,
      target_weekly_pages_label: targetWeeklyPagesLabel,
      // Topic metrics
      total_topics: totalTopics,
      completed_topics: completedTopics,
      in_progress_topics: inProgressTopics,
      unstarted_topics: unstartedTopics,
      remaining_topics: remainingTopics,
      actual_progress_percentage: actualProgressPercentage,
      expected_progress_percentage: expectedProgressPercentage,
      // Calendar & working days
      total_calendar_days: workingDays.total_calendar_days,
      fridays_count: workingDays.fridays_count,
      holidays_count: workingDays.holidays_count,
      total_working_days: workingDays.total_working_days,
      elapsed_working_days: workingDays.elapsed_working_days,
      remaining_working_days: workingDays.remaining_working_days,
      weekly_routine_periods: weeklyRoutinePeriods,
      remaining_scheduled_classes: remainingScheduledClasses,
      current_pace_per_day: currentPacePerDay,
      required_pace_per_day: requiredPacePerDay,
      current_pace_per_class: currentPacePerClass,
      required_pace_per_class: requiredPacePerClass,
      status,
      status_label: statusLabel,
      status_description: statusDesc,
      today_target_label: todayTargetLabel,
      weekly_target_label: weeklyTargetLabel,
      catch_up_target_label: catchUpTargetLabel,
      forecast_completion_date: forecastDateStr,
      forecast_variance_days: forecastVarianceDays,
      forecast_label: forecastLabel,
      total_revisions_done: totalRevisionsDone,
      revision_due_count: revisionDueTopics.length,
      revision_due_topics: revisionDueTopics,
    };
  }
}

/**
 * Generates default rich Qawmi syllabuses for common madrasa subjects
 * if none exist yet.
 */
export function getDefaultSyllabuses(
  madrasaId: string,
  classes: any[],
  subjects: any[],
  teachers: any[],
  sessionId?: string,
  academicYear?: string
): Syllabus[] {
  const now = new Date().toISOString();
  const today = new Date();
  const startStr = "2026-04-15";
  const endStr = "2027-04-05";

  // Template chapters & topics
  const nahwChapters: SyllabusChapter[] = [
    {
      id: `ch_${Date.now()}_nahw_1`,
      name: "اسم (Noun & Categories)",
      order: 1,
      topics: [
        {
          id: `top_${Date.now()}_1`,
          name: "اسم کی تعریف اور علامات",
          estimated_periods: 3,
          progress_percentage: 100,
          status: "COMPLETED",
          initial_completed_date: "2026-06-15",
          revision_count: 3,
          last_revised_date: "2026-09-02",
          revision_history: [
            { id: "rev_1", date: "2026-07-10", class_type: "REVISION", notes: "সহজ বিশ্লেষণ ও তামরীন" },
            { id: "rev_2", date: "2026-08-01", class_type: "REVISION", notes: "আমলে নাহব উদাহরণ" },
            { id: "rev_3", date: "2026-09-02", class_type: "REVISION", notes: "মৌখিক ইমতিহান" },
          ],
        },
        {
          id: `top_${Date.now()}_2`,
          name: "اسم کی اقسام (معرب اور مبنی)",
          estimated_periods: 4,
          progress_percentage: 100,
          status: "COMPLETED",
          initial_completed_date: "2026-06-25",
          revision_count: 2,
          last_revised_date: "2026-08-20",
          revision_history: [
            { id: "rev_4", date: "2026-07-22", class_type: "REVISION", notes: "মাবনির প্রকারভেদ" },
            { id: "rev_5", date: "2026-08-20", class_type: "REVISION", notes: "তাকমিল দরস" },
          ],
        },
        {
          id: `top_${Date.now()}_3`,
          name: "مرفوعات (فاعل، مفعول ما لم يسم فاعله)",
          estimated_periods: 5,
          progress_percentage: 75,
          status: "IN_PROGRESS",
          revision_count: 1,
          last_revised_date: "2026-09-05",
          revision_history: [
            { id: "rev_6", date: "2026-09-05", class_type: "PRACTICE", notes: "তারকীব তামরীন" },
          ],
        },
        {
          id: `top_${Date.now()}_4`,
          name: "مبتدا اور خبر کے احکام",
          estimated_periods: 4,
          progress_percentage: 0,
          status: "NOT_STARTED",
          revision_count: 0,
          revision_history: [],
        },
      ],
    },
    {
      id: `ch_${Date.now()}_nahw_2`,
      name: "منصوبات (Accusatives)",
      order: 2,
      topics: [
        {
          id: `top_${Date.now()}_5`,
          name: "مفعول به اور مفعول مطلق",
          estimated_periods: 4,
          progress_percentage: 0,
          status: "NOT_STARTED",
          revision_count: 0,
          revision_history: [],
        },
        {
          id: `top_${Date.now()}_6`,
          name: "مفعول فيه اور مفعول معه",
          estimated_periods: 3,
          progress_percentage: 0,
          status: "NOT_STARTED",
          revision_count: 0,
          revision_history: [],
        },
        {
          id: `top_${Date.now()}_7`,
          name: "حال اور تمييز کے قواعد",
          estimated_periods: 4,
          progress_percentage: 0,
          status: "NOT_STARTED",
          revision_count: 0,
          revision_history: [],
        },
      ],
    },
    {
      id: `ch_${Date.now()}_nahw_3`,
      name: "مجرورات اور توابع",
      order: 3,
      topics: [
        {
          id: `top_${Date.now()}_8`,
          name: "حروف جاره اور اضافت",
          estimated_periods: 4,
          progress_percentage: 0,
          status: "NOT_STARTED",
          revision_count: 0,
          revision_history: [],
        },
        {
          id: `top_${Date.now()}_9`,
          name: "توابع (صفت، عطف، تاکید، بدل)",
          estimated_periods: 5,
          progress_percentage: 0,
          status: "NOT_STARTED",
          revision_count: 0,
          revision_history: [],
        },
      ],
    },
  ];

  const sarfChapters: SyllabusChapter[] = [
    {
      id: `ch_${Date.now()}_sarf_1`,
      name: "ثلاثي مجرد (Trilateral Verbs)",
      order: 1,
      topics: [
        {
          id: `top_${Date.now()}_10`,
          name: "باب نصر ينصر (صیغوں کی گردان)",
          estimated_periods: 4,
          progress_percentage: 100,
          status: "COMPLETED",
          initial_completed_date: "2026-06-18",
          revision_count: 4,
          last_revised_date: "2026-08-28",
          revision_history: [],
        },
        {
          id: `top_${Date.now()}_11`,
          name: "باب ضرب يضرب اور سمع يسمع",
          estimated_periods: 4,
          progress_percentage: 100,
          status: "COMPLETED",
          initial_completed_date: "2026-07-05",
          revision_count: 2,
          last_revised_date: "2026-08-15",
          revision_history: [],
        },
        {
          id: `top_${Date.now()}_12`,
          name: "باب فتح يفتح اور كرم يكرم",
          estimated_periods: 4,
          progress_percentage: 50,
          status: "IN_PROGRESS",
          revision_count: 1,
          last_revised_date: "2026-09-01",
          revision_history: [],
        },
      ],
    },
    {
      id: `ch_${Date.now()}_sarf_2`,
      name: "ثلاثي مزيد فيه (Derived Verbs)",
      order: 2,
      topics: [
        {
          id: `top_${Date.now()}_13`,
          name: "باب افعال اور تفعيل",
          estimated_periods: 4,
          progress_percentage: 0,
          status: "NOT_STARTED",
          revision_count: 0,
          revision_history: [],
        },
        {
          id: `top_${Date.now()}_14`,
          name: "باب مفاعلة اور تفعل",
          estimated_periods: 4,
          progress_percentage: 0,
          status: "NOT_STARTED",
          revision_count: 0,
          revision_history: [],
        },
        {
          id: `top_${Date.now()}_15`,
          name: "باب استفعال کے خواص",
          estimated_periods: 3,
          progress_percentage: 0,
          status: "NOT_STARTED",
          revision_count: 0,
          revision_history: [],
        },
      ],
    },
  ];

  const quranChapters: SyllabusChapter[] = [
    {
      id: `ch_${Date.now()}_quran_1`,
      name: "হরফ ও মাখরাজ পরিচিতি",
      order: 1,
      topics: [
        {
          id: `top_${Date.now()}_16`,
          name: "২৯টি হরফের মাখরাজ ও বিশুদ্ধ উচ্চারণ",
          estimated_periods: 5,
          progress_percentage: 100,
          status: "COMPLETED",
          initial_completed_date: "2026-05-20",
          revision_count: 5,
          last_revised_date: "2026-09-07",
          revision_history: [],
        },
        {
          id: `top_${Date.now()}_17`,
          name: "হারাকাত ও তানবীন পড়ার নিয়ম",
          estimated_periods: 4,
          progress_percentage: 100,
          status: "COMPLETED",
          initial_completed_date: "2026-06-10",
          revision_count: 3,
          last_revised_date: "2026-08-30",
          revision_history: [],
        },
        {
          id: `top_${Date.now()}_18`,
          name: "মাদের হরফ ও গুন্নাহর বিবরণ",
          estimated_periods: 4,
          progress_percentage: 100,
          status: "COMPLETED",
          initial_completed_date: "2026-07-02",
          revision_count: 2,
          last_revised_date: "2026-08-25",
          revision_history: [],
        },
      ],
    },
    {
      id: `ch_${Date.now()}_quran_2`,
      name: "নাজেরা ক্বেরাত ও তাজবীদ প্রয়োগ",
      order: 2,
      topics: [
        {
          id: `top_${Date.now()}_19`,
          name: "আমপারা ৩০তম পারার প্রথম ১০টি সূরা",
          estimated_periods: 6,
          progress_percentage: 80,
          status: "IN_PROGRESS",
          revision_count: 2,
          last_revised_date: "2026-09-06",
          revision_history: [],
        },
        {
          id: `top_${Date.now()}_20`,
          name: "নুন সাকিন ও তানবীনের ৪টি হুকুম (ইযহার, ইদগাম, ইক্বলাব, ইখফা)",
          estimated_periods: 5,
          progress_percentage: 0,
          status: "NOT_STARTED",
          revision_count: 0,
          revision_history: [],
        },
        {
          id: `top_${Date.now()}_21`,
          name: "ওয়াকফ ও ইবতিদার মৌলিক নিয়মাবলী",
          estimated_periods: 4,
          progress_percentage: 0,
          status: "NOT_STARTED",
          revision_count: 0,
          revision_history: [],
        },
      ],
    },
  ];

  const firstClass = classes[0] || { id: "class_default_1", name: "নাহবেমীর" };
  const secondClass = classes[1] || { id: "class_default_2", name: "মীযান" };
  const thirdClass = classes[2] || { id: "class_default_3", name: "নাজেরা" };

  const defaultTeacher = teachers[0] || { id: "teacher_default", first_name: "আবু আয়মান", last_name: "আব্দুল্লাহ" };
  const teacherName = `${defaultTeacher.first_name || ""} ${defaultTeacher.last_name || ""}`.trim() || "মাওলানা আবু আয়মান আব্দুল্লাহ";

  const firstSub = subjects.find((s) => s.name?.includes("নাহব") || s.name?.includes("ক্বায়েদা")) || { id: "sub_1", name: "ইলমুন নাহব (হেদায়াতুন্নাহব)" };
  const secondSub = subjects.find((s) => s.name?.includes("সরফ") || s.name?.includes("আমপারা")) || { id: "sub_2", name: "ইলমুস সারফ (মীযানুন্নাহব)" };
  const thirdSub = subjects.find((s) => s.name?.includes("কুরআন") || s.name?.includes("নাজেরা")) || { id: "sub_3", name: "তাজবীদুল কুরআন (নাজেরা)" };

  return [
    {
      id: `syl_${Date.now()}_1`,
      madrasa_id: madrasaId,
      class_id: firstClass.id,
      class_name: firstClass.name,
      subject_id: firstSub.id,
      subject_name: firstSub.name,
      teacher_id: defaultTeacher.id,
      teacher_name: teacherName,
      session_id: sessionId || "session_1447_48",
      academic_year: academicYear || "১৪৪৭-৪৮ হিজরি (২০২৬-২৭)",
      start_date: startStr,
      end_date: endStr,
      chapters: nahwChapters,
      revision_interval_days: 7,
      status: "ACTIVE",
      created_at: now,
      updated_at: now,
    },
    {
      id: `syl_${Date.now()}_2`,
      madrasa_id: madrasaId,
      class_id: secondClass.id,
      class_name: secondClass.name,
      subject_id: secondSub.id,
      subject_name: secondSub.name,
      teacher_id: defaultTeacher.id,
      teacher_name: teacherName,
      session_id: sessionId || "session_1447_48",
      academic_year: academicYear || "১৪৪৭-৪৮ হিজরি (২০২৬-২৭)",
      start_date: startStr,
      end_date: endStr,
      chapters: sarfChapters,
      revision_interval_days: 7,
      status: "ACTIVE",
      created_at: now,
      updated_at: now,
    },
    {
      id: `syl_${Date.now()}_3`,
      madrasa_id: madrasaId,
      class_id: thirdClass.id,
      class_name: thirdClass.name,
      subject_id: thirdSub.id,
      subject_name: thirdSub.name,
      teacher_id: defaultTeacher.id,
      teacher_name: teacherName,
      session_id: sessionId || "session_1447_48",
      academic_year: academicYear || "১৪৪৭-৪৮ হিজরি (২০২৬-২৭)",
      start_date: startStr,
      end_date: endStr,
      chapters: quranChapters,
      revision_interval_days: 7,
      status: "ACTIVE",
      created_at: now,
      updated_at: now,
    },
  ];
}
