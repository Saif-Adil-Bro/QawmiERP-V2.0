import type { NextRequest } from "next/server";
import { readMobileFunds, validateFundChange } from "@/lib/finance/mobile-catalog";
import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { POST } = createMobileTableHandlers({
  table: "zakat_funds",
  module: "zakat",
  select: "*",
  beforeWrite:validateFundChange,
  searchColumns: ["name", "type", "description"],
  filterColumns: ["type"],
  defaultSort: "created_at",
  requiredFields: ["name","code"],
});

export const GET = (req:NextRequest) => readMobileFunds(req);
export { POST };
