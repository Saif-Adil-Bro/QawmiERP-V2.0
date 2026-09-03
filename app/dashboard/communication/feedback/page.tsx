import { createClient } from "@/lib/supabase/server";
import { getParentFeedbacks } from "@/app/actions/parent-communication";
import { getStudents, getClasses } from "@/app/actions/students";
import AdminFeedbackClient from "./AdminFeedbackClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "অভিভাবক অভিযোগ ও পরামর্শ বক্স | QawmiERP",
};

export default async function AdminFeedbackPage() {
  const feedbacks = await getParentFeedbacks();
  const students = await getStudents();
  const classes = await getClasses();

  return (
    <AdminFeedbackClient
      initialFeedbacks={feedbacks}
      students={students || []}
      classes={classes || []}
    />
  );
}
