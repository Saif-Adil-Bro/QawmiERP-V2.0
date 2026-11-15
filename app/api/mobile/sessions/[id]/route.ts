import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  table: "academic_sessions",
  module: "sessions",
});

export { GET, PATCH, PUT, DELETE };
