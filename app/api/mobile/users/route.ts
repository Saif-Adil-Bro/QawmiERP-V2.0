import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "users",
  module: "users",
  select: "id, madrasa_id, role, full_name, phone, email, created_at",
  searchColumns: ["full_name", "email", "phone", "role"],
  filterColumns: ["role"],
  defaultSort: "created_at",
  requiredFields: ["email", "full_name", "role"],
});

export { GET, POST };
