import { getStudents, getClasses } from "@/app/actions/students";
import { getAcademicSessions, getCurrentSession } from "@/app/actions/sessions";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import StudentsListClient from "./StudentsListClient";

export const metadata = {
  title: "শিক্ষার্থী তালিকা | QawmiERP",
};

export default async function StudentsPage() {
  const [allStudents, classes, sessions, currentSession, madrasaInfo] = await Promise.all([
    getStudents(),
    getClasses(),
    getAcademicSessions(),
    getCurrentSession(),
    getMadrasaInfo(),
  ]);

  return (
    <StudentsListClient
      initialStudents={allStudents || []}
      classes={classes || []}
      sessions={sessions || []}
      currentSession={currentSession || null}
      madrasaInfo={madrasaInfo}
    />
  );
}
