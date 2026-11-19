import { NextResponse } from "next/server";
import { buildSampleWidgetZipBuffer } from "@/lib/widgets/zip-parser";

export async function GET() {
  const bytes = await buildSampleWidgetZipBuffer();
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="qawmi-sample-widget.zip"',
      "Cache-Control": "no-store",
    },
  });
}
