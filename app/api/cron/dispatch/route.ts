import { NextResponse } from "next/server";
import { authorizeCronRequest, resolveCronTenant } from "@/lib/automation/cron-auth";
import { runMasterCronDispatch } from "@/lib/automation/master-dispatcher";

// Next.js যেন কোনো প্ল্যাটফর্মে (Vercel/Railway) cron রিকোয়েস্ট ক্যাশ না করে
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handle(req: Request) {
  const auth = await authorizeCronRequest(req);
  if (!auth.ok) return auth.response;

  let body: any = {};
  if (req.method === "POST") {
    body = await req.json().catch(() => ({}));
  }
  const { searchParams } = new URL(req.url);
  const madrasaId = resolveCronTenant(
    auth,
    body.madrasaId || searchParams.get("madrasaId") || null
  );

  const result = await runMasterCronDispatch({
    madrasaId,
    triggerSource: "cron",
  });

  return NextResponse.json(result);
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
