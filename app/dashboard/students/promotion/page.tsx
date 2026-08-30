import { getAcademicSessions, getStudentEnrollments } from "@/app/actions/sessions";
import { getClasses } from "@/app/actions/students";
import PromotionClient from "./PromotionClient";

export const metadata = {
  title: "শিক্ষার্থী প্রমোশন | QawmiERP",
};

export default async function StudentPromotionPage() {
  const [sessions, classes, allEnrollments] = await Promise.all([
    getAcademicSessions(),
    getClasses(),
    getStudentEnrollments("ALL"),
  ]);

  return (
    <PromotionClient
      sessions={sessions}
      classes={classes}
      allEnrollments={allEnrollments}
    />
  );
}
