"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";

export async function getStudentsForAttendance(date: string, classId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, class_id, classes(name)")
    .order("roll_number");

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
  const { data: attendance, error: attendanceError } = await supabase
    .from("attendance")
    .select("student_id, status")
    .eq("date", date);

  if (attendanceError) return [];

  // Map attendance status to students
  const attendanceMap = new Map(attendance.map(a => [a.student_id, a.status]));

  return students.map(student => ({
    ...student,
    status: attendanceMap.get(student.id) || "Present", // Default to Present
  }));
}

export async function saveAttendance(date: string, attendanceData: { student_id: string, status: string }[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: teachers, error: teachersError } = await supabase
    .from("teachers")
    .select("id, first_name, last_name, designation")
    .order("first_name");

  if (teachersError) {
    console.error("Attendance teachers error:", teachersError);
    return [];
  }

  // Fetch existing attendance for the given date
  const { data: attendance, error: attendanceError } = await supabase
    .from("teacher_attendance")
    .select("teacher_id, status")
    .eq("date", date);

  if (attendanceError) return [];

  // Map attendance status to teachers
  const attendanceMap = new Map(attendance.map(a => [a.teacher_id, a.status]));

  return teachers.map(teacher => ({
    ...teacher,
    status: attendanceMap.get(teacher.id) || "Present", // Default to Present
  }));
}

export async function saveTeacherAttendance(date: string, attendanceData: { teacher_id: string, status: string }[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
  const { data: { user } } = await supabase.auth.getUser();
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

