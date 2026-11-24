import { financeRoles } from "./access";
import { writeGuard } from "@/lib/action-authorization";
import { createAdminClient } from "@/lib/supabase/admin";
// Internal only. No server action accepts a school or operator ID as authority.
export async function treasuryAccess(write: boolean | "manage" = false) {
  const gate = await writeGuard(write === true ? "finance" : "financeRead");
  if (!gate.allowed || !gate.madrasaId || !gate.userId)
    throw Error("এই হিসাব দেখার বা পরিবর্তনের অনুমতি নেই।");
  if (
    write === "manage" &&
    !gate.roles?.some((r) => financeRoles.includes(r)) &&
    !gate.permissions?.some((p) =>
      ["finance.manage", "finance.edit"].includes(p),
    )
  )
    throw Error("ফান্ড ও খাত পরিচালনার অনুমতি নেই।");
  return {
    tenant: gate.madrasaId,
    actor: gate.userId,
    gate,
    db: await createAdminClient(),
  };
}
