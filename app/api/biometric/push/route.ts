import { NextRequest, NextResponse } from "next/server";
import { findIngressDevice } from "@/lib/biometric-registry";
import { ingestPunches } from "@/lib/biometric-ingest";
import { parsePunch, type ParsedPunchRecord } from "@/lib/biometric";

export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => null);
    if (!b)
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const token =
      req.headers
        .get("authorization")
        ?.replace(/^Bearer\s+/i, "")
        .trim() || String(b.token || "").trim();
    if (!token)
      return NextResponse.json(
        { error: "Device token required" },
        { status: 401 },
      );
    const credential = {
        token,
        sn: b.device_sn ? String(b.device_sn) : undefined,
      },
      found = await findIngressDevice(credential);
    if (!found)
      return NextResponse.json(
        { error: "Unconfigured device" },
        { status: 403 },
      );
    const input = Array.isArray(b.punches) ? b.punches : [b];
    const records: ParsedPunchRecord[] = [],
      rejected: number[] = [];
    input.forEach((p: any, i: number) => {
      const r = parsePunch(
        String(p?.user_id ?? p?.userId ?? ""),
        String(p?.timestamp || ""),
      );
      if (r)
        records.push({
          ...r,
          punch_type: p.punch_type === "check_out" ? "check_out" : "check_in",
        });
      else rejected.push(i + 1);
    });
    if (!records.length)
      return NextResponse.json(
        { error: "No valid numeric PIN/timestamp", rejected },
        { status: 422 },
      );
    const r = await ingestPunches(
      found.tenant,
      found.device.id,
      records,
      "cloud_push",
      "all",
      credential,
    );
    return NextResponse.json(
      { success: !r.failed, processed: r.totalProcessed, ...r, rejected },
      { status: r.failed ? 503 : 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "Could not persist device events" },
      { status: 503 },
    );
  }
}
