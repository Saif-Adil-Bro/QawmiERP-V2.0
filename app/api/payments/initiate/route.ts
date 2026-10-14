import { NextRequest, NextResponse } from "next/server";
import { initiateOnlinePayment } from "@/app/actions/payment-gateway";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";

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
