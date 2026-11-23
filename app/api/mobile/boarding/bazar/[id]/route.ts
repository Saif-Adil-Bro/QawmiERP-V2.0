import { validateMobilePosting } from "@/lib/finance/mobile-posting";
import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  allowPortalRead:false,
  table: "bazar_expenses",
  beforeWrite: validateMobilePosting("bazar"),
  module: "finance",
});

export { GET, PATCH, PUT, DELETE };
