import { getFeeAlertStudentsData } from "@/app/actions/parent-communication";
import { getClasses } from "@/app/actions/students";
import FeeAlertsClient from "./FeeAlertsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ফি বকেয়া ও পেমেন্ট লিঙ্ক নোটিফিকেশন | QawmiERP",
};

export default async function FeeAlertsPage() {
  const feeData = await getFeeAlertStudentsData();
  const classes = await getClasses();

  return (
    <FeeAlertsClient
      initialData={feeData}
      classes={classes || []}
    />
  );
}
