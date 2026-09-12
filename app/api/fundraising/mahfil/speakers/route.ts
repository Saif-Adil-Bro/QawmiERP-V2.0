import { NextRequest, NextResponse } from "next/server";
import { saveMahfilSpeaker, deleteMahfilSpeaker } from "@/app/actions/fundraising";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mahfilId, speaker } = body;
    if (!mahfilId || !speaker) {
      return NextResponse.json({ error: "মাহফিল আইডি এবং বক্তার তথ্য আবশ্যক" }, { status: 400 });
    }
    const result = await saveMahfilSpeaker(mahfilId, speaker);
    if (result && "error" in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error("API error saving mahfil speaker:", err);
    return NextResponse.json({ error: err.message || "বক্তা সংরক্ষণে সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mahfilId = searchParams.get("mahfilId");
    const speakerId = searchParams.get("speakerId");
    if (!mahfilId || !speakerId) {
      return NextResponse.json({ error: "আইডি আবশ্যক" }, { status: 400 });
    }
    const result = await deleteMahfilSpeaker(mahfilId, speakerId);
    if (result && "error" in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("API error deleting mahfil speaker:", err);
    return NextResponse.json({ error: err.message || "বক্তা মুছতে সমস্যা হয়েছে" }, { status: 500 });
  }
}
