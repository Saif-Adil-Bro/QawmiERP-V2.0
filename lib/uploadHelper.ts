const FREEIMAGE_API_KEY = "6d207e02198a847aa98d0a2a901485a5";

export interface UploadResult {
  success: boolean;
  url?: string;
  provider?: string;
  error?: string;
}

/**
 * Compresses an image file client-side using an offscreen HTML canvas.
 * Reduces 10MB+ phone camera snaps to ~250KB while retaining high clarity for book pages.
 */
async function compressImageFile(
  file: File,
  maxDimension = 1600,
  quality = 0.82
): Promise<{ file: File; dataUrl: string; base64Clean: string }> {
  return new Promise((resolve) => {
    // If not a standard raster image (e.g. svg or invalid), return data URL directly
    if (!file.type.startsWith("image/") || file.type.includes("svg")) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = (reader.result as string) || "";
        const base64Clean = dataUrl.replace(/^data:image\/[a-z]+;base64,/, "");
        resolve({ file, dataUrl, base64Clean });
      };
      reader.onerror = () => resolve({ file, dataUrl: "", base64Clean: "" });
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const blobUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = (reader.result as string) || "";
          const base64Clean = dataUrl.replace(/^data:image\/[a-z]+;base64,/, "");
          resolve({ file, dataUrl, base64Clean });
        };
        reader.readAsDataURL(file);
        return;
      }

      // Draw white background in case of transparent png
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
      const compressedDataUrl = canvas.toDataURL(mimeType, quality);
      const base64Clean = compressedDataUrl.replace(/^data:image\/[a-z]+;base64,/, "");

      canvas.toBlob(
        (blob) => {
          const ext = mimeType === "image/png" ? ".png" : ".jpg";
          const newName = file.name.replace(/\.[^/.]+$/, "") + ext;
          const compressedFile = blob
            ? new File([blob], newName, { type: mimeType, lastModified: Date.now() })
            : file;

          resolve({
            file: compressedFile,
            dataUrl: compressedDataUrl,
            base64Clean,
          });
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = (reader.result as string) || "";
        const base64Clean = dataUrl.replace(/^data:image\/[a-z]+;base64,/, "");
        resolve({ file, dataUrl, base64Clean });
      };
      reader.readAsDataURL(file);
    };

    img.src = blobUrl;
  });
}

/**
 * Uploads an image file to iili.io / Catbox / Cloud storage automatically.
 * Automatically compresses camera snaps to ~250KB for fast, reliable upload.
 * Tries server-side proxy route `/api/upload-image` with Catbox/iili.io/local fallback.
 */
export async function uploadImageAuto(
  file: File,
  type: "logo" | "signature" | "general" = "general"
): Promise<UploadResult> {
  if (!file) {
    return { success: false, error: "কোনো ফাইল পাওয়া যায়নি।" };
  }

  // Fast client-side image compression
  const { file: compressedFile, dataUrl, base64Clean } = await compressImageFile(file);

  // 1. Try server-side API route (handles iili.io -> Catbox -> ImgBB with fallback)
  try {
    const res = await fetch("/api/upload-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imageBase64: dataUrl,
        filename: compressedFile.name || file.name || "image.jpg",
        type,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const text = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (res.ok && data?.success && data?.url) {
      return {
        success: true,
        url: data.url,
        provider: data.provider || "cloud",
      };
    } else if (data?.url) {
      return {
        success: true,
        url: data.url,
        provider: data.provider || "cloud",
      };
    } else if (data?.error) {
      // If external provider failed, fallback to local dataUrl so user is never blocked
      if (dataUrl && dataUrl.startsWith("data:image/")) {
        return {
          success: true,
          url: dataUrl,
          provider: "local",
        };
      }
      return {
        success: false,
        error: data.error,
      };
    }
  } catch (serverErr: any) {
    console.warn("Server proxy upload error, attempting direct client fallback:", serverErr);
  }

  // 2. Direct client-side Freeimage.host fallback (iili.io)
  if (base64Clean) {
    try {
      const directFormData = new FormData();
      directFormData.append("key", FREEIMAGE_API_KEY);
      directFormData.append("action", "upload");
      directFormData.append("source", base64Clean);
      directFormData.append("format", "json");

      const directRes = await fetch("https://freeimage.host/api/1/upload", {
        method: "POST",
        body: directFormData,
        signal: AbortSignal.timeout(6000),
      });

      if (directRes.ok) {
        const directText = await directRes.text();
        try {
          const directData = JSON.parse(directText);
          const uploadedUrl = directData?.image?.url || directData?.image?.display_url;
          if (uploadedUrl) {
            return {
              success: true,
              url: uploadedUrl,
              provider: "iili.io",
            };
          }
        } catch {}
      }
    } catch {
      // ignore
    }
  }

  // 3. Resilient fallback: return data URL so work is NEVER lost
  if (dataUrl && dataUrl.startsWith("data:image/")) {
    return {
      success: true,
      url: dataUrl,
      provider: "local",
    };
  }

  return {
    success: false,
    error: "ছবি আপলোড করা যায়নি। ইন্টারনেট কানেকশন চেক করুন অথবা লিংক পেস্ট করুন।",
  };
}
