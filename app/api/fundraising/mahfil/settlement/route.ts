import { NextRequest, NextResponse } from "next/server";
import { settleMahfilFund, deleteMahfilSettlement, getAvailableFundsForMahfil } from "@/app/actions/fundraising";

export async function GET(req: NextRequest) {
  try {
    const funds = await getAvailableFundsForMahfil();
    return NextResponse.json({ success: true, funds });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "ফান্ড ডাটা পেতে সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mahfil_id, ...payload } = body;
    if (!mahfil_id) {
      return NextResponse.json({ error: "মাহফিল আইডি আবশ্যক" }, { status: 400 });
    }
    const result = await settleMahfilFund(mahfil_id, payload);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "সমন্বয় সম্পন্ন করা যায়নি" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mahfilId = searchParams.get("mahfil_id");
    const settlementId = searchParams.get("settlement_id");
    if (!mahfilId || !settlementId) {
      return NextResponse.json({ error: "মাহফিল আইডি ও সমন্বয় আইডি আবশ্যক" }, { status: 400 });
    }
    const result = await deleteMahfilSettlement(mahfilId, settlementId);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "সমন্বয় বাতিল করা যায়নি" }, { status: 500 });
  }
}
