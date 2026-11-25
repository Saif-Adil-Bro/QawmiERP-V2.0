import { getAbsenceAlertData } from "@/app/actions/parent-communication";
import { getClasses } from "@/app/actions/students";
import AbsenceAlertsClient from "./AbsenceAlertsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "স্বয়ংক্রিয় অনুপস্থিতি ও হোয়াটসঅ্যাপ অ্যালার্ট | QawmiERP",
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function AbsenceAlertsPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string; class?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const requestedDate =
    typeof params?.date === "string" && ISO_DATE_RE.test(params.date.trim())
      ? params.date.trim()
      : undefined;
  const requestedClass =
    typeof params?.class === "string" && params.class.trim()
      ? params.class.trim()
      : "ALL";

  const alertData = await getAbsenceAlertData(requestedDate, requestedClass);
  const classes = await getClasses();

  return (
    <AbsenceAlertsClient
      initialData={alertData}
      classes={classes || []}
      initialClass={requestedClass}
    />
  );
}
