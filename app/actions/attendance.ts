"use server";

import { createClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";
import { getStaffMetadataFull } from "./staff";
import { getMadrasaMetadata } from "@/lib/sessions";

export async function getStudentsForAttendance(date: string, classId?: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return [];

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);

  let query = supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, class_id, classes(name)")
    .order("roll_number");

  if (finalMadrasaId) {
    query = query.eq("madrasa_id", finalMadrasaId);
  }

  if (classId && classId !== "All") {
    query = query.eq("class_id", classId);
  }

  // Fetch students
  const { data: students, error: studentsError } = await query;

  if (studentsError) {
    console.error("Attendance students error:", studentsError);
    return [];
  }

  // Fetch existing attendance for the given date
  let attQuery = supabase
    .from("attendance")
    .select("student_id, status")
    .eq("date", date);

  if (finalMadrasaId) {
    attQuery = attQuery.eq("madrasa_id", finalMadrasaId);
  }

  const { data: attendance, error: attendanceError } = await attQuery;

  if (attendanceError) return [];

  // Map attendance status to students
  const attendanceMap = new Map((attendance || []).map(a => [a.student_id, a.status]));

  // Check if date is an academic holiday or weekly weekend
  let isHolidayDate = false;
  if (finalMadrasaId) {
    try {
      const meta = await getMadrasaMetadata(finalMadrasaId);
      const holidays = meta.academic_holidays || [];
      const matchedHoliday = holidays.find(
        (h: any) => !h.is_archived && date >= h.start_date && date <= h.end_date
      );

      const [y, m, d] = date.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const currentDayName = dayNames[dateObj.getDay()];
      const weekendDays = meta.weekend_days || ["Friday"];
      const isWeekend = weekendDays.includes(currentDayName);

      isHolidayDate = Boolean(matchedHoliday) || isWeekend;
    } catch (e) {
      console.warn("Holiday check error in getStudentsForAttendance:", e);
    }
  }

  // If holiday/weekend, auto-persist any unsaved student as "Leave" in database
  if (isHolidayDate && finalMadrasaId && students && students.length > 0) {
    const unsavedStudents = students.filter(s => !attendanceMap.has(s.id));
    if (unsavedStudents.length > 0) {
      try {
        const autoLeaveRecords = unsavedStudents.map(s => ({
          madrasa_id: finalMadrasaId,
          student_id: s.id,
          date: date,
          status: "Leave",
        }));
        const { error: upsertErr } = await supabase
          .from("attendance")
          .upsert(autoLeaveRecords, { onConflict: "student_id, date" });

        if (!upsertErr) {
          unsavedStudents.forEach(s => attendanceMap.set(s.id, "Leave"));
        }
      } catch (upsertCatch) {
        console.warn("Auto-save holiday leave attendance error:", upsertCatch);
      }
    }
  }

  const defaultStatus = isHolidayDate ? "Leave" : "Present";

  return (students || []).map(student => ({
    ...student,
    status: attendanceMap.get(student.id) || defaultStatus,
  }));
}

export async function saveAttendance(date: string, attendanceData: { student_id: string, status: string }[]) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  const recordsToUpsert = attendanceData.map(record => ({
    madrasa_id: finalMadrasaId,
    student_id: record.student_id,
    date: date,
    status: record.status,
  }));

  const { error } = await supabase
    .from("attendance")
    .upsert(recordsToUpsert, { onConflict: 'student_id, date' });

  if (error) {
    console.error("Error saving attendance:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/attendance");
  return { success: true };
}

