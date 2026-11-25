import {teacherClass} from '@/lib/portal/teacher-entry';
import {childLogs} from '@/lib/portal/queries';
import {toDhakaDateString} from '@/lib/date-utils';
import AttendanceForm from "./AttendanceForm";
import {checkHolidayForDate} from "@/app/actions/holidays";
export const dynamic = 'force-dynamic';

function buildRecentDates(anchorDateStr: string, days = 7): string[] {
  const todayStr = toDhakaDateString();
  // Anchor around today (or anchorDateStr if the user navigated to a future/older week)
  const baseStr = anchorDateStr > todayStr ? anchorDateStr : todayStr;
  const parts = baseStr.split("-").map(Number);
  const baseUtc = new Date(Date.UTC(parts[0], (parts[1] || 1) - 1, parts[2] || 1));
  const list: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(baseUtc.getTime() - i * 86400000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    list.push(`${y}-${m}-${day}`);
  }
  return list;
}

export default async function Page({searchParams}:{searchParams:Promise<{class_id?:string;date?:string}>}) {
  const params = await searchParams;
  const t = await teacherClass(params.class_id);
  if (!t) return null;
  const {students,current,i,scope} = t;
  const classes = scope.classes;
  const classId = current?.id || '';
  const dateStr = params.date || toDhakaDateString();
  const madrasaId = i.tenant;
  const studentIds = students.map((s) => s.id);

  const recentDates = buildRecentDates(dateStr, 7);
  const rangeStart = recentDates[0];
  const rangeEnd = recentDates[recentDates.length - 1];

  const [logs, holidayInfo, recentRowsRes] = await Promise.all([
    childLogs(i.db, madrasaId, 'attendance', studentIds, dateStr),
    checkHolidayForDate(dateStr, current || undefined),
    studentIds.length > 0
      ? i.db
          .from('attendance')
          .select('date, student_id')
          .eq('madrasa_id', madrasaId)
          .in('student_id', studentIds)
          .gte('date', rangeStart)
          .lte('date', rangeEnd)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const savedByDate = new Map<string, Set<string>>();
  for (const row of (recentRowsRes?.data || []) as Array<{ date?: string; student_id?: string }>) {
    const d = String(row.date || "").slice(0, 10);
    const sid = String(row.student_id || "");
    if (!d || !sid) continue;
    if (!savedByDate.has(d)) savedByDate.set(d, new Set());
    savedByDate.get(d)!.add(sid);
  }
  // Ensure selected date is always reflected accurately even if outside the 7-day window
  if (logs.length > 0) {
    const set = savedByDate.get(dateStr) || new Set<string>();
    logs.forEach((l: any) => {
      if (l.student_id) set.add(String(l.student_id));
    });
    savedByDate.set(dateStr, set);
  }

  const recentDateStatuses = recentDates.map((d) => ({
    date: d,
    savedCount: savedByDate.get(d)?.size || 0,
    totalCount: studentIds.length,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">দৈনিক হাজিরা গ্রহণ</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          আপনার নির্ধারিত জামাতের শিক্ষার্থীদের দৈনিক উপস্থিতি ও অনুপস্থিতি লিপিবদ্ধ করুন।
        </p>
      </div>

      <AttendanceForm 
        classes={classes || []} 
        students={students} 
        existingAttendance={logs}
        currentDate={dateStr}
        currentClassId={classId}
        madrasaId={madrasaId}
        holidayInfo={holidayInfo}
        recentDateStatuses={recentDateStatuses}
      />
    </div>
  );
}
