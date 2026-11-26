import { isIP } from "node:net";
import { patchTenantJson } from "./tenant-json-patch";
import {
  generateDeviceToken,
  type BiometricDevice as Device,
} from "./biometric";

export async function storeDevice(tenant: string, input: Partial<Device>) {
  const name = input.name?.trim(),
    sn = input.serial_number?.trim();
  if (!name || !sn) throw Error("ডিভাইসের নাম ও সিরিয়াল আবশ্যক।");
  return patchTenantJson(tenant, (meta) => {
    const devices: Device[] = meta.biometric_devices || [],
      prev = devices.find((d) => d.id === input.id);
    if (input.id && !prev) throw Error("ডিভাইসটি আর নেই।");
    if (devices.some((d) => d.id !== prev?.id && d.serial_number === sn))
      throw Error("এই সিরিয়াল আগে থেকেই আছে।");
    const now = new Date().toISOString(),
      protocol = input.protocol || "cloud_push";
    const port = input.port;
    if (!["cloud_push", "webhook", "lan_tcp", "offline_usb"].includes(protocol))
      throw Error("প্রোটোকল সঠিক নয়।");
    if (
      protocol === "lan_tcp" &&
      input.ip_address &&
      !isIP(input.ip_address.trim())
    )
      throw Error("LAN IP সঠিক নয়।");
    if (
      protocol === "lan_tcp" &&
      port != null &&
      (!Number.isInteger(port) || port < 1 || port > 65535)
    )
      throw Error("পোর্ট 1–65535 হতে হবে।");
    const device: Device = {
      ...prev,
      id: prev?.id || crypto.randomUUID(),
      madrasa_id: tenant,
      name,
      serial_number: sn,
      protocol,
      ip_address: protocol === "lan_tcp" ? input.ip_address?.trim() : undefined,
      port: protocol === "lan_tcp" ? port : undefined,
      location: input.location?.trim(),
      device_model: input.device_model || "ZKTeco_K40",
      target_audience: input.target_audience || "all",
      status: input.status || "active",
      secret_token:
        input.secret_token?.trim() ||
        prev?.secret_token ||
        generateDeviceToken(),
      total_punches_count: prev?.total_punches_count || 0,
      notes: input.notes?.trim(),
      created_at: prev?.created_at || now,
      updated_at: now,
    };
    return {
      patch: {
        biometric_devices: prev
          ? devices.map((d) => (d.id === prev.id ? device : d))
          : [device, ...devices],
      },
      result: device,
    };
  });
}

// Resolve exactly one active device. SN-only matching is limited to the legacy
// ADMS protocol; the JSON webhook always requires its provisioned secret.
export async function findIngressDevice(
  match: { token?: string; sn?: string },
  adms = false,
) {
  if (adms ? !match.sn : !match.token) return null;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const db = await createAdminClient();
  let found: { tenant: string; device: Device } | null = null;
  for (let start = 0; ; start += 100) {
    let q = await db
      .from("madrasas")
      .select("id,registration_no,metadata")
      .order("id")
      .range(start, start + 99);
    if (q.error?.code === "42703")
      q = (await db
        .from("madrasas")
        .select("id,registration_no")
        .order("id")
        .range(start, start + 99)) as typeof q;
    if (q.error) throw Error("ডিভাইস রেজিস্ট্রি পড়া যায়নি।");
    for (const row of q.data || []) {
      const raw = row.registration_no,
        legacy = raw?.trimStart().startsWith("{") ? JSON.parse(raw) : {};
      for (const d of (legacy.biometric_devices ??
        row.metadata?.biometric_devices ??
        []) as Device[]) {
        if (
          d.status !== "active" ||
          !["cloud_push", "webhook"].includes(d.protocol) ||
          (adms && d.protocol !== "cloud_push")
        )
          continue;
        if (
          (!match.token || d.secret_token === match.token) &&
          (!match.sn || d.serial_number === match.sn)
        ) {
          if (found) return null;
          found = { tenant: row.id, device: d };
        }
      }
    }
    if ((q.data?.length || 0) < 100) return found;
  }
}
