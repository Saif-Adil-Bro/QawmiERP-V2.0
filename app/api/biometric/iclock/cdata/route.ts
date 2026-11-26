import { NextRequest, NextResponse } from "next/server";
import { findIngressDevice } from "@/lib/biometric-registry";
import { patchTenantJson } from "@/lib/tenant-json-patch";
import { ingestPunches } from "@/lib/biometric-ingest";
import { parsePunchReport, type BiometricDevice } from "@/lib/biometric";

export async function GET(req: NextRequest) {
  const sn = req.nextUrl.searchParams.get("SN") || "";
  const found = await findIngressDevice({ sn }, true);
  if (!found) return new NextResponse("Unknown device", { status: 403 });
  await patchTenantJson(found.tenant, (meta) => ({
    patch: {
      biometric_devices: (meta.biometric_devices || []).map(
        (d: BiometricDevice) =>
          d.id === found.device.id && d.serial_number === sn
            ? { ...d, last_ping_at: new Date().toISOString() }
            : d,
      ),
    },
    result: null,
  }));
  // Handshake response expected by ZKTeco firmware
  const responseBody = [
    `GET OPTION FROM: ${sn}`,
    `Stamp=9999`,
    `OpStamp=9999`,
    `PhotoStamp=9999`,
    `ErrorDelay=60`,
    `Delay=30`,
    `TransTimes=00:00;14:05`,
    `TransInterval=1`,
    `TransFlag=1111000000`,
    `TimeZone=6`,
    `Realtime=1`,
    `Encrypt=0`,
    `ServerVersion=3.4.1`,
  ].join("\n");

  return new NextResponse(responseBody, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(req: NextRequest) {
  const sn = req.nextUrl.searchParams.get("SN") || "";
  try {
    const found = await findIngressDevice({ sn }, true);
    if (!found) return new NextResponse("Unknown device", { status: 403 });
    if (
      req.nextUrl.searchParams.get("table") &&
      req.nextUrl.searchParams.get("table") !== "ATTLOG"
    )
      return new NextResponse("OK: 0");
    const { records, rejected } = parsePunchReport(await req.text());
    if (!records.length && rejected.length)
      return new NextResponse("Invalid punch lines", { status: 422 });
    const r = await ingestPunches(
      found.tenant,
      found.device.id,
      records,
      "cloud_push",
      "all",
      { sn },
    );
    return new NextResponse(
      r.failed ? "Attendance write incomplete" : `OK: ${records.length}`,
      {
        status: r.failed ? 503 : 200,
        headers: { "X-Rejected-Lines": String(rejected.length) },
      },
    );
  } catch {
    return new NextResponse("Device write unavailable", { status: 503 });
  }
}
