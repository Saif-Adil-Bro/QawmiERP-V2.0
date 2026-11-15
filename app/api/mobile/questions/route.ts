import { createMobileMetadataHandlers } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

const { GET, POST } = createMobileMetadataHandlers({
  storeKey: "questions_bank",
  module: "questions",
  idPrefix: "que",
  searchFields: ["question_text", "chapter", "type"],
  requiredFields: ["question_text"],
});

export { GET, POST };
