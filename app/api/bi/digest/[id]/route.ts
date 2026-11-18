import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateAndAuditDigest,
  getDigestScheduleById,
} from "@/lib/bi/digest-generator";

function extractIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip") || "unknown";
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeApi("bi");
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "ডাইজেস্ট আইডি আবশ্যক" }, { status: 400 });
  }

  const schedule = await getDigestScheduleById(auth.ctx.madrasaId, id);
  if (!schedule) {
    return NextResponse.json(
      { error: "ডাইজেস্ট শিডিউল পাওয়া যায়নি অথবা অনুমোদিত নয়" },
      { status: 404 }
    );
  }

  const url = new URL(req.url);
  const formatParam = (url.searchParams.get("format") || schedule.format || "html").toLowerCase();
  const format: "html" | "xlsx" = formatParam === "xlsx" ? "xlsx" : "html";
  const monthsParam = url.searchParams.get("months");
  const months = monthsParam ? Number(monthsParam) : 6;
  const sessionId = url.searchParams.get("sessionId") || null;

  let madrasaName = "QawmiERP";
  try {
    const admin = await createAdminClient();
    const { data: m } = await admin
      .from("madrasas")
      .select("name")
      .eq("id", auth.ctx.madrasaId)
      .maybeSingle();
    if (m?.name) madrasaName = String(m.name);
  } catch {
    // ignore
  }

  const generated = await generateAndAuditDigest({
    madrasaId: auth.ctx.madrasaId,
    actorId: auth.ctx.userId,
    actorName: auth.ctx.actorName || auth.ctx.actorEmail || "Admin",
    actorRole: auth.ctx.actorRole || "muhtamim",
    ipAddress: extractIp(req),
    madrasaName,
    scheduleId: schedule.id,
    format,
    months: Number.isFinite(months) && months > 0 ? months : 6,
    sessionId,
    title: schedule.name || "নির্বাহী বিআই ডাইজেস্ট প্রতিবেদন",
  });

  const toAscii = (val: string) => String(val || "").replace(/[^\x20-\x7E]/g, "_");
  const safeFilename = toAscii(generated.filename);

  const headers: Record<string, string> = {
    "X-Export-Id": toAscii(generated.watermark.exportId),
    "X-Watermark-Line": encodeURIComponent(generated.watermark.watermarkLine),
    "Cache-Control": "no-store",
  };

  if (format === "xlsx" && generated.workbook) {
    headers["Content-Type"] =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    headers["Content-Disposition"] = `attachment; filename="${safeFilename}"`;
    return new NextResponse(new Uint8Array(generated.workbook), {
      status: 200,
      headers,
    });
  }

  headers["Content-Type"] = "text/html; charset=utf-8";
  headers["Content-Disposition"] = `inline; filename="${safeFilename}"`;
  return new NextResponse(generated.html || "", {
    status: 200,
    headers,
  });
}
