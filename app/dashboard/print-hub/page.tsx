import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import { getClasses, getStudents } from "@/app/actions/students";
import PrintHubClient from "./PrintHubClient";

export const metadata = {
  title: "প্রিন্ট ও ফরম হাব | QawmiERP",
  description: "মাদরাসার খালি ভর্তি ফরম, মানি রিসিট, পরীক্ষক মূল্যায়ন শিট, লেটারপ্যাডে কাস্টম নোটিশ ও ডায়নামিক টেবিল প্রিন্ট মডিউল",
};

export default async function PrintHubPage() {
  const [madrasaInfo, classes, students] = await Promise.all([
    getMadrasaInfo(),
    getClasses(),
    getStudents(),
  ]);

  return (
    <PrintHubClient
      madrasaInfo={madrasaInfo}
      classes={classes || []}
      allStudents={students || []}
    />
  );
}
