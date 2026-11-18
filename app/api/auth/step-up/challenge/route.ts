import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { loadServerPermissions } from "@/lib/permissions-server";
import { createStepUpChallenge, type StepUpChannel } from "@/lib/step-up-auth";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await createAdminClient();
  const { data: userRow } = await admin
    .from("users")
    .select("madrasa_id")
    .eq("id", authUser.id)
    .maybeSingle();

  const madrasaId = String((userRow as any)?.madrasa_id || "");
  if (!madrasaId) {
    return NextResponse.json({ error: "No madrasa linked" }, { status: 403 });
  }

  const permCtx = await loadServerPermissions(authUser.id, madrasaId);
  if (!permCtx || permCtx.status === "SUSPENDED" || permCtx.status === "DISABLED") {
    return NextResponse.json({ error: "Account disabled" }, { status: 403 });
  }

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const channel = String(body.channel || "totp") as StepUpChannel;
  if (!["totp", "sms", "email"].includes(channel)) {
    return NextResponse.json({ error: "Invalid channel. Expected totp, sms, or email." }, { status: 400 });
  }

  const forwarded = req.headers.get("x-forwarded-for");
  const ipAddress = forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip");
  const userAgent = req.headers.get("user-agent");

  const result = await createStepUpChallenge({
    userId: authUser.id,
    madrasaId,
    channel,
    actionScope: body.actionScope ? String(body.actionScope) : "CRITICAL",
    ipAddress,
    userAgent,
  });

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
