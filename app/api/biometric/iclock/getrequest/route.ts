import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Return OK when machine asks for queued commands
  return new NextResponse("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(req: NextRequest) {
  return new NextResponse("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
