import { createClient } from "@/lib/supabase/server";
import { getParentFeedbacks } from "@/app/actions/parent-communication";
import FeedbackClient from "./FeedbackClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "অভিযোগ, পরামর্শ ও সাক্ষাতকার | অভিভাবক পোর্টাল",
};

export default async function ParentPortalFeedbackPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let madrasaId: string | null = null;
  let userProfile: any = null;

  if (user) {
    const { data: userData } = await supabase
      .from("users")
      .select("madrasa_id, full_name, phone")
      .eq("id", user.id)
      .single();
    madrasaId = userData?.madrasa_id;
    userProfile = userData;
  }

  // Fallback first madrasa
  if (!madrasaId) {
    const { data: firstM } = await supabase.from("madrasas").select("id").limit(1).maybeSingle();
    if (firstM) madrasaId = firstM.id;
  }

  const { getUserDataAccessScope } = await import("@/lib/data-access-guards");
  const scope = await getUserDataAccessScope();

  // Fetch students for selector
  let studentsQuery = supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, class_name, classes(name)")
    .order("roll_number", { ascending: true });

  if (!scope.isUnrestricted && scope.allowedStudentIds.length > 0) {
    studentsQuery = studentsQuery.in("id", scope.allowedStudentIds);
  } else if (madrasaId) {
    studentsQuery = studentsQuery.eq("madrasa_id", madrasaId);
  }

  const { data: fetchedStudents } = await studentsQuery;
  let students: any[] = fetchedStudents || [];

  if (students.length === 0) {
    const { data: fallbackStudents } = await supabase
      .from("students")
      .select("id, first_name, last_name, roll_number, class_name, classes(name)")
      .limit(5);
    students = fallbackStudents || [];
  }

  // Fetch feedbacks
  const initialFeedbacks = await getParentFeedbacks();

  return (
    <FeedbackClient
      students={students}
      userProfile={userProfile}
      initialFeedbacks={initialFeedbacks}
    />
  );
}
