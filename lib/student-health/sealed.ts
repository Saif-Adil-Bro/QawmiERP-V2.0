// Server only. Older installations have tenant-wide settings RLS. Never put readable
// clinical data, student IDs or an unkeyed child index in that shared JSON store.
import {
  createHmac,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import type { HealthCase } from "./model";
export interface SealedCase {
  child: string;
  iv: string;
  tag: string;
  data: string;
}
function key(tenant: string) {
  const secret =
    process.env.STUDENT_HEALTH_STORAGE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;
  if (!secret?.trim()) throw new Error("Missing server storage key");
  return createHmac("sha256", secret.trim())
    .update(`student-health/v1/${tenant}`)
    .digest();
}
export function childTag(tenant: string, studentId: string) {
  return createHmac("sha256", key(tenant)).update(studentId).digest("hex");
}
export function sealCase(row: HealthCase): SealedCase {
  const child = childTag(row.madrasa_id, row.student_id),
    iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(row.madrasa_id), iv);
  cipher.setAAD(Buffer.from(`${row.id}:${child}`));
  const data = Buffer.concat([
    cipher.update(JSON.stringify(row), "utf8"),
    cipher.final(),
  ]).toString("base64");
  return {
    child,
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
    data,
  };
}
export function openCase(
  tenant: string,
  id: string,
  value: SealedCase,
): HealthCase {
  const cipher = createDecipheriv(
    "aes-256-gcm",
    key(tenant),
    Buffer.from(value.iv, "hex"),
  );
  cipher.setAAD(Buffer.from(`${id}:${value.child}`));
  cipher.setAuthTag(Buffer.from(value.tag, "hex"));
  const r: HealthCase = JSON.parse(
    Buffer.concat([
      cipher.update(Buffer.from(value.data, "base64")),
      cipher.final(),
    ]).toString("utf8"),
  );
  if (
    r.id !== id ||
    r.madrasa_id !== tenant ||
    childTag(tenant, r.student_id) !== value.child
  )
    throw new Error("Invalid health record scope");
  return r;
}
