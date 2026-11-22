import {teacherClass} from '@/lib/portal/teacher-entry';
import {childLogs} from '@/lib/portal/queries';
import {toDhakaDateString} from '@/lib/date-utils';
import AttendanceForm from "./AttendanceForm";
import {checkHolidayForDate} from "@/app/actions/holidays";
export const dynamic = 'force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{class_id?:string;date?:string}>}) {
  const params = await searchParams;
  const t = await teacherClass(params.class_id);
  if (!t) return null;
  const {students,current,i,scope} = t;
  const classes = scope.classes;
  const classId = current?.id || '';
  const dateStr = params.date || toDhakaDateString();
  const madrasaId = i.tenant;
  const logs = await childLogs(i.db,madrasaId,'attendance',students.map(s=>s.id),dateStr);
  const holidayInfo = await checkHolidayForDate(dateStr,current || undefined);
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
      />
    </div>
  );
}
