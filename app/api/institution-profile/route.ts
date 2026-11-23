import { NextResponse } from "next/server";
import { getMadrasaProfileWithLogo } from "@/app/actions/tenant";

export async function GET() {
  try {
    const profile = await getMadrasaProfileWithLogo();
    if (!profile?.madrasa) {
      return NextResponse.json({ madrasa: null, logoUrl: null }, { status: 200 });
    }
    return NextResponse.json({
      madrasa: {
        id: profile.madrasa.id,
        name: profile.madrasa.name || "",
        address: profile.madrasa.address || "",
        phone: profile.madrasa.phone || "",
      },
      logoUrl: profile.logoUrl || null,
    });
  } catch {
    return NextResponse.json({ madrasa: null, logoUrl: null }, { status: 200 });
  }
}
