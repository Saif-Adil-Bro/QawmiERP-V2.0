import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError } from "@/lib/audit-log";
import { dispatchNotification } from "@/lib/notifications/orchestrator";
import type { NotificationChannel } from "@/lib/notifications/channels";

export async function POST(req: Request) {
  const auth = await authorizeApi("communication");
  if (!auth.ok) return auth.response;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "অবৈধ JSON পেলোড।" }, { status: 400 });
  }

  // Strict cross-tenant isolation check
  if (body.madrasaId && String(body.madrasaId) !== auth.ctx.madrasaId) {
    return NextResponse.json(
      { error: "অন্য মাদ্রাসার জন্য নোটিফিকেশন পাঠানোর অনুমতি নেই।", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  // Strict template ownership check if templateId is provided
  if (body.templateId) {
    const admin = await createAdminClient();
    const { data: tpl, error: tplErr } = await admin
      .from("notification_templates")
      .select("id, madrasa_id")
      .eq("id", String(body.templateId))
      .maybeSingle();

    if (!tplErr) {
      if (!tpl) {
        return NextResponse.json({ error: "টেমপ্লেট পাওয়া যায়নি।" }, { status: 404 });
      }
      if (String(tpl.madrasa_id) !== auth.ctx.madrasaId) {
        return NextResponse.json(
          { error: "অন্য মাদ্রাসার টেমপ্লেট ব্যবহার করার অনুমতি নেই।", code: "FORBIDDEN" },
          { status: 403 }
        );
      }
    } else if (!isMissingTableError(tplErr)) {
      return NextResponse.json({ error: tplErr.message }, { status: 500 });
    }
  }

  const event = String(body.event || body.eventName || "manual.notification").trim();
  const messageBody =
    typeof body.body === "string"
      ? body.body
      : typeof body.message === "string"
        ? body.message
        : typeof body.text === "string"
          ? body.text
          : "";
  if (!messageBody && !body.templateId && !body.templateKey && !event) {
    return NextResponse.json(
      { error: "বার্তা (body) অথবা templateId/templateKey আবশ্যক।" },
      { status: 400 }
    );
  }

  const channels: NotificationChannel[] | undefined = Array.isArray(body.channels)
    ? body.channels
    : undefined;

  const result = await dispatchNotification(event, {
    madrasaId: auth.ctx.madrasaId,
    templateId: body.templateId || null,
    templateKey: body.templateKey || null,
    recipientUserId: body.recipientUserId || null,
    recipientStudentId: body.recipientStudentId || null,
    recipientPhone: body.recipientPhone || null,
    recipientEmail: body.recipientEmail || null,
    recipientToken: body.recipientToken || body.token || null,
    deviceTokens: Array.isArray(body.deviceTokens) ? body.deviceTokens : null,
    subject: body.subject || null,
    body: messageBody || null,
    variables: body.variables || {},
    channels,
    fallbackChannels: Array.isArray(body.fallbackChannels) ? body.fallbackChannels : undefined,
    maxAttempts: typeof body.maxAttempts === "number" ? body.maxAttempts : undefined,
    actorId: auth.ctx.userId,
    metadata: body.metadata || {},
  });

  return NextResponse.json({
    ok: result.ok,
    status: result.status,
    deliveredChannel: result.deliveredChannel || null,
    queueId: result.queueId || null,
    renderedBody: result.renderedBody,
    attemptedChannels: result.attemptedChannels,
    error: result.error || null,
  });
}
