const FREEIMAGE_API_KEY = "6d207e02198a847aa98d0a2a901485a5";

export interface UploadResult {
  success: boolean;
  url?: string;
  provider?: string;
  error?: string;
}

/**
 * Uploads an image file to iili.io / Catbox / Cloud storage automatically.
 * Tries client-side direct APIs first (for fastest speed & direct iili.io hosting),
 * then falls back to server-side proxy route `/api/upload-image`.
 */
export async function uploadImageAuto(
  file: File,
  type: "logo" | "signature" | "general" = "general"
): Promise<UploadResult> {
  if (!file) {
    return { success: false, error: "কোনো ফাইল পাওয়া যায়নি।" };
  }

  // 1. Try Client-side direct upload to Freeimage.host (iili.io)
  try {
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string;
        // remove data URL prefix to get raw base64
        const base64Clean = result.replace(/^data:image\/[a-z]+;base64,/, "");
        resolve(base64Clean);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const base64Data = await base64Promise;

    const directFormData = new FormData();
    directFormData.append("key", FREEIMAGE_API_KEY);
    directFormData.append("action", "upload");
    directFormData.append("source", base64Data);
    directFormData.append("format", "json");

    const directRes = await fetch("https://freeimage.host/api/1/upload", {
      method: "POST",
      body: directFormData,
      signal: AbortSignal.timeout(6000),
    });

    if (directRes.ok) {
      const data = await directRes.json();
      if (data?.image?.url || data?.image?.display_url) {
        return {
          success: true,
          url: data.image.url || data.image.display_url,
          provider: "iili.io",
        };
      }
    }
  } catch {
    // Client-side direct upload had CORS/network block, fallback to server route
  }

  // 2. Server API Route fallback (attempts iili.io -> Catbox -> Storage)
  try {
    const serverFormData = new FormData();
    serverFormData.append("file", file);
    serverFormData.append("type", type);

    const res = await fetch("/api/upload-image", {
      method: "POST",
      body: serverFormData,
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.url) {
        return {
          success: true,
          url: data.url,
          provider: data.provider || "cloud",
        };
      }
      return {
        success: false,
        error: data?.error || "আপলোড ব্যর্থ হয়েছে।",
      };
    } else {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errData?.error || "সার্ভার আপলোড ব্যর্থ হয়েছে।",
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "নেটওয়ার্ক সমস্যার কারণে ফাইল আপলোড করা যায়নি।",
    };
  }
}
