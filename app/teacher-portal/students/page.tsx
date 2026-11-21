import {teacherClass} from '@/lib/portal/teacher-entry';
import StudentDirectoryClient from './StudentDirectoryClient';
export default async function Page({searchParams}:{searchParams:Promise<{class_id?:string}>}) {
  const t = await teacherClass((await searchParams).class_id); if (!t) return null;
  return <StudentDirectoryClient classes={t.scope.classes} students={t.students} currentClassId={t.current?.id || ''} />;
}
