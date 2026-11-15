import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";

export const maxDuration = 60; // Allow sufficient time for vision OCR

export async function POST(req: NextRequest) {
  try {
    // ⛔ আগে এই রুটটি লগইন ছাড়াই কলযোগ্য ছিল — যে কেউ সার্ভারের GEMINI_API_KEY
    // ব্যবহার করে কোটা শেষ করে দিতে পারত। এখন শুধু লগইন করা ব্যবহারকারী।
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: "অননুমোদিত অ্যাক্সেস।" }, { status: 401 });
    }

    const body = await req.json();
    const { imageBase64, mimeType = "image/jpeg", madrasaName } = body;

    if (!imageBase64) {
      return NextResponse.json(
        { error: "কোনো ছবি পাওয়া যায়নি। অনুগ্রহ করে একটি প্রশ্নের ছবি আপলোড করুন।" },
        { status: 400 }
      );
    }

    // Read OpenRouter API key securely from server environment variable
    const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "OpenRouter AI কনফিগারেশন অনুপস্থিত (OPENROUTER_API_KEY পাওয়া যায়নি)।",
          isMissingApiKey: true,
          details: "সার্ভার এনভায়রনমেন্টে OPENROUTER_API_KEY কনফিগার করা হয়নি। অনুগ্রহ করে .env.local বা Railway ড্যাশবোর্ডের Variables ট্যাবে OPENROUTER_API_KEY যোগ করুন।"
        },
        { status: 500 }
      );
    }

    // Clean base64 data string
    const resolvedMimeType = mimeType || "image/jpeg";
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z0-9+.-]+;base64,/, "").trim();

    const promptText = `You are an expert Qawmi Madrasa Examination Paper Digitizer, Arabic Calligraphy Specialist, and high-precision Optical Character Recognition (OCR) Engine.

TASK: Carefully read the entire uploaded question paper image (printed or handwritten) and transcribe EVERY visible word, question, sub-question, mark, header, and table verbatim into the exact JSON schema below.

STRICT ACCURACY RULES:
1. Verbatim Transcription: Do NOT summarize, skip, paraphrase, or invent any question or text. Extract every line in exact reading order.
2. Bengali & Urdu Script: Preserve exact Bengali spelling, punctuation, and Bengali numerals (০-৯), as well as Urdu words if present.
3. Arabic & Quranic/Hadith Text: Preserve full Tashkeel / Harakat (َ ِ ُ ْ ّ ً ٍ ٌ ٰ) and exact Uthmani/Arabic spelling. If a question has an Arabic verse/hadith/phrase alongside Bengali instructions, put the Arabic part in "arabicText" (or keep inline if short) and do NOT duplicate it unnecessarily. If there is no Arabic text, set "arabicText": null.
4. Sub-questions: Extract all subdivisions (ক, খ, গ, ঘ, ১, ২, ৩, أ, ب, ج, etc.) in "subQuestions" with their exact labels, text, and marks.
5. Tables / Matching Columns: If there is a table or matching column (e.g., ক-স্তম্ভ ও খ-স্তম্ভ), reconstruct all headers and rows faithfully in "table". If a question has NO table, set "table": null.
6. Header Metadata: Extract Madrasa name, Exam name (সাময়িক/বার্ষিক/নেহায়ী), Subject (বিষয়), Class/Jamat (জামাত), Time (সময়), Full Marks (পূর্ণমান). If not visible in the image, use "${madrasaName || "কওমি মাদরাসা"}" for madrasaName and "" for missing fields.
7. Marks: Extract exact marks for each question and sub-question (e.g. "১০", "৫", "২").

Return ONLY a valid JSON object matching this exact schema (no markdown, no explanation):
{
  "header": {
    "madrasaName": "string",
    "examName": "string",
    "subject": "string",
    "className": "string",
    "time": "string",
    "totalMarks": "string",
    "bismillahText": "بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ"
  },
  "generalInstructions": "string",
  "questions": [
    {
      "id": "1",
      "questionNo": "১",
      "marks": "১০",
      "questionText": "string",
      "arabicText": "string or null",
      "subQuestions": [
        {
          "label": "ক",
          "text": "string",
          "marks": "২"
        }
      ],
      "table": null
    }
  ],
  "rawSummary": "string"
}`;

    const endpoint = "https://openrouter.ai/api/v1/chat/completions";

    const headers = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "QawmiERP Question Scanner",
    };

    const candidateModels = [
      "google/gemma-4-26b-a4b-it:free",
      "google/gemma-4-31b-it:free",
      "nvidia/nemotron-3.5-super-vl:free",
      "openrouter/free",
    ];

    const extractTextFromResponse = (responseJson: any): string | undefined => {
      const msg = responseJson?.choices?.[0]?.message;
      const rawContent = msg?.content;
      let text = Array.isArray(rawContent)
        ? rawContent.map((part: any) => (typeof part?.text === "string" ? part.text : "")).join("")
        : typeof rawContent === "string"
          ? rawContent
          : "";

      if (!text.trim() && typeof msg?.reasoning === "string" && msg.reasoning.includes("{")) {
        text = msg.reasoning;
      }
      return text.trim() || undefined;
    };

    const parseJsonFromText = (responseText: string) => {
      const cleaned = responseText
        .replace(/^```(?:json|html)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .replace(/```(?:json|html)?/gi, "")
        .replace(/```/g, "")
        .trim();

      try {
        return JSON.parse(cleaned);
      } catch {
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
        }
        throw new Error("Invalid JSON");
      }
    };

    let lastStatus = 502;
    let lastErrorDetail = "";

    for (const modelId of candidateModels) {
      try {
        const apiResponse = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: modelId,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: promptText },
                  {
                    type: "image_url",
                    image_url: { url: `data:${resolvedMimeType};base64,${cleanBase64}` },
                  },
                ],
              },
            ],
            temperature: 0.05,
            max_tokens: 8192,
          }),
        });

        if (!apiResponse.ok) {
          lastStatus = apiResponse.status;
          lastErrorDetail = await apiResponse.text().catch(() => "");
          console.warn(
            `AI Question Scanner model ${modelId} failed with HTTP ${apiResponse.status}:`,
            lastErrorDetail.slice(0, 300)
          );
          if (apiResponse.status === 401 || apiResponse.status === 403) {
            return NextResponse.json(
              {
                error: `OpenRouter API Key সঠিক নয় বা অনুমতি নেই (HTTP ${apiResponse.status})।`,
                details: lastErrorDetail.slice(0, 500),
              },
              { status: apiResponse.status }
            );
          }
          continue;
        }

        const responseJson = await apiResponse.json();
        if (responseJson?.error) {
          lastErrorDetail = JSON.stringify(responseJson.error);
          console.warn(`AI Question Scanner model ${modelId} returned error object:`, lastErrorDetail.slice(0, 300));
          continue;
        }

        const responseText = extractTextFromResponse(responseJson);
        if (!responseText) {
          lastErrorDetail = JSON.stringify(responseJson).slice(0, 300);
          console.warn(`AI Question Scanner model ${modelId} returned empty content:`, lastErrorDetail);
          continue;
        }

        try {
          const parsedData = parseJsonFromText(responseText);
          return NextResponse.json({
            success: true,
            data: parsedData,
          });
        } catch {
          console.warn(`AI Question Scanner model ${modelId} returned non-JSON output:`, responseText.slice(0, 300));
          lastErrorDetail = "মডেল সঠিক JSON ফরম্যাটে উত্তর দেয়নি।";
          continue;
        }
      } catch (fetchErr: any) {
        lastErrorDetail = fetchErr?.message || "Network error";
        console.warn(`AI Question Scanner model ${modelId} threw error:`, lastErrorDetail);
      }
    }

    return NextResponse.json(
      {
        error: "এআই থেকে কোনো উত্তর পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন অথবা নিচের PaddleOCR ইঞ্জিন ব্যবহার করুন।",
        details: lastErrorDetail.slice(0, 500),
      },
      { status: lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502 }
    );
  } catch (error: any) {
    console.error("AI Question Scanner error:", error);
    return NextResponse.json(
      {
        error: error?.message || "ছবি প্রসেস করার সময় ত্রুটি ঘটেছে। অনুগ্রহ করে ছবির স্বচ্ছতা নিশ্চিত করে পুনরায় চেষ্টা করুন।",
      },
      { status: 500 }
    );
  }
}
