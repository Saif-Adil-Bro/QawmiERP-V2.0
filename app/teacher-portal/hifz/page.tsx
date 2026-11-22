import { webTeacher, teacherStudents } from "@/lib/portal/identity";
import { rows } from "@/lib/portal/queries";
import { validDate } from "@/lib/portal/rules";
import { readHifz } from "@/lib/hifz/read";
import { toDhakaDateString } from "@/lib/date-utils";
import HifzForm from "./HifzForm";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ class_id?: string; date?: string }>;
}) {
  const [t, params] = await Promise.all([webTeacher(), searchParams]);
  if (!t) return null;
  const { i, scope } = t;
  const [students, teachers] = await Promise.all([
    teacherStudents(i, scope),
    rows(() =>
      i.db
        .from("teachers")
        .select("id,first_name,last_name")
        .eq("madrasa_id", i.tenant),
    ),
  ]);
  const bundle = await readHifz(
    i.db,
    i.tenant,
    students,
    scope.meta.student_profiles,
  );
  return (
    <main className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-emerald-950">
          হিফজুল কুরআন ও সবিনা
        </h1>
        <p className="text-slate-600">
          জামাত ও শিক্ষার্থী বেছে পাঠ, ভুল ও অগ্রগতি লিখুন।
        </p>
      </header>
      <HifzForm
        seed={{
          owner: `${i.tenant}:${i.user.id}:teacher`,
          asOf: Date.now(),
          classes: scope.classes,
          students,
          teachers,
          bundle,
        }}
        currentClassId={
          scope.classes.find((c) => c.id === params.class_id)?.id ||
          scope.classes[0]?.id ||
          ""
        }
        currentDate={validDate(params.date) ? params.date : toDhakaDateString()}
      />
    </main>
  );
}
