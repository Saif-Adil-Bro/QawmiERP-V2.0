import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
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

    // Prefer server-configured environment variable, fallback to client-supplied key if hosting lacks env vars
    const customKeyFromHeader = req.headers.get("x-gemini-api-key");
    const apiKey = (process.env.GEMINI_API_KEY || customKeyFromHeader || body.customApiKey || "").trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "জেমিনি এআই কনফিগারেশন অনুপস্থিত (GEMINI_API_KEY পাওয়া যায়নি)।",
          isMissingApiKey: true,
          details: "সার্ভার এনভায়রনমেন্টে GEMINI_API_KEY কনফিগার করা হয়নি। Railway ড্যাশবোর্ডের Variables ট্যাবে GEMINI_API_KEY যোগ করুন অথবা স্ক্যানার পেজে সরাসরি আপনার ফ্রি গুগল এআই কি প্রদান করুন।"
        },
        { status: 500 }
      );
    }


    // Clean base64 data string
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z0-9+.-]+;base64,/, "").trim();

    const ai = new GoogleGenAI({ apiKey });

    const promptText = `
You are an expert Qawmi Madrasa Examination Paper Digitizer, Arabic Calligraphy Specialist, and Optical Character Recognition (OCR) Engine.
Your task is to analyze the provided image of a handwritten or printed examination question paper and convert it into a completely structured, high-fidelity JSON object.

CRITICAL INSTRUCTIONS:
1. Bengali Text: Preserve authentic Bengali orthography, punctuation, and terms.
2. Arabic & Quranic Text: If there are Arabic verses, Hadith, or syntax, preserve full Tashkeel/Harakat (diacritics: fatha, kasra, damma, sukun, shaddah) and correct Uthmani spelling.
3. Tables / Matrix / Matching: If the question contains a table, matching column (যেমন: ক-স্তম্ভ ও খ-স্তম্ভ মিলকরণ), fill-in-the-blank grid, or vocabulary matrix, reconstruct it faithfully as a structured table with "headers" and "rows".
4. Sub-questions: If questions have subdivisions (ক, খ, গ, ঘ, ১, ২, etc.), extract them cleanly with their specific marks.
5. Header Metadata: Extract Madrasa name, Exam name (সাময়িক/বার্ষিক/নেহায়ী), Subject (বিষয়), Class/Jamat (জামাত), Time (সময়), Full Marks (পূর্ণমান). If the image doesn't show a madrasa name, use "${madrasaName || 'কওমি মাদরাসা'}".
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
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || "image/jpeg",
              data: cleanBase64,
            },
          },
          {
            text: promptText,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text;
    if (!responseText) {
      return NextResponse.json(
        { error: "এআই থেকে কোনো উত্তর পাওয়া যায়নি।" },
        { status: 502 }
      );
    }

    try {
      const parsedData = JSON.parse(responseText);
      return NextResponse.json({
        success: true,
        data: parsedData,
      });
    } catch {
      // If response has markdown backticks despite instruction
      const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsedData = JSON.parse(cleaned);
      return NextResponse.json({
        success: true,
        data: parsedData,
      });
    }
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
