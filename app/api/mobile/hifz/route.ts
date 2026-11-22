import { NextRequest } from "next/server";
import { mobileHifz } from "@/lib/hifz/mobile";
export const dynamic = "force-dynamic";
export function GET(req: NextRequest) {
  return mobileHifz(req);
}
export const POST = GET;
