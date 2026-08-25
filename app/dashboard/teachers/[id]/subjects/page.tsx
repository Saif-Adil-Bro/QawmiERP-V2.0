import { createClient } from "@/lib/supabase/server";
import { getTeacherSubjects, getAvailableClassSubjects } from "@/app/actions/teacher_subjects";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AssignTeacherSubjectForm from "./AssignTeacherSubjectForm";
import RemoveTeacherSubjectButton from "./RemoveTeacherSubjectButton";

export default async function TeacherSubjectsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const teacherId = params.id;
  const supabase = await createClient();
  
  const { data: teacher } = await supabase.from("teachers").select("*").eq("id", teacherId).single();
  const availableClassSubjects = await getAvailableClassSubjects();
  const assignedSubjects = await getTeacherSubjects(teacherId);

  // Filter out subjects that are already assigned to this teacher for that specific class
  const unassignedClassSubjects = availableClassSubjects.filter(
    (cs) => !assignedSubjects.some((as) => as.class_id === cs.class_id && as.subject_id === cs.subject_id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/teachers"
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Assign Subjects</h1>
          <p className="text-slate-500">Teacher: {teacher?.first_name} {teacher?.last_name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50">
              <h2 className="font-semibold text-slate-800">Assigned Subjects</h2>
            </div>
            <div className="p-0">
              {assignedSubjects.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No subjects assigned to this teacher yet.
                </div>
              ) : (
                <ul className="divide-y">
                  {assignedSubjects.map((item) => (
                    <li key={item.id} className="flex justify-between items-center p-4 hover:bg-slate-50">
                      <div>
                        <p className="font-medium text-slate-800">{item.subjects?.name}</p>
                        <p className="text-sm text-slate-500">Class: {item.classes?.name}</p>
                      </div>
                      <RemoveTeacherSubjectButton teacherSubjectId={item.id} teacherId={teacherId} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="bg-white rounded-xl border shadow-sm p-6 sticky top-6">
            <h2 className="font-semibold text-slate-800 mb-4">Assign Subject</h2>
            <AssignTeacherSubjectForm 
              teacherId={teacherId} 
              unassignedClassSubjects={unassignedClassSubjects} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
