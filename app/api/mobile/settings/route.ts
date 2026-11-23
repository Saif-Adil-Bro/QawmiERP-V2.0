import { NextRequest } from "next/server";
import {
  authenticateMobileRequest,
  mobileError,
  mobileSuccess,
} from "@/lib/mobile-api";
import { readJsonStore } from "@/lib/madrasa-store";

export const dynamic = "force-dynamic";
const headerFields = [
  "name",
  "address",
  "contact_email",
  "contact_phone",
  "logo_url",
];
export async function GET(req: NextRequest) {
  const auth = await authenticateMobileRequest(req, { requireWrite: false });
  if (!auth.ok) return auth.response;
  // A madrasa row can hold entire fee, payroll, approval and gateway stores.
  // The mobile settings screen only needs the institution header and two identifiers.
  try {
    const [{ data: madrasa, error }, meta] = await Promise.all([
      auth.adminClient
        .from("madrasas")
        .select("id,name,address,contact_email,contact_phone:phone,logo_url")
        .eq("id", auth.ctx.madrasaId)
        .single(),
      readJsonStore(auth.ctx.madrasaId, "meta", true),
    ]);
    if (error || !madrasa) throw Error();
    const str = (v: unknown) => (typeof v === "string" ? v : null);
    return mobileSuccess(
      {
        madrasa,
        settings: {
          madrasa_prefix: str(meta.madrasa_prefix),
          active_session_id: str(meta.active_session_id),
        },
      },
      "Success",
      undefined,
      200,
      req,
    );
  } catch {
    return mobileError("সেটিংস পড়া যায়নি।", 503, "SETTINGS_UNAVAILABLE");
  }
}
export async function PATCH(req: NextRequest) {
  const auth = await authenticateMobileRequest(req, {
    module: "users",
    requireWrite: true,
  });
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    if (
      !body ||
      Array.isArray(body) ||
      typeof body !== "object" ||
      !Object.keys(body).length ||
      Object.entries(body).some(
        ([k, v]) => !headerFields.includes(k) || typeof v !== "string",
      )
    )
      return mobileError(
        "শুধু প্রতিষ্ঠানের যোগাযোগের তথ্য পরিবর্তন করা যাবে।",
        400,
        "INVALID_SETTINGS",
      );
    const { contact_phone, ...fields } = body;
    const { data, error } = await auth.adminClient
      .from("madrasas")
      .update({
        ...fields,
        ...(contact_phone !== undefined ? { phone: contact_phone } : {}),
      })
      .eq("id", auth.ctx.madrasaId)
      .select("id")
      .single();
    if (error || !data)
      return mobileError("সেটিংস সংরক্ষিত হয়নি।", 409, "SETTINGS_NOT_SAVED");
    return mobileSuccess({ updated: true }, "সেটিংস সফলভাবে আপডেট হয়েছে।");
  } catch {
    return mobileError("সেটিংস সঠিক নয়।", 400, "INVALID_SETTINGS");
  }
}
