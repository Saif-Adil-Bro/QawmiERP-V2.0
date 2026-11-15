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

    const promptText = `Extract all text, questions, marks, headers, and Arabic/Bengali/Urdu scripts accurately from this Qawmi Madrasa question paper image (printed or handwritten). Preserve Arabic diacritics (Harakat) and return the output strictly matching the existing schema/format expected by the Question Scanner PDF builder.

You are an expert Qawmi Madrasa Examination Paper Digitizer, Arabic Calligraphy Specialist, and Optical Character Recognition (OCR) Engine.

CRITICAL INSTRUCTIONS:
1. Bengali & Urdu Text: Preserve authentic Bengali and Urdu orthography, punctuation, and terms.
2. Arabic & Quranic Text: If there are Arabic verses, Hadith, or syntax, preserve full Tashkeel/Harakat (diacritics: fatha, kasra, damma, sukun, shaddah) and correct Uthmani spelling.
3. Tables / Matrix / Matching: If the question contains a table, matching column (যেমন: ক-স্তম্ভ ও খ-স্তম্ভ মিলকরণ), fill-in-the-blank grid, or vocabulary matrix, reconstruct it faithfully as a structured table with "headers" and "rows".
4. Sub-questions: If questions have subdivisions (ক, খ, গ, ঘ, ১, ২, etc.), extract them cleanly with their specific marks.
5. Header Metadata: Extract Madrasa name, Exam name (সাময়িক/বার্ষিক/নেহায়ী), Subject (বিষয়), Class/Jamat (জামাত), Time (সময়), Full Marks (পূর্ণমান). If the image doesn't show a madrasa name, use "${madrasaName || "কওমি মাদরাসা"}".
6. Question Marks: Extract numerical marks for each question and sub-question (in Bengali numbers like ১০, ৫, ২).

You must return ONLY a valid JSON object matching the following schema without any markdown formatting or surrounding text:

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
  "generalInstructions": "string (যেমন: 'যেকোনো ৫টি প্রশ্নের উত্তর দাও। ডানপাশের সংখ্যা পূর্ণমান জ্ঞাপক')",
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
      "table": {
        "title": "string or null",
        "headers": ["ক-স্তম্ভ", "খ-স্তম্ভ"],
        "rows": [
          ["বাক্যাংশ ১", "বাক্যাংশ ২"]
        ]
      }
    }
  ],
  "rawSummary": "string describing what subject/exam this paper is about"
}`;

    const endpoint = "https://openrouter.ai/api/v1/chat/completions";

    const buildRequestBody = (useAutoFreeRouter = false) => ({
      model: useAutoFreeRouter ? "openrouter/free" : "google/gemma-4-31b-it:free",
      ...(useAutoFreeRouter
        ? {}
        : {
            models: [
              "google/gemma-4-31b-it:free",
              "google/gemma-4-26b-a4b-it:free",
              "nvidia/nemotron-3.5-super-vl:free",
            ],
          }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: promptText,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${resolvedMimeType};base64,${cleanBase64}`,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
    });

    const headers = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "QawmiERP Question Scanner",
    };

    let apiResponse = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(buildRequestBody(false)),
    });

    if (apiResponse.status === 404) {
      console.warn("Primary OpenRouter vision models returned 404, retrying with openrouter/free...");
      apiResponse = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(buildRequestBody(true)),
      });
    }

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text().catch(() => "");
      console.error(
        `AI Question Scanner HTTP ${apiResponse.status} error from OpenRouter:`,
        errorText
      );
      return NextResponse.json(
        {
          error: `OpenRouter API থেকে ত্রুটি পাওয়া গেছে (HTTP ${apiResponse.status})। অনুগ্রহ করে OPENROUTER_API_KEY ও ছবির ফরম্যাট যাচাই করুন।`,
          details: errorText.slice(0, 500),
        },
        { status: apiResponse.status >= 400 && apiResponse.status < 600 ? apiResponse.status : 502 }
      );
    }

    const responseJson = await apiResponse.json();
    const rawContent = responseJson?.choices?.[0]?.message?.content;
    const responseText: string | undefined = Array.isArray(rawContent)
      ? rawContent.map((part: any) => (typeof part?.text === "string" ? part.text : "")).join("")
      : typeof rawContent === "string"
        ? rawContent
        : undefined;

    if (!responseText) {
      console.error("AI Question Scanner empty response payload:", JSON.stringify(responseJson).slice(0, 500));
      return NextResponse.json(
        { error: "এআই থেকে কোনো উত্তর পাওয়া যায়নি।" },
        { status: 502 }
      );
    }

    // Clean any markdown code block wrappers (```json, ```html, ```)
    const cleaned = responseText
      .replace(/^```(?:json|html)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .replace(/```(?:json|html)?/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsedData = JSON.parse(cleaned);
    return NextResponse.json({
      success: true,
      data: parsedData,
    });
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
