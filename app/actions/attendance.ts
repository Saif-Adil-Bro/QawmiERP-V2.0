"use server";
import {
  webTeacher,
  webIdentity,
  teacherStudents,
  hasRole,
} from "@/lib/portal/identity";
import { verifyRoster } from "@/lib/portal/teacher-entry";
import {
  studentRoles,
  validDate,
  attendanceStats,
  attendanceStatuses,
  holidayApplies,
} from "@/lib/portal/rules";
import { toDhakaDateString } from "@/lib/date-utils";
import { rows, childLogs } from "@/lib/portal/queries";

import { writeGuard } from "@/lib/action-authorization";
import {
  createClient,
  createAdminClient,
  getAuthUser,
} from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";
import { getMadrasaMetadata } from "@/lib/sessions";

export async function getStudentsForAttendance(date: string, classId?: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("attendance");
    if (!__authz.allowed) return __authz.fallback;
  }

  const i = await webIdentity();
  if (!i || hasRole(i, studentRoles) || !validDate(date)) return [];
  const teacher = await webTeacher(),
    target = classId && classId !== "All" ? classId : null;
  const students = teacher
    ? await teacherStudents(i, teacher.scope, target ? [target] : undefined)
    : await rows(() => {
        const q = i.db
          .from("students")
          .select("id,first_name,last_name,roll_number,class_id,classes(*)")
          .eq("madrasa_id", i.tenant);
        return target ? q.eq("class_id", target) : q;
      });
  const [meta, logs] = await Promise.all([
    getMadrasaMetadata(i.tenant, true),
    childLogs(
      i.db,
      i.tenant,
      "attendance",
      students.map((s) => s.id),
      date,
    ),
  ]);
  const marked = new Map(logs.map((r) => [r.student_id, r.status]));
  const day = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][new Date(date + "T00:00:00Z").getUTCDay()];
  const weekend = (meta.weekend_days || ["Friday"]).includes(day);
  return students
    .map((s) => {
      const holiday = meta.academic_holidays?.some(
        (h) =>
          !h.is_archived &&
          date >= h.start_date &&
          date <= h.end_date &&
          holidayApplies(h, s.classes ? [s.classes] : []),
      );
      return {
        ...s,
        status: marked.get(s.id) || (weekend || holiday ? "Leave" : "Present"),
      };
    })
    .sort(
      (a, b) =>
        Number(a.roll_number || Infinity) - Number(b.roll_number || Infinity),
    );
}

export async function saveAttendance(
  date: string,
  attendanceData: { student_id: string; status: string; notes?: string }[],
) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("attendance");
    if (!__authz.allowed) return __authz.fallback;
  }

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  if (
    !validDate(date) ||
    date > toDhakaDateString() ||
    attendanceData.some(
      (r) => !attendanceStatuses.some((s) => s === r.status),
    ) ||
    !(await verifyRoster(finalMadrasaId, attendanceData))
  )
    return { error: "শিক্ষার্থী বা হাজিরা বৈধ নয়।" };
  const recordsToUpsert = attendanceData.map((record) => ({
    madrasa_id: finalMadrasaId,
    student_id: record.student_id,
    date: date,
    leave_request_id: null,
    status: record.status,
    ...(record.notes !== undefined ? { notes: record.notes } : {}),
  }));

  const adminClient = await createAdminClient();
  const { error } = await adminClient
    .from("attendance")
    .upsert(recordsToUpsert, { onConflict: "student_id, date" });

  if (error) {
    console.error("Error saving attendance:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/attendance/students");
  revalidatePath("/portal", "layout");
  revalidatePath("/teacher-portal", "layout");
  return { success: true };
}

