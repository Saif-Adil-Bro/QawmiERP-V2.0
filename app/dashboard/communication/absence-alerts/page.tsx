import { getAbsenceAlertData } from "@/app/actions/parent-communication";
import { getClasses } from "@/app/actions/students";
import AbsenceAlertsClient from "./AbsenceAlertsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "স্বয়ংক্রিয় অনুপস্থিতি ও হোয়াটসঅ্যাপ অ্যালার্ট | QawmiERP",
};

export default async function AbsenceAlertsPage() {
  const alertData = await getAbsenceAlertData();
  const classes = await getClasses();

  return (
    <AbsenceAlertsClient
      initialData={alertData}
      classes={classes || []}
    />
  );
}
