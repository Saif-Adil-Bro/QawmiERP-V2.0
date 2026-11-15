import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: "অননুমোদিত অ্যাক্সেস।" }, { status: 401 });
    }

    const incomingForm = await req.formData();
    const file = incomingForm.get("file");
    const rawLang = incomingForm.get("lang");
    const lang = typeof rawLang === "string" && ["bn", "ar", "en"].includes(rawLang) ? rawLang : "bn";

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "কোনো ছবি পাওয়া যায়নি। অনুগ্রহ করে একটি প্রশ্নের ছবি আপলোড করুন।" },
        { status: 400 }
      );
    }

    const paddleUrl = (process.env.PADDLE_OCR_URL || "http://127.0.0.1:8000/scan-question").trim();

    const forwardForm = new FormData();
    forwardForm.append("file", file, (file as File).name || "question.jpg");
    forwardForm.append("lang", lang);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    let ocrResponse: Response;
    try {
      ocrResponse = await fetch(paddleUrl, {
        method: "POST",
        body: forwardForm,
        signal: controller.signal,
      });
    } catch (connErr: any) {
      clearTimeout(timeoutId);
      const isTimeout = connErr?.name === "AbortError";
      console.error("PaddleOCR service unreachable:", connErr?.message || connErr);
      return NextResponse.json(
        {
          error: isTimeout
            ? "PaddleOCR সার্ভিস থেকে সাড়া পেতে বেশি সময় লাগছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
            : "লোকাল বা হোস্টেড PaddleOCR সার্ভিসের সাথে সংযোগ স্থাপন করা যায়নি। অনুগ্রহ করে PaddleOCR সার্ভার চালু আছে কি না অথবা PADDLE_OCR_URL সঠিক কি না যাচাই করুন।",
          isServiceUnreachable: true,
        },
        { status: 503 }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text().catch(() => "");
      console.error(`PaddleOCR HTTP ${ocrResponse.status}:`, errorText.slice(0, 400));
      return NextResponse.json(
        {
          error: `PaddleOCR সার্ভিস থেকে ত্রুটি পাওয়া গেছে (HTTP ${ocrResponse.status})।`,
          details: errorText.slice(0, 300),
        },
        { status: ocrResponse.status >= 400 && ocrResponse.status < 600 ? ocrResponse.status : 502 }
      );
    }

    const data = await ocrResponse.json();
    const fullText = typeof data?.full_text === "string" ? data.full_text : "";

    if (!fullText.trim()) {
      return NextResponse.json(
        { error: "ছবি থেকে কোনো লেখা শনাক্ত করা যায়নি। অনুগ্রহ করে আরও স্পষ্ট ছবি দিয়ে চেষ্টা করুন।" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      lang: data?.lang || lang,
      full_text: fullText,
      lines: Array.isArray(data?.lines) ? data.lines : [],
    });
  } catch (err: any) {
    console.error("PaddleOCR proxy error:", err);
    return NextResponse.json(
      { error: err?.message || "PaddleOCR প্রসেসিংয়ে সমস্যা হয়েছে।" },
      { status: 500 }
    );
  }
}
