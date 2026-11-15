import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  table: "meal_entries",
  module: "boarding",
  detailSelect: "*, students(id, full_name, roll_number)",
});

export { GET, PATCH, PUT, DELETE };
