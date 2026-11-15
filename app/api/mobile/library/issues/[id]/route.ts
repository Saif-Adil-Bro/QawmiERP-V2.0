import { createMobileTableItemHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, PATCH, PUT, DELETE } = createMobileTableItemHandlers({
  table: "book_issues",
  module: "library",
  detailSelect: "*, books(id, title, author), students(id, full_name, roll_number)",
});

export { GET, PATCH, PUT, DELETE };
