import { createClient } from "@/lib/supabase/server";
import LeaveClient from "./LeaveClient";
import { getUserDataAccessScope } from "@/lib/data-access-guards";
import { getParentFeedbacks } from "@/app/actions/parent-communication";

export const dynamic = "force-dynamic";

export default async function ParentPortalLeave() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userData } = await supabase
    .from("users")
    .select("madrasa_id, full_name, phone")
    .eq("id", user.id)
    .single();
  const madrasaId = userData?.madrasa_id;

  const scope = await getUserDataAccessScope();

  let studentsQuery = supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, student_id, class_name, classes(name)")
    .order("roll_number", { ascending: true });

  if (!scope.isUnrestricted && scope.allowedStudentIds.length > 0) {
    studentsQuery = studentsQuery.in("id", scope.allowedStudentIds);
  } else if (madrasaId) {
    studentsQuery = studentsQuery.eq("madrasa_id", madrasaId);
  }

  const { data: fetchedStudents } = await studentsQuery;
  let students = fetchedStudents || [];

  if (students.length === 0) {
    const { data: fallbackStudents } = await supabase
      .from("students")
      .select("id, first_name, last_name, roll_number, student_id, class_name, classes(name)")
      .limit(5);
    students = fallbackStudents || [];
  }

  // Fetch real leave requests for this parent / student
  const allFeedbacks = await getParentFeedbacks();
  const leaveApplications = allFeedbacks.filter(
    (f) => f.category === "ছুটির আবেদন" || f.action_type === "GENERAL"
  );

  return (
    <LeaveClient
      students={students || []}
      userProfile={userData}
      initialApplications={leaveApplications}
    />
  );
}
