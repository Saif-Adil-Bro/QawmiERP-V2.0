import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/api-auth";
import { getExecutiveBiSnapshot } from "@/lib/bi/executive-bi-service";

export async function GET(req: Request) {
  const auth = await authorizeApi("bi");
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const monthsParam = url.searchParams.get("months");
    const sessionId = url.searchParams.get("sessionId") || null;
    const months = monthsParam ? Number(monthsParam) : 6;

    const snapshot = await getExecutiveBiSnapshot(auth.ctx.madrasaId, {
      months: Number.isFinite(months) && months > 0 ? months : 6,
      sessionId,
    });

    return NextResponse.json(snapshot, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "নির্বাহী বিআই তথ্য লোড করতে ব্যর্থ" },
      { status: 500 }
    );
  }
}
