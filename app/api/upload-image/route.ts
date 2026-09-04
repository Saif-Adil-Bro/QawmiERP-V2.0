import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, filename } = await req.json();

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Strip prefix if present for clean base64 data
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");

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
        const data = await res.json();
        const uploadedUrl = data?.image?.url || data?.image?.display_url;
        if (uploadedUrl) {
          return NextResponse.json({
            success: true,
            provider: "freeimage.host (iili.io)",
            url: uploadedUrl,
          });
        }
      }
    } catch (e) {
      console.warn("Freeimage.host upload attempt error:", e);
    }

    // 2. Try ImgBB if key exists or fallback
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
          const data = await res.json();
          const uploadedUrl = data?.data?.url || data?.data?.display_url;
          if (uploadedUrl) {
            return NextResponse.json({
              success: true,
              provider: "imgbb.com",
              url: uploadedUrl,
            });
          }
        }
      } catch (e) {
        console.warn("ImgBB upload attempt error:", e);
      }
    }

    // 3. Resilient fallback: Return clean data URL so the user form submission is never blocked
    return NextResponse.json({
      success: true,
      provider: "local-data-url",
      url: imageBase64,
    });
  } catch (error: any) {
    console.error("Image upload handler error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to upload image" },
      { status: 500 }
    );
  }
}
