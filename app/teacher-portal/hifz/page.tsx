import {teacherClass} from '@/lib/portal/teacher-entry';
import {childLogs} from '@/lib/portal/queries';
import {toDhakaDateString} from '@/lib/date-utils';
import HifzForm from "./HifzForm";
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
  const logs = await childLogs(i.db,madrasaId,'hifz_logs',students.map(s=>s.id),dateStr);
  const teacherId = scope.teacher?.id;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Daily Hifz Sabak</h1>
        <p className="text-slate-500">Update Sabak, Saboki, and Amukhta progress for your class.</p>
      </div>

      <HifzForm 
        classes={classes || []} 
        students={students} 
        existingLogs={logs}
        currentDate={dateStr}
        currentClassId={classId}
        teacherId={teacherId}
        madrasaId={madrasaId}
      />
    </div>
  );
}
