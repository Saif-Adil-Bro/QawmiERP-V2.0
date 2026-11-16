import { getExamGradingConfig } from "@/app/actions/exams";
import GradingScaleClient from "./GradingScaleClient";

export const metadata = {
  title: "মার্ক গ্রেড সেটিংস | QawmiManager",
  description: "পরীক্ষার নম্বর থেকে অটোমেটিক গ্রেড, বিভাগ ও GPA পয়েন্ট নির্ধারণের কাস্টম স্কেল সেটিংস।",
};

export const dynamic = "force-dynamic";

export default async function ExamGradingPage() {
  const config = await getExamGradingConfig();
  return <GradingScaleClient initialConfig={config} />;
}
