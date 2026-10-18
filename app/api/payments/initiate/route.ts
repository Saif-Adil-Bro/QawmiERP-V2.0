import { NextRequest, NextResponse } from "next/server";
import { initiateOnlinePayment } from "@/app/actions/payment-gateway";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";

// ⛔ P2-Fix: per-IP in-memory rate-limit state (best-effort anti-spam;
// server restart-এ counter reset — বৈধ পেমেন্ট প্রভাবিত হয় না)
const ipRateLimit = new Map<string, number[]>();

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const authUser = await getAuthUser(supabase);

    const body = await req.json();
    const {
      student_id,
      amount,
      payment_channel,
      payer_phone,
      notes,
      selected_fee_ids,
    } = body;

    if (!student_id || !amount || Number(amount) <= 0) {
      return NextResponse.json(
        { error: "বৈধ শিক্ষার্থী আইডি এবং টাকার পরিমাণ প্রয়োজন।" },
        { status: 400 }
      );
    }

    // ⛔ P2-Fix (spam protection):
    // ১) amount cap — একক অনলাইন পেমেন্টে ১০ লক্ষ টাকার বেশি বৈধ নয়
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum > 1000000) {
      return NextResponse.json(
        { error: "টাকার পরিমাণ বৈধ নয়।" },
        { status: 400 }
      );
    }

    // ২) payer_phone দেওয়া থাকলে বৈধ BD মোবাইল হতে হবে (01XXXXXXXXX)।
    // নম্বর ছাড়াও চলবে — গেটওয়ে তখন শিক্ষার্থীর প্রোফাইলের guardian phone ব্যবহার করে
    // (initiateOnlinePayment-এ fallback আছে); invalid নম্বর গেটওয়ে পর্যন্ত পৌঁছাবে না
    if (payer_phone !== undefined && payer_phone !== null && String(payer_phone).trim() !== "") {
      const phone = String(payer_phone).replace(/[\s-]/g, "");
      if (!/^01[3-9]\d{8}$/.test(phone)) {
        return NextResponse.json(
          { error: "মোবাইল নম্বরটি বৈধ নয় — ১১ ডিজিটের বাংলাদেশি নম্বর (01XXXXXXXXX) দিন।" },
          { status: 400 }
        );
      }
    }

    // ৩) per-IP rate limit — ১০ মিনিটে সর্বোচ্চ ১০টি initiate।
    // (আগে anonymous caller টানা টানা pending transaction বানিয়ে metadata ভরে দিতে পারত)
    {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "unknown";
      const nowMs = Date.now();
      const WINDOW_MS = 10 * 60 * 1000;
      const MAX_REQ = 10;
      const recent = (ipRateLimit.get(ip) || []).filter((t) => nowMs - t < WINDOW_MS);
      if (recent.length >= MAX_REQ) {
        return NextResponse.json(
          { error: "অনেক বেশি চেষ্টা করা হয়েছে — কিছুক্ষণ পরে আবার চেষ্টা করুন।" },
          { status: 429 }
        );
      }
      recent.push(nowMs);
      if (ipRateLimit.size > 1000) {
        for (const [k, v] of ipRateLimit) {
          const fresh = v.filter((t) => nowMs - t < WINDOW_MS);
          if (fresh.length === 0) ipRateLimit.delete(k);
          else ipRateLimit.set(k, fresh);
        }
      }
      ipRateLimit.set(ip, recent);
    }

    // Verify student exists in the database
    const adminClient = await createAdminClient();
    const { data: student, error: stdErr } = await adminClient
      .from("students")
      .select("id, madrasa_id, first_name, last_name")
      .eq("id", student_id)
      .single();

    if (stdErr || !student) {
      return NextResponse.json(
        { error: "শিক্ষার্থীর রেকর্ড খুঁজে পাওয়া যায়নি।" },
        { status: 404 }
      );
    }

    // If an authenticated user is logged in, check role-based permissions
    if (authUser) {
      const { data: userRow } = await adminClient
        .from("users")
        .select("role, madrasa_id")
        .eq("id", authUser.id)
        .maybeSingle();

      if (userRow && userRow.madrasa_id && userRow.madrasa_id !== student.madrasa_id) {
        return NextResponse.json(
          { error: "অননুমোদিত: আপনি অন্য মাদরাসার শিক্ষার্থীর জন্য পেমেন্ট শুরু করতে পারবেন না।" },
          { status: 403 }
        );
      }
    }

    const result = await initiateOnlinePayment({
      student_id,
      amount: Number(amount),
      payment_channel: payment_channel || "bKash",
      payer_phone,
      notes,
      selected_fee_ids,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Payment initiate API error:", error);
    return NextResponse.json(
      { error: error.message || "পেমেন্ট শুরু করতে ব্যর্থ হয়েছে।" },
      { status: 500 }
    );
  }
}
