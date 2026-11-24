import { getSubjects } from "@/app/actions/subjects";
import { getClassSubjects } from "@/app/actions/class_subjects";
import { getClasses, getTeachersForClassAssignment } from "@/app/actions/classes";
import { getClassTeacherSubjects } from "@/app/actions/teacher_subjects";
import ClassSubjectsManager from "./ClassSubjectsManager";

export const dynamic = "force-dynamic";

export default async function ClassSubjectsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const classId = params.id;
  
  const [classesList, allSubjects, assignedSubjects, availableTeachers, teacherSubjects] = await Promise.all([
    getClasses(),
    getSubjects(),
    getClassSubjects(classId),
    getTeachersForClassAssignment(),
    getClassTeacherSubjects(classId),
  ]);

  const cls = classesList.find((c) => c.id === classId);

  return (
    <ClassSubjectsManager
      classId={classId}
      className={cls?.name || "জামাত"}
      classDescription={cls?.description || null}
      classTeacherName={cls?.class_teacher_name || null}
      initialAllSubjects={allSubjects || []}
      initialAssignedSubjects={assignedSubjects || []}
      availableTeachers={availableTeachers || []}
      initialTeacherSubjects={teacherSubjects || []}
    />
  );
}
