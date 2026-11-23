import type { NextRequest } from "next/server";
import { readMobileFunds, validateFundChange } from "@/lib/finance/mobile-catalog";
import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  table: "zakat_funds",
  module: "zakat",
  beforeWrite:validateFundChange,
});

export const GET = async (req:NextRequest,ctx:{params:Promise<{id:string}>})=>readMobileFunds(req,(await ctx.params).id);
export { PATCH, PUT, DELETE };
