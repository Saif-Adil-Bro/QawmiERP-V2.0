import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    let cleanBase64 = "";
    let originalFilename = "student_image.jpg";
    let fileBlob: Blob | null = null;
    let fileBuffer: Buffer | null = null;
    let mimeType = "image/jpeg";
    let rawDataUrl = "";
    let uploadType = "general";
    let preferredProvider = "auto"; // "iili.io" | "imgbb" | "auto"

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const base64Field = (formData.get("imageBase64") || formData.get("image")) as string | null;
        const typeField = formData.get("type") as string | null;
        const providerField = formData.get("provider") as string | null;
        if (typeField) uploadType = typeField;
        if (providerField) preferredProvider = providerField;

        if (file && typeof file !== "string") {
          const arrayBuf = await file.arrayBuffer();
          fileBuffer = Buffer.from(arrayBuf);
          cleanBase64 = fileBuffer.toString("base64");
          originalFilename = file.name || "student_image.jpg";
          mimeType = file.type || "image/jpeg";
          fileBlob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
          rawDataUrl = `data:${mimeType};base64,${cleanBase64}`;
        } else if (base64Field) {
          rawDataUrl = base64Field;
          cleanBase64 = base64Field.replace(/^data:image\/[a-z0-9+.-]+;base64,/, "");
          fileBuffer = Buffer.from(cleanBase64, "base64");
          fileBlob = new Blob([new Uint8Array(fileBuffer)], { type: "image/jpeg" });
        }
      } catch (formErr) {
        console.warn("Error parsing form data in upload-image:", formErr);
      }
    } else {
      // JSON body
      try {
        const body = await req.json();
        const base64Input = body.imageBase64 || body.image || "";
        if (body.type) uploadType = body.type;
        if (body.provider) preferredProvider = body.provider;
        if (base64Input) {
          rawDataUrl = base64Input;
          cleanBase64 = base64Input.replace(/^data:image\/[a-z0-9+.-]+;base64,/, "");
          fileBuffer = Buffer.from(cleanBase64, "base64");
          const mimeMatch = base64Input.match(/^data:(image\/[a-z0-9+.-]+);base64,/);
          mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
          fileBlob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
        }
        if (body.filename) originalFilename = body.filename;
      } catch (jsonErr) {
        // Fallback: try formData if header was not matched
        try {
          const formData = await req.formData();
          const file = formData.get("file") as File | null;
          const typeField = formData.get("type") as string | null;
          if (typeField) uploadType = typeField;
          if (file && typeof file !== "string") {
            const arrayBuf = await file.arrayBuffer();
            fileBuffer = Buffer.from(arrayBuf);
            cleanBase64 = fileBuffer.toString("base64");
            originalFilename = file.name || "student_image.jpg";
            mimeType = file.type || "image/jpeg";
            fileBlob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
            rawDataUrl = `data:${mimeType};base64,${cleanBase64}`;
          }
        } catch {
          console.warn("Could not parse request as JSON or FormData");
        }
      }
    }

    if (!cleanBase64 && !fileBuffer) {
      return NextResponse.json(
        { error: "কোনো ছবি পাওয়া যায়নি (No valid image payload provided)" },
        { status: 400 }
      );
    }

    // Helper functions for providers
    const tryUploadIili = async (): Promise<string | null> => {
      const freeimageKey = process.env.FREEIMAGE_API_KEY || "6d207e02198a847aa98d0a2a901485a5";
      try {
        const freeimageFormData = new URLSearchParams();
        freeimageFormData.append("key", freeimageKey);
        freeimageFormData.append("action", "upload");
        freeimageFormData.append("source", cleanBase64);
        freeimageFormData.append("format", "json");

        const res = await fetch("https://freeimage.host/api/1/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          body: freeimageFormData.toString(),
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok) {
          const text = await res.text();
          const data = JSON.parse(text);
          const uploadedUrl = data?.image?.url || data?.image?.display_url;
          if (uploadedUrl && typeof uploadedUrl === "string") {
            return uploadedUrl;
          }
        }
      } catch (e) {
        console.warn("Freeimage.host / iili.io upload error:", e);
      }
      return null;
    };

    const tryUploadImgbb = async (): Promise<string | null> => {
      const imgbbKey = process.env.IMGBB_API_KEY || "f68764a897def42cdf7b39a839307ef8";
      try {
        const imgbbFormData = new URLSearchParams();
        imgbbFormData.append("key", imgbbKey);
        imgbbFormData.append("image", cleanBase64);

        const res = await fetch("https://api.imgbb.com/1/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          body: imgbbFormData.toString(),
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok) {
          const text = await res.text();
          const data = JSON.parse(text);
          const uploadedUrl = data?.data?.url || data?.data?.display_url;
          if (uploadedUrl && typeof uploadedUrl === "string") {
            return uploadedUrl;
          }
        }
      } catch (e) {
        console.warn("ImgBB upload error:", e);
      }
      return null;
    };

    const tryUploadCatbox = async (): Promise<string | null> => {
      try {
        if (fileBuffer) {
          const catboxFormData = new FormData();
          catboxFormData.append("reqtype", "fileupload");
          const blobToUpload = fileBlob || new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
          catboxFormData.append("fileToUpload", blobToUpload, originalFilename || "image.jpg");

          const catboxRes = await fetch("https://catbox.moe/user/api.php", {
            method: "POST",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            },
            body: catboxFormData,
            signal: AbortSignal.timeout(9000),
          });

          if (catboxRes.ok) {
            const text = (await catboxRes.text()).trim();
            if (text.startsWith("http://") || text.startsWith("https://")) {
              return text;
            }
          }
        }
      } catch (e) {
        console.warn("Catbox upload error:", e);
      }
      return null;
    };

    // 1. PRIORITY 1: User requested iili.io / ImgBB for student images
    if (preferredProvider === "imgbb") {
      const imgbbUrl = await tryUploadImgbb();
      if (imgbbUrl) {
        return NextResponse.json({
          success: true,
          provider: "ImgBB",
          url: imgbbUrl,
        });
      }
      const iiliUrl = await tryUploadIili();
      if (iiliUrl) {
        return NextResponse.json({
          success: true,
          provider: "iili.io",
          url: iiliUrl,
        });
      }
    } else {
      // Default: Try iili.io first, then ImgBB
      const iiliUrl = await tryUploadIili();
      if (iiliUrl) {
        return NextResponse.json({
          success: true,
          provider: "iili.io",
          url: iiliUrl,
        });
      }

      const imgbbUrl = await tryUploadImgbb();
      if (imgbbUrl) {
        return NextResponse.json({
          success: true,
          provider: "ImgBB",
          url: imgbbUrl,
        });
      }
    }

    // 2. PRIORITY 2: Catbox.moe fallback
    const catboxUrl = await tryUploadCatbox();
    if (catboxUrl) {
      return NextResponse.json({
        success: true,
        provider: "Catbox",
        url: catboxUrl,
      });
    }

    // 3. PRIORITY 3: Supabase Storage fallback (only if external hosts fail)
    try {
      const adminClient = await createAdminClient();
      const bucketName = uploadType === "logo" ? "logos" : (uploadType === "signature" ? "signatures" : "assignments");

      try {
        await adminClient.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"]
        });
      } catch {}

      if (fileBuffer) {
        const fileExt = originalFilename.split(".").pop() || (mimeType === "image/png" ? "png" : "jpg");
        const uniqueFileName = `${uploadType}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

        const { data: uploadData, error: uploadErr } = await adminClient.storage
          .from(bucketName)
          .upload(uniqueFileName, fileBuffer, {
            contentType: mimeType,
            upsert: true,
          });

        if (!uploadErr && uploadData?.path) {
          const { data: { publicUrl } } = adminClient.storage
            .from(bucketName)
            .getPublicUrl(uploadData.path);

          if (publicUrl) {
            return NextResponse.json({
              success: true,
              provider: "supabase",
              url: publicUrl,
            });
          }
        }
      }
    } catch (supabaseErr) {
      console.warn("Supabase storage upload attempt error:", supabaseErr);
    }

    // 4. Resilient fallback: Return clean data URL so the user form is never blocked
    const finalDataUrl = rawDataUrl || `data:${mimeType};base64,${cleanBase64}`;
    return NextResponse.json({
      success: true,
      provider: "local-data-url",
      url: finalDataUrl,
    });
  } catch (error: any) {
    console.error("Image upload handler error:", error);
    return NextResponse.json(
      { error: error?.message || "ছবি আপলোড ব্যর্থ হয়েছে।" },
      { status: 500 }
    );
  }
}
