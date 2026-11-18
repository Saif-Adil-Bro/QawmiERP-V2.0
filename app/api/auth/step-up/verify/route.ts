import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { loadServerPermissions } from "@/lib/permissions-server";
import {
  DEFAULT_STEP_UP_TTL_SECONDS,
  STEP_UP_COOKIE_NAME,
  verifyStepUpChallenge,
  type StepUpChannel,
} from "@/lib/step-up-auth";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await createAdminClient();
  const { data: userRow } = await admin
    .from("users")
    .select("madrasa_id, full_name, email, role")
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

  const rawChannel = body.channel ? String(body.channel) : undefined;
  if (rawChannel && !["totp", "sms", "email"].includes(rawChannel)) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  }

  const forwarded = req.headers.get("x-forwarded-for");
  const ipAddress = forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip");
  const userAgent = req.headers.get("user-agent");

  const result = await verifyStepUpChallenge({
    userId: authUser.id,
    madrasaId,
    channel: rawChannel as StepUpChannel | undefined,
    code: String(body.code || body.otp || ""),
    challengeId: body.challengeId ? String(body.challengeId) : undefined,
    actionScope: body.actionScope ? String(body.actionScope) : "CRITICAL",
    actorName: (userRow as any)?.full_name || authUser.email || "User",
    actorEmail: (userRow as any)?.email || authUser.email || "",
    actorRole: permCtx.role,
    ipAddress,
    userAgent,
  });

  if (!result.success || !result.token) {
    return NextResponse.json(result, { status: result.locked ? 429 : 400 });
  }

  const response = NextResponse.json({
    success: true,
    token: result.token,
    expiresAt: result.expiresAt,
  });

  response.cookies.set(STEP_UP_COOKIE_NAME, result.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEFAULT_STEP_UP_TTL_SECONDS,
  });

  return response;
}
