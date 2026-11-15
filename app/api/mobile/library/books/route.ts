import { createMobileTableHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileTableHandlers({
  table: "books",
  module: "library",
  select: "*",
  searchColumns: ["title", "author", "isbn", "category"],
  filterColumns: ["category"],
  defaultSort: "created_at",
  requiredFields: ["title"],
});

export { GET, POST };
