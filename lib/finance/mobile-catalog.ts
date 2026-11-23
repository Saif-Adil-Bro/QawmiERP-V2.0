import type { NextRequest } from "next/server";
import {
  authenticateMobileRequest,
  mobileError,
  mobileSuccess,
  parsePagination,
  type MobileWriteCheck,
} from "@/lib/mobile-api";
import { fundCatalog } from "./funds";

export async function readMobileFunds(req: NextRequest, id?: string) {
  const auth = await authenticateMobileRequest(req, {
    module: "zakat",
    requireWrite: false,
    allowPortalRoles: false,
  });
  if (!auth.ok) return auth.response;
  try {
    const catalog = await fundCatalog(auth.ctx.madrasaId, true);
    const { from, to, page, limit, search, searchParams } =
      parsePagination(req);
    const category = searchParams.get("category") || searchParams.get("type");
    // The registry's current_balance is only a historical cache, not a ledger total.
    const choices = catalog.map(
      ({
        id,
        name,
        code,
        category,
        is_active,
        description,
        target_amount,
      }) => ({
        id,
        name,
        code,
        category,
        is_active: is_active !== false,
        description,
        target_amount,
      }),
    );
    if (id) {
      const fund = choices.find((f) => f.id === id);
      return fund
        ? mobileSuccess(fund, "Success", undefined, 200, req)
        : mobileError("Fund not found", 404, "NOT_FOUND");
    }
    const list = choices.filter(
      (f) =>
        f.is_active &&
        (!category || category === f.category) &&
        `${f.name} ${f.code}`.toLowerCase().includes(search.toLowerCase()),
    );
    return mobileSuccess(
      list.slice(from, to + 1),
      "Success",
      {
        total: list.length,
        page,
        limit,
        totalPages: Math.ceil(list.length / limit),
      },
      200,
      req,
    );
  } catch (e: any) {
    return mobileError(e.message, 400, "FUND_CATALOG_ERROR");
  }
}
export const validateFundChange: MobileWriteCheck = async ({
  id,
  tenant,
  payload,
  operation,
}) => {
  if (operation === "delete")
    return mobileError(
      "Archive the fund with is_active=false; keep its posting history",
      409,
      "ARCHIVE_FUND",
    );
  if ("current_balance" in payload)
    return mobileError(
      "Post a voucher instead of editing a balance",
      400,
      "INVALID_BALANCE",
    );
  if (id && (await fundCatalog(tenant)).find((f) => f.id === id)?.is_default)
    return mobileError("Cannot edit a built-in fund", 409, "BUILT_IN_FUND");
};
