import { getAcademicSessions, getStudentEnrollments } from "@/app/actions/sessions";
import SessionsClient from "./SessionsClient";

export const metadata = {
  title: "শিক্ষাবর্ষ পরিচালনা | QawmiERP",
};

export default async function AcademicSessionsPage() {
  const sessions = await getAcademicSessions();

  // Compute student count per session
  const studentCounts: Record<string, number> = {};
  for (const sess of sessions) {
    const enrollments = await getStudentEnrollments(sess.id);
    studentCounts[sess.id] = enrollments.length;
  }

  return (
    <SessionsClient
      initialSessions={sessions}
      studentCounts={studentCounts}
    />
  );
}
