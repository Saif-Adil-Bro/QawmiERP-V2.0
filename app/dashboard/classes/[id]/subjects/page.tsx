import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getSubjects } from "@/app/actions/subjects";
import { getClassSubjects } from "@/app/actions/class_subjects";
import ClassSubjectsManager from "./ClassSubjectsManager";

export default async function ClassSubjectsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const classId = params.id;
  
  let cls: any = null;
  try {
    const adminClient = await createAdminClient();
    const { data } = await adminClient.from("classes").select("*").eq("id", classId).single();
    cls = data;
  } catch {
    const supabase = await createClient();
    const { data } = await supabase.from("classes").select("*").eq("id", classId).single();
    cls = data;
  }

  const allSubjects = await getSubjects();
  const assignedSubjects = await getClassSubjects(classId);

  return (
    <ClassSubjectsManager
      classId={classId}
      className={cls?.name || "জামাত"}
      classDescription={cls?.description || null}
      initialAllSubjects={allSubjects || []}
      initialAssignedSubjects={assignedSubjects || []}
    />
  );
}
