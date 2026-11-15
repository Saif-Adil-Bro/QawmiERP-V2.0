import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "donors",
  module: "zakat",
  select: "*",
  searchColumns: ["name", "phone", "email", "address"],
  filterColumns: ["donor_type"],
  defaultSort: "created_at",
  requiredFields: ["name"],
});

export { GET, POST };
