import type { MobileWriteCheck, TableCrudConfig } from "@/lib/mobile-api";
import { mobileError, mobileSuccess, parsePagination } from "@/lib/mobile-api";
import { requirePermission } from "@/lib/permissions-server";
import { getFeeMetadata } from "@/lib/fee-store";
import { billingSession } from "./billing-session";
import { postingFund } from "./funds";

// Keep indexed PostgREST reads on relational schools. Only JSON-only books need
// the compatibility projection; do not mix an old JSON snapshot into SQL results.
export const legacyFeeRead: NonNullable<
  TableCrudConfig["beforeRead"]
> = async ({ req, db, tenant, id, config }) => {
  const key = config.table === "fee_payments" ? "payments" : config.table;
  const { data, error } = await db.rpc("finance_json_fee_rows", {
    t: tenant,
    k: key,
  });
  if (error) return mobileError(error.message, 503, "FEE_STORE_UNAVAILABLE");
  if (data == null) return; // Includes relational-mode schools with an empty result.
  const rows: any[] = data.map((r: any) => ({
    ...r,
    ...(key === "payments"
      ? { fee_payment_allocations: r.allocations || [] }
      : key === "fee_structures"
        ? { fee_structure_items: r.items || [] }
        : {}),
  }));
  if (id) {
    const matches = rows.filter((r) => r.id === id);
    return matches.length === 1
      ? mobileSuccess(matches[0], "Success", undefined, 200, req)
      : mobileError("Record not found", 404, "NOT_FOUND");
  }
  const { page, limit, from, to, search, sortBy, ascending, searchParams } =
    parsePagination(req);
  const sort = sortBy || config.defaultSort || "created_at";
  const list = rows
    .filter(
      (r) =>
        (!search ||
          !config.searchColumns?.length ||
          config.searchColumns.some((c) =>
            String(r[c] ?? "")
              .toLowerCase()
              .includes(search.toLowerCase()),
          )) &&
        (config.filterColumns ?? []).every(
          (c) => !searchParams.get(c) || String(r[c]) === searchParams.get(c),
        ),
    )
    .sort(
      (a, b) =>
        (ascending ? 1 : -1) *
        (String(a[sort] ?? "").localeCompare(String(b[sort] ?? "")) ||
          String(a.id).localeCompare(String(b.id))),
    );
  return mobileSuccess(
    list.slice(from, to + 1),
    "Success",
    {
      page,
      limit,
      total: list.length,
      totalPages: Math.max(1, Math.ceil(list.length / limit)),
    },
    200,
    req,
  );
};

export function mobileSchedule(
  key: "fee_types" | "fee_structures",
): MobileWriteCheck {
  return async ({ tenant, actor, id, payload, db, operation }) => {
    try {
      const structure = key === "fee_structures",
        deleting = operation === "delete";
      const guard = await requirePermission({
        userId: actor,
        madrasaId: tenant,
        permissions: ["fee.edit"],
        roles: ["super_admin", "admin", "muhtamim", "accountant"],
        ...(structure
          ? {
              riskLevel: "CRITICAL" as const,
              requireStepUp: true,
              actionScope: `fee_structure.${deleting ? "delete" : "edit"}`,
            }
          : {}),
      });
      if (!guard.allowed)
        return mobileError(
          guard.error || "Permission denied",
          403,
          guard.errorCode || "PERMISSION_DENIED",
        );
      const book = await getFeeMetadata(tenant),
        base = book[key] || [],
        before = id ? base.find((r) => r.id === id) : null,
        rid = id || crypto.randomUUID();
      if (id && !before) return mobileError("Not found", 404, "NOT_FOUND");
      let after: any = null;
      if (!deleting) {
        const allowed = structure
          ? [
              "session_id",
              "class_id",
              "class_name",
              "student_category",
              "name",
              "items",
            ]
          : [
              "name",
              "code",
              "category",
              "frequency",
              "default_amount",
              "is_active",
              "fund_id",
              "fund_name",
            ];
        if (
          Object.keys(payload).some(
            (k) => k !== "madrasa_id" && !allowed.includes(k),
          )
        )
          throw Error("Unexpected schedule field");
        after = {
          ...(structure
            ? { student_category: "ALL" }
            : { category: "OTHER", frequency: "MONTHLY", default_amount: 0 }),
          ...before,
          ...payload,
          id: rid,
          madrasa_id: tenant,
        };
        if (structure) {
          after.session_id = await billingSession(
            db,
            tenant,
            after.session_id,
            true,
          );
          if (
            !Array.isArray(after.items) ||
            !after.items.length ||
            !after.class_id ||
            !after.class_name ||
            !after.session_id
          )
            throw Error(
              "A class, session and configured fee items are required",
            );
          for (const monthly of [true, false])
            after[monthly ? "total_monthly_amount" : "total_onetime_amount"] =
              after.items
                .filter((i: any) => (i.frequency === "MONTHLY") === monthly)
                .reduce(
                  (c: number, i: any) => c + Math.round(Number(i.amount) * 100),
                  0,
                ) / 100;
        } else {
          if (!after.code) throw Error("Fee type code is required");
          const f = await postingFund(
            tenant,
            after.fund_id,
            "deposit",
            "",
            "",
            after.fund_name,
          );
          after.fund_name = f.name;
        }
      }
      const { error } = await db.rpc("finance_fee_config", {
        p_tenant: tenant,
        p_key: key,
        p_changes: [{ id: rid, before: before ?? null, after }],
        p_base: base,
      });
      return error
        ? mobileError(error.message, 409, "SCHEDULE_CONFLICT")
        : mobileSuccess(
            after || { id, archived: !structure, deleted: structure },
            "Saved",
            undefined,
            id ? 200 : 201,
          );
    } catch (e: any) {
      return mobileError(e.message, 400, "INVALID_SCHEDULE");
    }
  };
}
