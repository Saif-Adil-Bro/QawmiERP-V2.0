import {toDhakaDateString} from '@/lib/date-utils';
import {webTeacher,teacherSchedule,teacherStudents} from '@/lib/portal/identity';
import {childLogs,notices} from '@/lib/portal/queries';
import {portalHolidays} from '@/lib/portal/rules';
import {getEarlyWarningAlerts} from '@/app/actions/early-warning';
import TeacherDashboardClient from './TeacherDashboardClient';
export default async function Page() {
  const t = await webTeacher(true); if (!t) return null;
  const {i,scope} = t; const ids = (await teacherStudents(i,scope)).map(s=>s.id);
  const today = toDhakaDateString();
  const [schedule,a,h,n,alerts] = await Promise.all([teacherSchedule(i,scope),childLogs(i.db,i.tenant,'attendance',ids,today),
    childLogs(i.db,i.tenant,'hifz_logs',ids,today),notices(i.db,i.tenant,'Teachers',scope.classes.map(c=>c.id),portalHolidays(scope.meta.academic_holidays,scope.classes)),getEarlyWarningAlerts()]);
  return <TeacherDashboardClient teacherId={schedule.teacherId} teacherName={scope.display.name} designation={scope.display.designation}
    todayAttendanceCount={a.length} todayHifzCount={h.length} classes={scope.classes} notices={n.slice(0,3)} holidays={portalHolidays(scope.meta.academic_holidays,scope.classes)} earlyWarningData={alerts} teacherSchedule={schedule} />;
}
