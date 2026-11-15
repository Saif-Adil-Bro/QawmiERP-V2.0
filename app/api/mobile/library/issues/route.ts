import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "book_issues",
  module: "library",
  select: "*, books(id, title, author), students(id, full_name, roll_number)",
  filterColumns: ["book_id", "student_id", "status"],
  defaultSort: "issue_date",
  requiredFields: ["book_id", "student_id"],
});

export { GET, POST };
