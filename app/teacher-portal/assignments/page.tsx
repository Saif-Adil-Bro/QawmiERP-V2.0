import { getAssignments } from "@/app/actions/assignments";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import TeacherAssignmentsClient from "./TeacherAssignmentsClient";

export const dynamic = "force-dynamic";

export default async function TeacherAssignmentsPage() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  let teacherName = "সম্মানিত শিক্ষক";
  if (user) {
    const { data: userData } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", user.id)
      .single();
    if (userData?.full_name) {
      teacherName = userData.full_name;
    }
  }

  const { assignments, classes } = await getAssignments();

  return (
    <TeacherAssignmentsClient
      initialAssignments={assignments}
      classes={classes}
      teacherName={teacherName}
    />
  );
}
