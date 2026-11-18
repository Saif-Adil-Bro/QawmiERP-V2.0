import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/api-auth";
import { sendWebhookTestPing } from "@/lib/webhooks/dispatcher";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeApi("webhooks");
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  const result = await sendWebhookTestPing(auth.ctx.madrasaId, id);
  if (!result.ok && result.error === "ওয়েবহুক এন্ডপয়েন্ট পাওয়া যায়নি।") {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
