import { NextRequest } from "next/server";
import { mobileHifz } from "@/lib/hifz/mobile";
export const dynamic = "force-dynamic";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return mobileHifz(req, (await params).id);
}
export const PATCH = GET,
  PUT = GET,
  DELETE = GET;
