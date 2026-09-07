export const FREEIMAGE_API_KEY =
  process.env.NEXT_PUBLIC_FREEIMAGE_API_KEY ||
  process.env.FREEIMAGE_API_KEY ||
  "6d207e02198a847aa98d0a2a901485a5";

export const IMGBB_API_KEY =
  process.env.NEXT_PUBLIC_IMGBB_API_KEY ||
  process.env.IMGBB_API_KEY ||
  "f68764a897def42cdf7b39a839307ef8";

export interface UploadResult {
  success: boolean;
  url?: string;
  provider?: string;
  error?: string;
}

/**
 * Compresses an image file client-side using an offscreen HTML canvas.
 * Reduces 10MB+ phone camera snaps to ~150KB while retaining high clarity for student photos.
 */
async function compressImageFile(
  file: File,
  maxDimension = 1200,
  quality = 0.82
): Promise<{ file: File; dataUrl: string; base64Clean: string }> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/") || file.type.includes("svg")) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = (reader.result as string) || "";
        const base64Clean = dataUrl.replace(/^data:image\/[a-z0-9+.-]+;base64,/, "");
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
          const base64Clean = dataUrl.replace(/^data:image\/[a-z0-9+.-]+;base64,/, "");
          resolve({ file, dataUrl, base64Clean });
        };
        reader.readAsDataURL(file);
        return;
      }

      // Fill clean background
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
      const compressedDataUrl = canvas.toDataURL(mimeType, quality);
      const base64Clean = compressedDataUrl.replace(/^data:image\/[a-z0-9+.-]+;base64,/, "");

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
        const base64Clean = dataUrl.replace(/^data:image\/[a-z0-9+.-]+;base64,/, "");
        resolve({ file, dataUrl, base64Clean });
      };
      reader.readAsDataURL(file);
    };

    img.src = blobUrl;
  });
}

/**
 * Upload directly from client to iili.io (Freeimage.host)
 */
async function uploadDirectIili(base64Clean: string): Promise<UploadResult | null> {
  try {
    const formData = new FormData();
    formData.append("key", FREEIMAGE_API_KEY);
    formData.append("action", "upload");
    formData.append("source", base64Clean);
    formData.append("format", "json");

    const res = await fetch("https://freeimage.host/api/1/upload", {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(12000),
    });

    if (res.ok) {
      const text = await res.text();
      const data = JSON.parse(text);
      const url = data?.image?.url || data?.image?.display_url;
      if (url && typeof url === "string") {
        return {
          success: true,
          url,
          provider: "iili.io",
        };
      }
    }
  } catch (err) {
    console.warn("Direct iili.io upload failed:", err);
  }
  return null;
}

/**
 * Upload directly from client to ImgBB (api.imgbb.com)
 */
async function uploadDirectImgbb(base64Clean: string): Promise<UploadResult | null> {
  try {
    const formData = new FormData();
    formData.append("image", base64Clean);

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(12000),
    });

    if (res.ok) {
      const text = await res.text();
      const data = JSON.parse(text);
      const url = data?.data?.url || data?.data?.display_url;
      if (url && typeof url === "string") {
        return {
          success: true,
          url,
          provider: "ImgBB",
        };
      }
    }
  } catch (err) {
    console.warn("Direct ImgBB upload failed:", err);
  }
  return null;
}

/**
 * Uploads an image file to iili.io / ImgBB.
 * Automatically compresses the image for fast upload.
 * Tries direct client-side upload first (bypasses datacenter blocks),
 * then falls back to server-side `/api/upload-image` proxy.
 */
export async function uploadImageAuto(
  file: File,
  type: "logo" | "signature" | "general" = "general",
  preferredProvider: "auto" | "iili.io" | "imgbb" = "auto"
): Promise<UploadResult> {
  if (!file) {
    return { success: false, error: "কোনো ফাইল পাওয়া যায়নি।" };
  }

  // 1. Fast client-side image compression
  const { file: compressedFile, dataUrl, base64Clean } = await compressImageFile(file);

  // 2. Try direct client-side uploads based on user preference
  if (base64Clean) {
    if (preferredProvider === "imgbb") {
      const imgbbRes = await uploadDirectImgbb(base64Clean);
      if (imgbbRes) return imgbbRes;

      const iiliRes = await uploadDirectIili(base64Clean);
      if (iiliRes) return iiliRes;
    } else {
      // Default: iili.io first, then ImgBB
      const iiliRes = await uploadDirectIili(base64Clean);
      if (iiliRes) return iiliRes;

      const imgbbRes = await uploadDirectImgbb(base64Clean);
      if (imgbbRes) return imgbbRes;
    }
  }

  // 3. Fallback: Try server-side API route (/api/upload-image)
  try {
    const formData = new FormData();
    formData.append("file", compressedFile);
    formData.append("imageBase64", dataUrl);
    formData.append("type", type);
    formData.append("provider", preferredProvider);
    formData.append("filename", compressedFile.name || file.name || "student_image.jpg");

    const res = await fetch("/api/upload-image", {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(18000),
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
        provider: data.provider || "iili.io",
      };
    } else if (data?.url) {
      return {
        success: true,
        url: data.url,
        provider: data.provider || "iili.io",
      };
    }
  } catch (serverErr: any) {
    console.warn("Server proxy upload error:", serverErr);
  }

  // 4. Safe fallback: Return clean data URL so the student registration/edit form is NEVER blocked
  if (dataUrl && dataUrl.startsWith("data:image/")) {
    return {
      success: true,
      url: dataUrl,
      provider: "local",
    };
  }

  return {
    success: false,
    error: "ছবি ক্লাউডে আপলোড করা যায়নি। ইন্টারনেট কানেকশন চেক করুন অথবা সরাসরি ছবির লিংক পেস্ট করুন।",
  };
}
