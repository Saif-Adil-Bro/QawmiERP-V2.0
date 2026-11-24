import sharp from "sharp";
import { writeGuard } from "@/lib/action-authorization";
import { salaryAccess } from "@/lib/finance/staff-access";
import { createAdminClient } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const limit = 2 * 1024 * 1024;
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie",
};
type Context = { params: Promise<{ id: string }> };
const failure = (error: string, status: number) =>
  Response.json({ error }, { status, headers });
async function access(id: string, write: boolean) {
  const gate = await writeGuard(write ? "finance" : "financeRead");
  if (!gate.allowed || !gate.userId || !gate.madrasaId)
    return failure("অনুমতি নেই।", 403);
  if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id))
    return failure("ভাউচার পাওয়া যায়নি।", 404);
  const db = await createAdminClient(),
    { data, error } = await db
      .from("expenses")
      .select("id,category,payroll_record_id")
      .eq("madrasa_id", gate.madrasaId)
      .eq("id", id)
      .maybeSingle();
  if (error) return failure("ভাউচার যাচাই করা যায়নি।", 503);
  if (
    !data ||
    ((data.category === "Salary" || data.payroll_record_id) &&
      !salaryAccess(gate, "read"))
  )
    return failure("ভাউচার পাওয়া যায়নি।", 404);
  return { db, t: gate.madrasaId, a: gate.userId };
}
export async function GET(_req: Request, { params }: Context) {
  const { id } = await params,
    s = await access(id, false);
  if (s instanceof Response) return s;
  const { data, error } = await s.db.rpc("treasury_read_memo", {
    t: s.t,
    e: id,
  });
  if (error) return failure("মেমো পড়া যায়নি।", 503);
  if (!data) return failure("মেমো সংযুক্ত নেই।", 404);
  return new Response(new Uint8Array(Buffer.from(data, "base64")), {
    headers: {
      ...headers,
      "Content-Type": "image/jpeg",
      "Content-Disposition": 'inline; filename="cash-memo.jpg"',
    },
  });
}
export async function POST(req: Request, { params }: Context) {
  // A custom header + no cross-origin CORS prevents a third-party form uploading with a web session.
  if (req.headers.get("x-qawmi-memo") !== "1")
    return failure("অবৈধ আপলোড।", 403);
  const { id } = await params,
    s = await access(id, true);
  if (s instanceof Response) return s;
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(
      req.headers.get("content-type") || "",
    )
  )
    return failure("JPG, PNG বা WebP ছবি দিন।", 415);
  if (Number(req.headers.get("content-length")) > limit)
    return failure("সর্বোচ্চ ২ মেগাবাইট।", 413);
  const reader = req.body?.getReader();
  if (!reader) return failure("ছবি পাওয়া যায়নি।", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      return failure("সর্বোচ্চ ২ মেগাবাইট।", 413);
    }
    chunks.push(value);
  }
  let jpeg: Buffer;
  try {
    const input = sharp(Buffer.concat(chunks), {
        limitInputPixels: 20_000_000,
        failOn: "error",
      }),
      meta = await input.metadata();
    if (
      !["jpeg", "png", "webp"].includes(meta.format || "") ||
      (meta.pages || 1) !== 1
    )
      throw Error();
    jpeg = await input
      .rotate()
      .resize({
        width: 2000,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#fff" })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    return failure("ছবিটি পড়া যায়নি। ছোট, স্থির ছবি দিন।", 422);
  }
  if (jpeg.length > limit) return failure("আরও ছোট ছবি দিন।", 413);
  const { error } = await s.db.rpc("treasury_attach_memo", {
    t: s.t,
    a: s.a,
    e: id,
    bytes: jpeg.toString("base64"),
  });
  return error
    ? failure(
        error.code === "23505"
          ? "এই ভাউচারের মেমো ইতিমধ্যে সংরক্ষিত।"
          : "সংযুক্তি সংরক্ষিত হয়নি। সময়কাল ও ভাউচার যাচাই করুন।",
        409,
      )
    : Response.json({ ok: true }, { status: 201, headers });
}
