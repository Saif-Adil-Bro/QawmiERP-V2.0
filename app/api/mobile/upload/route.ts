import { NextRequest } from "next/server";
import {
  authenticateMobileRequest,
  mobileError,
  mobileSuccess,
  resolveAbsoluteUrl,
} from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export async function POST(req: NextRequest) {
  const auth = await authenticateMobileRequest(req, {
    requireWrite: false,
    allowPortalRoles: true,
  });
  if (!auth.ok) return auth.response;

  try {
    let base64 = "";
    let filename = `upload_${Date.now()}.jpg`;
    let mimeType = "image/jpeg";
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file || typeof file === "string") {
        return mobileError("file ফিল্ড আবশ্যক।", 400, "VALIDATION_ERROR");
      }
      if (file.size > MAX_BYTES) {
        return mobileError("ফাইলের সাইজ ৮ MB এর বেশি হতে পারবে না।", 413, "FILE_TOO_LARGE");
      }
      const buf = Buffer.from(await file.arrayBuffer());
      base64 = buf.toString("base64");
      filename = file.name || filename;
      mimeType = file.type || mimeType;
    } else {
      const body = await req.json();
      const raw = String(body.imageBase64 || body.image || "");
      if (!raw) {
        return mobileError("imageBase64 বা multipart file আবশ্যক।", 400, "VALIDATION_ERROR");
      }
      base64 = raw.replace(/^data:image\/[a-z0-9+.-]+;base64,/, "");
      filename = body.filename || filename;
    }

    const buffer = Buffer.from(base64, "base64");
    const bucket = "madrasa-uploads";
    await auth.adminClient.storage.createBucket(bucket, { public: true }).catch(() => {});

    const path = `${auth.ctx.madrasaId}/${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: uploadErr } = await auth.adminClient.storage
      .from(bucket)
      .upload(path, buffer, { contentType: mimeType, upsert: true });

    if (uploadErr) {
      return mobileError(uploadErr.message, 400, "UPLOAD_FAILED");
    }

    const { data: pub } = auth.adminClient.storage.from(bucket).getPublicUrl(path);
    const fullUrl = resolveAbsoluteUrl(pub?.publicUrl, req);

    return mobileSuccess(
      { url: fullUrl, path, mime_type: mimeType },
      "ফাইল সফলভাবে আপলোড হয়েছে।",
      undefined,
      201
    );
  } catch (err: any) {
    return mobileError(err?.message || "Upload failed", 500, "INTERNAL_ERROR");
  }
}
