import {teacherClass} from '@/lib/portal/teacher-entry';
import {childLogs} from '@/lib/portal/queries';
import {toDhakaDateString} from '@/lib/date-utils';
import KitabEntryClient from "./KitabEntryClient";
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
  const logs = await childLogs(i.db,madrasaId,'kitab_logs',students.map(s=>s.id),dateStr);
  const teacherId = scope.teacher?.id;
  return (
    <KitabEntryClient
      classes={classes || []}
      students={students}
      existingLogs={logs}
      currentClassId={classId}
      currentDate={dateStr}
      teacherId={teacherId}
      madrasaId={madrasaId}
    />
  );
}
