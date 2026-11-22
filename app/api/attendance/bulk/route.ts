import { matchesSyncOwner } from "@/lib/portal/teacher-entry";
import { NextResponse } from "next/server";
import { saveAttendance } from "@/app/actions/attendance";
import { webIdentity } from "@/lib/portal/identity";
import { verifyRoster } from "@/lib/portal/teacher-entry";
export async function POST(req: Request) {
  if (!(await matchesSyncOwner(req)))
    return NextResponse.json(
      { error: "সিঙ্ক মুলতবি: অ্যাকাউন্ট বদলেছে।" },
      { status: 409 },
    );
  const i = await webIdentity();
  if (!i) return new Response(null, { status: 401 });
  const { records } = await req.json();
  if (
    !Array.isArray(records) ||
    !records.length ||
    records.some((r) => !r || r.date !== records[0].date)
  )
    return NextResponse.json(
      { error: "এক দিনের হাজিরা নির্বাচন করুন।" },
      { status: 400 },
    );
  if (!(await verifyRoster(i.tenant, records)))
    return NextResponse.json(
      { error: "শিক্ষার্থী বরাদ্দকৃত জামাতের নয়।" },
      { status: 403 },
    );
  const result = await saveAttendance(records[0].date, records);
  return NextResponse.json(
    { ...result, count: result.error ? 0 : records.length },
    { status: result.error ? 400 : 200 },
  );
}
