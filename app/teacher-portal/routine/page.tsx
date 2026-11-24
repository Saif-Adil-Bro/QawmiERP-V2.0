import {webTeacher,teacherSchedule} from '@/lib/portal/identity';
import {portalHolidays} from '@/lib/portal/rules';
import TeacherRoutineViewClient from './TeacherRoutineViewClient';
export default async function Page() {
  const t = await webTeacher(true); if (!t) return null;
  const {i,scope} = t;
  return <TeacherRoutineViewClient schedule={await teacherSchedule(i,scope)} holidays={portalHolidays(scope.meta.academic_holidays,scope.classes)}
    teacherName={scope.display.name} teacherDesignation={scope.display.designation} />;
}
