export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";

const FREEIMAGE_API_KEY = "6d207e02198a847aa98d0a2a901485a5";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = (formData.get("type") as string) || "general"; // 'logo' | 'signature' | 'general'

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "কোনো ফাইল প্রদান করা হয়নি।" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "image/png";
    const filename = file.name || `image_${Date.now()}.png`;

    let uploadedUrl: string | null = null;
    let providerName = "";

    // 1. Try Freeimage.host / iili.io API
    try {
      const iiliFormData = new FormData();
      iiliFormData.append("key", FREEIMAGE_API_KEY);
      iiliFormData.append("action", "upload");
      iiliFormData.append("source", base64);
      iiliFormData.append("format", "json");

      const iiliRes = await fetch("https://freeimage.host/api/1/upload", {
        method: "POST",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
        },
        body: iiliFormData,
        signal: AbortSignal.timeout(8000),
      });

      if (iiliRes.ok) {
        const data = await iiliRes.json();
        if (data?.image?.url || data?.image?.display_url) {
          uploadedUrl = data.image.url || data.image.display_url;
          providerName = "iili.io";
        }
      }
    } catch {
      // Freeimage failed or timed out, continue to next provider
    }

    // 2. Try Catbox.moe API if iili failed
    if (!uploadedUrl) {
      try {
        const catboxFormData = new FormData();
        catboxFormData.append("reqtype", "fileupload");
        const blob = new Blob([buffer], { type: mimeType });
        catboxFormData.append("fileToUpload", blob, filename);

        const catboxRes = await fetch("https://catbox.moe/user/api.php", {
          method: "POST",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          body: catboxFormData,
          signal: AbortSignal.timeout(8000),
        });

        if (catboxRes.ok) {
          const text = (await catboxRes.text()).trim();
          if (text.startsWith("http://") || text.startsWith("https://")) {
            uploadedUrl = text;
            providerName = "catbox.moe";
          }
        }
      } catch {
        // Catbox failed or timed out
      }
    }

    // 3. Fallback to Supabase Storage (Guaranteed & Permanent)
    if (!uploadedUrl) {
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const madrasaId = user ? await getAuthMadrasaId(supabase, user) : "common";

        const adminClient = await createAdminClient();
        const bucketName = type === "signature" ? "signatures" : "logos";

        try {
          await adminClient.storage.createBucket(bucketName, {
            public: true,
            fileSizeLimit: 5242880,
            allowedMimeTypes: ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"],
          });
        } catch {
          // Bucket already exists
        }

        const ext = filename.split(".").pop() || "png";
        const storagePath = `${type}_${madrasaId || "upload"}_${Date.now()}.${ext}`;

        const { error: uploadErr } = await adminClient.storage
          .from(bucketName)
          .upload(storagePath, buffer, {
            contentType: mimeType,
            upsert: true,
          });

        if (!uploadErr) {
          const { data: pubData } = adminClient.storage.from(bucketName).getPublicUrl(storagePath);
          if (pubData?.publicUrl) {
            uploadedUrl = pubData.publicUrl;
            providerName = "supabase_storage";
          }
        }
      } catch {
        // Storage upload error
      }
    }

    if (!uploadedUrl) {
      return NextResponse.json(
        { error: "ইমেজ আপলোড করতে সমস্যা হয়েছে। অনুগ্রহ করে ইমেজ লিংক সরাসরি প্রদান করুন।" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url: uploadedUrl,
      provider: providerName,
      filename,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "সার্ভার এরর হয়েছে।" },
      { status: 500 }
    );
  }
}
