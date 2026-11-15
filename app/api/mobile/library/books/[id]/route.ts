import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  table: "books",
  module: "library",
  detailSelect: "*, book_issues(*, students(id, full_name, roll_number))",
});

export { GET, PATCH, PUT, DELETE };
