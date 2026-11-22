import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getAuthUser, createAdminClient } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { loadServerPermissions } from "@/lib/permissions-server";
import { buildSystemPrompt } from "@/lib/ai/erp-knowledge-base";
import { createErpTools } from "@/lib/ai/erp-tools";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return Response.json(
        { error: "অননুমোদিত প্রবেশ। অনুগ্রহ করে পুনরায় লগইন করুন।" },
        { status: 401 }
      );
    }

    const madrasaId = await getAuthMadrasaId(undefined, user);
    if (!madrasaId) {
      return Response.json(
        { error: "আপনার অ্যাকাউন্টের সাথে কোনো মাদ্রাসা যুক্ত পাওয়া যায়নি।" },
        { status: 403 }
      );
    }

    const permCtx = await loadServerPermissions(user.id, madrasaId);
    if (!permCtx || permCtx.status !== "ACTIVE") {
      return Response.json(
        { error: "আপনার অ্যাকাউন্টটি সক্রিয় নয়।" },
        { status: 403 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      return Response.json(
        {
          error:
            "AI সার্ভিস কনফিগার করা হয়নি। অনুগ্রহ করে .env.local ফাইলে OPENROUTER_API_KEY সেট করুন (OpenRouter থেকে ফ্রি API Key পাওয়া যায়)।",
        },
        { status: 503 }
      );
    }

    const adminClient = await createAdminClient();
    const { data: madrasaRow } = await adminClient
      .from("madrasas")
      .select("name")
      .eq("id", madrasaId)
      .maybeSingle();

    const body = await req.json();
    const messages: UIMessage[] = Array.isArray(body?.messages) ? body.messages : [];

    const baseURL = process.env.AI_BASE_URL?.trim() || "https://openrouter.ai/api/v1";
    const modelName =
      process.env.AI_MODEL_NAME?.trim() || "openrouter/free";

    const openrouter = createOpenAI({
      baseURL,
      apiKey,
      headers: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://qawmierp.com",
        "X-Title": "QawmiERP AI Assistant",
      },
    });

    const systemPrompt = buildSystemPrompt({
      userName: permCtx.profile.fullName || user.email || "ব্যবহারকারী",
      role: permCtx.role,
      madrasaName: (madrasaRow as any)?.name || undefined,
    });

    const tools = createErpTools(permCtx);

    const result = streamText({
      model: openrouter.chat(modelName),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(5),
    });

    return result.toUIMessageStreamResponse({
      onError: (err: any) => {
        console.error("AI stream error:", err?.responseBody || err);
        const detail = err?.responseBody || err?.message;
        return typeof detail === "string" && detail
          ? detail
          : "এআই রেসপন্স তৈরি করতে সমস্যা হয়েছে।";
      },
    });
  } catch (err: any) {
    console.error("AI Chat API error:", err);
    return Response.json(
      { error: err?.message || "এআই সহায়ক থেকে উত্তর আনতে সমস্যা হয়েছে।" },
      { status: 500 }
    );
  }
}