export async function getTeachersForAttendance(date: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("attendance");
    if (!__authz.allowed) return __authz.fallback;
  }

  const i = await webIdentity();
  if (
    !i ||
    hasRole(i, studentRoles) ||
    (await webTeacher()) ||
    !validDate(date)
  )
    return [];
  const finalMadrasaId = i.tenant;
  // The attendance FK accepts teachers.id, not an unlinked staff metadata ID.
  const [teachersList, attendance] = await Promise.all([
    rows(() =>
      i.db
        .from("teachers")
        .select("id,first_name,last_name,designation")
        .eq("madrasa_id", i.tenant)
        .order("first_name"),
    ),
    rows(() =>
      i.db
        .from("teacher_attendance")
        .select("id,teacher_id,status")
        .eq("madrasa_id", i.tenant)
        .eq("date", date),
    ),
  ]);
  const attendanceMap = new Map(
    attendance.map((a) => [a.teacher_id, a.status]),
  );

  // Check if date is an academic holiday or weekly weekend
  let isHolidayDate = false;
  if (finalMadrasaId) {
    try {
      const meta = await getMadrasaMetadata(finalMadrasaId);
      const holidays = meta.academic_holidays || [];
      const matchedHoliday = holidays.find(
        (h: any) =>
          !h.is_archived &&
          holidayApplies(h, []) &&
          date >= h.start_date &&
          date <= h.end_date,
      );

      const [y, m, d] = date.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const currentDayName = dayNames[dateObj.getDay()];
      const weekendDays = meta.weekend_days || ["Friday"];
      const isWeekend = weekendDays.includes(currentDayName);

      isHolidayDate = Boolean(matchedHoliday) || isWeekend;
    } catch (e) {
      console.warn("Holiday check error in getTeachersForAttendance:", e);
    }
  }

  const defaultStatus = isHolidayDate ? "Leave" : "Present";

  return teachersList.map((teacher) => ({
    ...teacher,
    status: attendanceMap.get(teacher.id) || defaultStatus,
  }));
}

export async function saveTeacherAttendance(
  date: string,
  attendanceData: { teacher_id: string; status: string }[],
) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("attendance");
    if (!__authz.allowed) return __authz.fallback;
  }

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  if (
    (await webTeacher()) ||
    date > toDhakaDateString() ||
    !validDate(date) ||
    !attendanceData?.length ||
    attendanceData.some((r) => !attendanceStatuses.some((s) => s === r.status))
  )
    return { error: "কর্মীর হাজিরা বা অনুমতি সঠিক নয়।" };
  const ids = await rows(() =>
    supabase
      .from("teachers")
      .select("id")
      .eq("madrasa_id", finalMadrasaId)
      .in(
        "id",
        attendanceData.map((r) => r.teacher_id),
      ),
  );
  if (attendanceData.some((r) => !ids.some((s) => s.id === r.teacher_id)))
    return { error: "কর্মী এই প্রতিষ্ঠানের নয়।" };
  const recordsToUpsert = attendanceData.map((record) => ({
    madrasa_id: finalMadrasaId,
    teacher_id: record.teacher_id,
    date: date,
    leave_request_id: null,
    status: record.status,
  }));

  const adminClient = await createAdminClient();
  const { error } = await adminClient
    .from("teacher_attendance")
    .upsert(recordsToUpsert, { onConflict: "teacher_id, date" });

  if (error) {
    console.error("Error saving teacher attendance:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/attendance/teachers");
  return { success: true };
}

export async function getAttendanceReport(
  month: string,
  year: string,
  type: "student" | "teacher",
) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return [];

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return [];

  if (
    !/^\d{4}$/.test(year) ||
    !/^(?:0?[1-9]|1[0-2])$/.test(month) ||
    !(await writeGuard("attendance")).allowed
  )
    return [];
  const teacher = await webTeacher();
  if (teacher && type === "teacher") return [];
  const startDate = `${year}-${month.padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(parseInt(year), parseInt(month), 0))
    .toISOString()
    .split("T")[0];

  const table = type === "student" ? "attendance" : "teacher_attendance";
  const personTable = type === "student" ? "students" : "teachers";
  const personIdColumn = type === "student" ? "student_id" : "teacher_id";

  const [persons, records] = await Promise.all([
    rows(() =>
      supabase
        .from(personTable)
        .select(
          type === "student"
            ? "id,first_name,last_name,roll_number,class_id,classes(name)"
            : "id,first_name,last_name,designation",
        )
        .eq("madrasa_id", finalMadrasaId),
    ),
    rows(() =>
      supabase
        .from(table)
        .select(`id,date,status,${personIdColumn}`)
        .eq("madrasa_id", finalMadrasaId)
        .gte("date", startDate)
        .lte("date", endDate),
    ),
  ]);
  const byPerson = new Map<string, any[]>();
  for (const r of records) {
    const id = r[personIdColumn];
    if (!byPerson.has(id)) byPerson.set(id, []);
    byPerson.get(id)!.push(r);
  }
  const result = persons
    .filter(
      (s) => !teacher || teacher.scope.classes.some((c) => c.id === s.class_id),
    )
    .map((person) => ({
      ...person,
      stats: attendanceStats(byPerson.get(person.id) || []),
    }));

  if (type === "student") {
    return result.sort(
      (a: any, b: any) =>
        (parseInt(a.roll_number) || 999999) -
        (parseInt(b.roll_number) || 999999),
    );
  }

  return result;
}