export async function getTeachersForAttendance(date: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return [];

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);

  // Fetch staff metadata to trigger bi-directional sync
  const staffData = await getStaffMetadataFull();
  const staffMembers = staffData?.staff_members || [];

  let query = supabase
    .from("teachers")
    .select("id, first_name, last_name, designation")
    .order("first_name");

  if (finalMadrasaId) {
    query = query.eq("madrasa_id", finalMadrasaId);
  }

  const { data: teachersData, error: teachersError } = await query;
  let teachersList = teachersData || [];

  // Merge any staff members from metadata missing from teachers table
  const existingTeacherIds = new Set(teachersList.map((t) => t.id));
  staffMembers.forEach((s) => {
    if (!existingTeacherIds.has(s.id)) {
      teachersList.push({
        id: s.id,
        first_name: s.personal.first_name || s.personal.full_name_bn || "শিক্ষক",
        last_name: s.personal.last_name || "",
        designation: s.employment.designation || "সহকারী শিক্ষক",
      });
    }
  });

  // Fetch existing attendance for the given date
  let attQuery = supabase
    .from("teacher_attendance")
    .select("teacher_id, status")
    .eq("date", date);

  if (finalMadrasaId) {
    attQuery = attQuery.eq("madrasa_id", finalMadrasaId);
  }

  const { data: attendance, error: attendanceError } = await attQuery;

  if (attendanceError) return [];

  // Map attendance status to teachers
  const attendanceMap = new Map((attendance || []).map(a => [a.teacher_id, a.status]));

  // Check if date is an academic holiday or weekly weekend
  let isHolidayDate = false;
  if (finalMadrasaId) {
    try {
      const meta = await getMadrasaMetadata(finalMadrasaId);
      const holidays = meta.academic_holidays || [];
      const matchedHoliday = holidays.find(
        (h: any) => !h.is_archived && date >= h.start_date && date <= h.end_date
      );

      const [y, m, d] = date.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const currentDayName = dayNames[dateObj.getDay()];
      const weekendDays = meta.weekend_days || ["Friday"];
      const isWeekend = weekendDays.includes(currentDayName);

      isHolidayDate = Boolean(matchedHoliday) || isWeekend;
    } catch (e) {
      console.warn("Holiday check error in getTeachersForAttendance:", e);
    }
  }

  // If holiday/weekend, auto-persist any unsaved teacher as "Leave" in database
  if (isHolidayDate && finalMadrasaId && teachersList && teachersList.length > 0) {
    const unsavedTeachers = teachersList.filter(t => !attendanceMap.has(t.id));
    if (unsavedTeachers.length > 0) {
      try {
        const autoLeaveRecords = unsavedTeachers.map(t => ({
          madrasa_id: finalMadrasaId,
          teacher_id: t.id,
          date: date,
          status: "Leave",
        }));
        const { error: upsertErr } = await supabase
          .from("teacher_attendance")
          .upsert(autoLeaveRecords, { onConflict: "teacher_id, date" });

        if (!upsertErr) {
          unsavedTeachers.forEach(t => attendanceMap.set(t.id, "Leave"));
        }
      } catch (upsertCatch) {
        console.warn("Auto-save holiday leave teacher attendance error:", upsertCatch);
      }
    }
  }

  const defaultStatus = isHolidayDate ? "Leave" : "Present";

  return teachersList.map(teacher => ({
    ...teacher,
    status: attendanceMap.get(teacher.id) || defaultStatus,
  }));
}

export async function saveTeacherAttendance(date: string, attendanceData: { teacher_id: string, status: string }[]) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  const recordsToUpsert = attendanceData.map(record => ({
    madrasa_id: finalMadrasaId,
    teacher_id: record.teacher_id,
    date: date,
    status: record.status,
  }));

  const { error } = await supabase
    .from("teacher_attendance")
    .upsert(recordsToUpsert, { onConflict: 'teacher_id, date' });

  if (error) {
    console.error("Error saving teacher attendance:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/attendance/teachers");
  return { success: true };
}

export async function getAttendanceReport(month: string, year: string, type: 'student' | 'teacher') {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return [];

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return [];

  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

  const table = type === 'student' ? 'attendance' : 'teacher_attendance';
  const personTable = type === 'student' ? 'students' : 'teachers';
  const personIdColumn = type === 'student' ? 'student_id' : 'teacher_id';

  // Fetch all persons
  const { data: persons, error: personsError } = await supabase
    .from(personTable)
    .select(type === 'student' ? "id, first_name, last_name, roll_number, class_id, classes(name)" : "id, first_name, last_name, designation")
    .eq('madrasa_id', finalMadrasaId);

  if (personsError) return [];

  // Fetch attendance records for the month
  const { data: records, error: recordsError } = await supabase
    .from(table)
    .select(`date, status, ${personIdColumn}`)
    .eq('madrasa_id', finalMadrasaId)
    .gte('date', startDate)
    .lte('date', endDate);

  if (recordsError) return [];

  // Calculate statistics
  const statsMap = new Map();

  records?.forEach((record: any) => {
    const pId = record[personIdColumn];
    if (!statsMap.has(pId)) {
      statsMap.set(pId, { present: 0, absent: 0, late: 0, leave: 0, total: 0 });
    }
    const stats = statsMap.get(pId);
    stats.total++;
    if (record.status === 'Present') stats.present++;
    if (record.status === 'Absent') stats.absent++;
    if (record.status === 'Late') stats.late++;
    if (record.status === 'Leave') stats.leave++;
  });

  return persons?.map((person: any) => ({
    ...person,
    stats: statsMap.get(person.id) || { present: 0, absent: 0, late: 0, leave: 0, total: 0 }
  })) || [];
}

