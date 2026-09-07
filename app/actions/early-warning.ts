"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { EarlyWarningSummary, AttendanceDropAlert, ExamScoreDropAlert } from "@/lib/early-warning";

export async function getEarlyWarningAlerts(): Promise<EarlyWarningSummary> {
  const result: EarlyWarningSummary = {
    attendance_alerts: [],
    exam_drop_alerts: [],
    total_critical_students: 0,
    checked_at: new Date().toISOString(),
  };

  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);

    if (!madrasaId) return result;

    // 1. Fetch Students
    const { data: students, error: studentsError } = await adminClient
      .from("students")
      .select("id, first_name, last_name, roll_number, class_id, parent_phone, classes(id, name)")
      .eq("madrasa_id", madrasaId);

    if (studentsError || !students || students.length === 0) {
      return result;
    }

    const resolveClassName = (cls: any) => {
      if (!cls) return "সাধারণ জামাত";
      if (Array.isArray(cls)) return cls[0]?.name || "সাধারণ জামাত";
      return cls?.name || "সাধারণ জামাত";
    };

    const studentMap = new Map(
      students.map((s) => [
        s.id,
        {
          id: s.id,
          name: `${s.first_name || ""} ${s.last_name || ""}`.trim(),
          roll_number: s.roll_number || "",
          class_id: s.class_id,
          class_name: resolveClassName(s.classes),
          parent_phone: s.parent_phone || "",
        },
      ])
    );

    // 2. Attendance Drop Calculation (Check consecutive 3 or more absent days)
    // Fetch last 15 distinct attendance dates for this madrasa
    const { data: recentAttendance } = await adminClient
      .from("attendance")
      .select("date, student_id, status")
      .eq("madrasa_id", madrasaId)
      .order("date", { ascending: false });

    if (recentAttendance && recentAttendance.length > 0) {
      // Group attendance by student
      const studentAttendance = new Map<string, { date: string; status: string }[]>();

      // Distinct dates sorted descending
      const uniqueDates = Array.from(new Set(recentAttendance.map((a) => a.date))).sort().reverse();

      for (const rec of recentAttendance) {
        if (!studentAttendance.has(rec.student_id)) {
          studentAttendance.set(rec.student_id, []);
        }
        studentAttendance.get(rec.student_id)!.push({ date: rec.date, status: rec.status });
      }

      // Check each student for consecutive absences on their most recent logged dates
      studentAttendance.forEach((logs: { date: string; status: string }[], studentId: string) => {
        const studentInfo = studentMap.get(studentId);
        if (!studentInfo) return;

        // Sort student logs descending by date
        logs.sort((a: { date: string }, b: { date: string }) => new Date(b.date).getTime() - new Date(a.date).getTime());

        let consecutiveAbsent = 0;
        const absentDates: string[] = [];
        let lastPresentDate: string | undefined;

        for (const entry of logs) {
          const statusLower = (entry.status || "").toLowerCase().trim();
          if (statusLower.includes("absent") || statusLower.includes("অনুপস্থিত")) {
            consecutiveAbsent++;
            absentDates.push(entry.date);
          } else {
            lastPresentDate = entry.date;
            break; // Stop counting consecutive sequence
          }
        }

        // Rule: Consecutive 3 or more days drop
        if (consecutiveAbsent >= 3) {
          result.attendance_alerts.push({
            student_id: studentId,
            student_name: studentInfo.name,
            roll_number: studentInfo.roll_number,
            class_id: studentInfo.class_id,
            class_name: studentInfo.class_name,
            parent_phone: studentInfo.parent_phone,
            consecutive_absent_days: consecutiveAbsent,
            last_absent_dates: absentDates.slice(0, 5),
            last_present_date: lastPresentDate,
            alert_level: consecutiveAbsent >= 5 ? "CRITICAL" : "HIGH",
            remarks: `পরপর ${consecutiveAbsent} দিন মাদরাসায় অনুপস্থিত। অভিভাবকের সাথে অবিলম্বে যোগাযোগ প্রয়োজন।`,
          });
        }
      });
    }

    // 3. Exam Score Drop Calculation: Drop of 15% - 20% or more compared to previous exam
    // Fetch all exam results for this madrasa
    const { data: allExamResults } = await adminClient
      .from("exam_results")
      .select("exam_id, student_id, marks_obtained, total_marks, subject_name")
      .eq("madrasa_id", madrasaId);

    if (allExamResults && allExamResults.length > 0) {
      // Find distinct exams that actually have recorded results
      const examIdsWithResults = Array.from(new Set(allExamResults.map((r) => r.exam_id)));

      const { data: exams } = await adminClient
        .from("exams")
        .select("id, title, start_date, created_at")
        .in("id", examIdsWithResults)
        .order("created_at", { ascending: false });

      if (exams && exams.length >= 2) {
        const currentExam = exams[0];
        const previousExam = exams[1];

        const currentResults = allExamResults.filter((r) => r.exam_id === currentExam.id);
        const previousResults = allExamResults.filter((r) => r.exam_id === previousExam.id);

        if (currentResults.length > 0 && previousResults.length > 0) {
          // Calculate percentages per student in previous exam
          const prevStats = new Map<string, { totalObtained: number; totalMax: number }>();
          for (const r of previousResults) {
            if (!prevStats.has(r.student_id)) {
              prevStats.set(r.student_id, { totalObtained: 0, totalMax: 0 });
            }
            const s = prevStats.get(r.student_id)!;
            s.totalObtained += Number(r.marks_obtained || 0);
            s.totalMax += Number(r.total_marks || 100);
          }

          // Calculate percentages per student in current exam
          const currStats = new Map<string, { totalObtained: number; totalMax: number }>();
          for (const r of currentResults) {
            if (!currStats.has(r.student_id)) {
              currStats.set(r.student_id, { totalObtained: 0, totalMax: 0 });
            }
            const s = currStats.get(r.student_id)!;
            s.totalObtained += Number(r.marks_obtained || 0);
            s.totalMax += Number(r.total_marks || 100);
          }

          // Compare each student
          prevStats.forEach((prev: { totalObtained: number; totalMax: number }, studentId: string) => {
            const curr = currStats.get(studentId);
            if (!curr || prev.totalMax === 0 || curr.totalMax === 0) return;

            const prevPct = (prev.totalObtained / prev.totalMax) * 100;
            const currPct = (curr.totalObtained / curr.totalMax) * 100;
            const drop = prevPct - currPct;

            // Rule: Drop is 15% or more
            if (drop >= 15) {
              const studentInfo = studentMap.get(studentId);
              if (!studentInfo) return;

              result.exam_drop_alerts.push({
                student_id: studentId,
                student_name: studentInfo.name,
                roll_number: studentInfo.roll_number,
                class_id: studentInfo.class_id,
                class_name: studentInfo.class_name,
                parent_phone: studentInfo.parent_phone,
                previous_exam_id: previousExam.id,
                previous_exam_title: previousExam.title,
                previous_percentage: Number(prevPct.toFixed(1)),
                current_exam_id: currentExam.id,
                current_exam_title: currentExam.title,
                current_percentage: Number(currPct.toFixed(1)),
                drop_percentage: Number(drop.toFixed(1)),
                alert_level: drop >= 25 ? "CRITICAL" : "HIGH",
              });
            }
          });
        }
      }
    }

    // Distinct critical student count
    const criticalStudentIds = new Set([
      ...result.attendance_alerts.map((a) => a.student_id),
      ...result.exam_drop_alerts.map((e) => e.student_id),
    ]);
    result.total_critical_students = criticalStudentIds.size;

    return result;
  } catch (err) {
    console.error("Error generating early warning alerts:", err);
    return result;
  }
}
