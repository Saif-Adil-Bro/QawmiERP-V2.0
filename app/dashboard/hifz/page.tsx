import { webScope } from "@/lib/hifz/access";
import { readHifz, summarizeHifz } from "@/lib/hifz/read";
import { rows } from "@/lib/portal/queries";
import { validDate } from "@/lib/portal/rules";
import { toDhakaDateString } from "@/lib/date-utils";
import AdminHifzWorkspaceClient from "./AdminHifzWorkspaceClient";

export const dynamic = "force-dynamic";

export default async function HifzPage({
  searchParams,
}: {
  searchParams?: Promise<{ class_id?: string; date?: string }>;
}) {
  const params = searchParams ? (await searchParams) || {} : {};
  const scope = await webScope();

  const [classes, teachers, bundle] = await Promise.all([
    rows(() =>
      scope.db
        .from("classes")
        .select("id,name")
        .eq("madrasa_id", scope.tenant)
        .order("name"),
    ),
    rows(() =>
      scope.db
        .from("teachers")
        .select("id,first_name,last_name")
        .eq("madrasa_id", scope.tenant),
    ),
    readHifz(scope.db, scope.tenant, scope.roster, scope.legacy),
  ]);

  const sortedStudents = [...scope.roster].sort(
    (a: any, b: any) =>
      (parseInt(a.roll_number) || 999999) - (parseInt(b.roll_number) || 999999),
  );

  const currentClassId =
    classes.find((c: any) => c.id === params.class_id)?.id ||
    classes[0]?.id ||
    "";
  const currentDate = validDate(params.date) ? params.date! : toDhakaDateString();
  const summary = summarizeHifz(bundle, toDhakaDateString());

  return (
    <AdminHifzWorkspaceClient
      seed={{
        owner: `${scope.tenant}:${scope.actor}:admin`,
        asOf: Date.now(),
        classes,
        students: sortedStudents,
        teachers,
        bundle,
      }}
      summary={summary}
      currentClassId={currentClassId}
      currentDate={currentDate}
    />
  );
}
