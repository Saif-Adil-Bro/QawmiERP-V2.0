import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  table: "users",
  module: "users",
  detailSelect: "id, madrasa_id, role, full_name, phone, email, created_at",
});

export { GET, PATCH, PUT, DELETE };
