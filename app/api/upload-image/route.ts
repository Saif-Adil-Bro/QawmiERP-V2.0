import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    let cleanBase64 = "";
    let originalFilename = "image.jpg";
    let fileBlob: Blob | null = null;
    let fileBuffer: Buffer | null = null;
    let mimeType = "image/jpeg";
    let rawDataUrl = "";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const base64Field = (formData.get("imageBase64") || formData.get("image")) as string | null;

        if (file && typeof file !== "string") {
          const arrayBuf = await file.arrayBuffer();
          fileBuffer = Buffer.from(arrayBuf);
          cleanBase64 = fileBuffer.toString("base64");
          originalFilename = file.name || "image.jpg";
          mimeType = file.type || "image/jpeg";
          fileBlob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
          rawDataUrl = `data:${mimeType};base64,${cleanBase64}`;
        } else if (base64Field) {
          rawDataUrl = base64Field;
          cleanBase64 = base64Field.replace(/^data:image\/[a-z]+;base64,/, "");
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
        if (base64Input) {
          rawDataUrl = base64Input;
          cleanBase64 = base64Input.replace(/^data:image\/[a-z]+;base64,/, "");
          fileBuffer = Buffer.from(cleanBase64, "base64");
          const mimeMatch = base64Input.match(/^data:(image\/[a-z]+);base64,/);
          mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
          fileBlob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
        }
        if (body.filename) originalFilename = body.filename;
      } catch (jsonErr) {
        // Fallback: try formData if header was not matched
        try {
          const formData = await req.formData();
          const file = formData.get("file") as File | null;
          if (file && typeof file !== "string") {
            const arrayBuf = await file.arrayBuffer();
            fileBuffer = Buffer.from(arrayBuf);
            cleanBase64 = fileBuffer.toString("base64");
            originalFilename = file.name || "image.jpg";
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

    // 1. Try Freeimage.host (hosts directly on iili.io)
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
        },
        body: freeimageFormData.toString(),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          const uploadedUrl = data?.image?.url || data?.image?.display_url;
          if (uploadedUrl) {
            return NextResponse.json({
              success: true,
              provider: "freeimage.host (iili.io)",
              url: uploadedUrl,
            });
          }
        } catch (parseErr) {
          console.warn("Freeimage.host returned non-JSON:", parseErr);
        }
      }
    } catch (e) {
      console.warn("Freeimage.host upload attempt error:", e);
    }

    // 2. Try Catbox.moe (fast, rock-solid, permanent image hosting)
    try {
      if (fileBuffer) {
        const catboxFormData = new FormData();
        catboxFormData.append("reqtype", "fileupload");
        const blobToUpload = fileBlob || new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
        catboxFormData.append("fileToUpload", blobToUpload, originalFilename || "upload.jpg");

        const catboxRes = await fetch("https://catbox.moe/user/api.php", {
          method: "POST",
          body: catboxFormData,
          signal: AbortSignal.timeout(9000),
        });

        if (catboxRes.ok) {
          const text = (await catboxRes.text()).trim();
          if (text.startsWith("http://") || text.startsWith("https://")) {
            return NextResponse.json({
              success: true,
              provider: "catbox.moe",
              url: text,
            });
          }
        }
      }
    } catch (e) {
      console.warn("Catbox.moe upload attempt error:", e);
    }

    // 3. Try ImgBB if key exists
    if (process.env.IMGBB_API_KEY) {
      try {
        const imgbbFormData = new URLSearchParams();
        imgbbFormData.append("key", process.env.IMGBB_API_KEY);
        imgbbFormData.append("image", cleanBase64);

        const res = await fetch("https://api.imgbb.com/1/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: imgbbFormData.toString(),
          signal: AbortSignal.timeout(8000),
        });

        if (res.ok) {
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            const uploadedUrl = data?.data?.url || data?.data?.display_url;
            if (uploadedUrl) {
              return NextResponse.json({
                success: true,
                provider: "imgbb.com",
                url: uploadedUrl,
              });
            }
          } catch {}
        }
      } catch (e) {
        console.warn("ImgBB upload attempt error:", e);
      }
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
