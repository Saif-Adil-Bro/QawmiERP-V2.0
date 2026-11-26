import { NextRequest } from "next/server";
import {
  authenticateMobileRequest,
  mobileError,
  mobileSuccess,
  parsePagination,
} from "@/lib/mobile-api";
import { getMadrasaMetadata } from "@/lib/sessions";
import { storeDevice } from "@/lib/biometric-registry";
import { logAuditEvent } from "@/lib/audit-log";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const a = await authenticateMobileRequest(req, {
    module: "biometric",
    requireWrite: false,
    allowPortalRoles: false,
  });
  if (!a.ok) return a.response;
  const meta = await getMadrasaMetadata(a.ctx.madrasaId, true),
    { page, limit, search } = parsePagination(req);
  const items = (meta.biometric_devices || []).filter((d: any) =>
    [d.name, d.device_name, d.serial_number, d.location].some((s) =>
      String(s || "")
        .toLowerCase()
        .includes(search.toLowerCase()),
    ),
  );
  return mobileSuccess(
    items
      .slice((page - 1) * limit, page * limit)
      .map(({ secret_token, ...d }: any) => ({
        ...d,
        device_name: d.name || d.device_name,
      })),
    "Success",
    {
      page,
      limit,
      total: items.length,
      totalPages: Math.max(1, Math.ceil(items.length / limit)),
    },
  );
}
export async function POST(req: NextRequest) {
  const a = await authenticateMobileRequest(req, {
    module: "biometric",
    requireWrite: true,
  });
  if (!a.ok) return a.response;
  try {
    const b = await req.json(),
      d = await storeDevice(a.ctx.madrasaId, {
        ...b,
        id: undefined,
        name: b.device_name || b.name,
        serial_number: b.serial_number || crypto.randomUUID(),
      });
    const audit = await logAuditEvent({
      madrasaId: a.ctx.madrasaId,
      actorId: a.ctx.userId,
      module: "biometric",
      action: "BIOMETRIC_DEVICE_ADDED",
      entityType: "biometric_device",
      entityId: d.id,
      summary: `ডিভাইস নিবন্ধন: ${d.name}`,
    });
    return mobileSuccess(
      { ...d, device_name: d.name },
      audit.success ? "Created" : "Created; audit needs review",
      undefined,
      201,
    );
  } catch {
    return mobileError("ডিভাইস নিবন্ধন করা যায়নি।", 400, "INVALID_DEVICE");
  }
}
