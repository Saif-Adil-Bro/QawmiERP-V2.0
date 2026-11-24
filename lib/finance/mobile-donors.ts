import type { MobileAuthContext } from "@/lib/mobile-api";
import {
  canViewUnmaskedField,
  maskDonorSensitiveFields,
} from "@/lib/pii-masking";
export function mobileDonor(row: Record<string, any>, ctx: MobileAuthContext) {
  return maskDonorSensitiveFields(
    row,
    canViewUnmaskedField(ctx.permCtx?.summary, "zakat", "phone"),
  );
}

// Older walk-in receipts put a phone number in a free-text [Donor: ...]
// tag. A masked directory is of little use if the raw note is still returned.
export function mobileDonation(
  row: Record<string, any>,
  ctx: MobileAuthContext,
) {
  const { donors, notes, ...receipt } = row;
  return {
    ...receipt,
    donors:
      donors?.madrasa_id === ctx.madrasaId
        ? { id: donors.id, name: donors.name }
        : null,
    ...(canViewUnmaskedField(ctx.permCtx?.summary, "zakat", "phone")
      ? { notes }
      : {}),
  };
}
