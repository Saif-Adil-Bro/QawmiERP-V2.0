export interface SubjectCatalogRow {
  id: string;
  madrasa_id?: string | null;
  name: string;
  code?: string | null;
  description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: any;
}

export function cleanSubjectDisplayText(raw?: string | null): string {
  return String(raw || "")
    .normalize("NFC")
    .replace(/\u09AF\u09BC/g, "\u09DF")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeSubjectKey(raw?: string | null): string {
  const s = cleanSubjectDisplayText(raw).toLowerCase();
  if (!s) return "";

  if (
    s === "english" ||
    s === "basic english" ||
    s === "বেসিক ইংলিশ" ||
    s === "ইংলিশ" ||
    s === "ইংরেজি"
  ) {
    return "english";
  }

  if (
    s === "math" ||
    s === "gonit" ||
    s === "general math" ||
    s === "সাধারণ গণিত" ||
    s === "গণিত"
  ) {
    return "general math";
  }

  if (
    s.includes("practical") ||
    s.includes("প্রাক্টিক") ||
    s.includes("প্রাকটিক") ||
    s.includes("প্র্যাকটিক")
  ) {
    return "practical";
  }

  return s;
}

export function mergeAndDedupeSubjectCatalog(
  rawRows: SubjectCatalogRow[],
  options?: {
    madrasaId?: string | null;
    assignedSubjectIds?: Iterable<string>;
  },
): SubjectCatalogRow[] {
  const madrasaId = options?.madrasaId || null;
  const assignedIds = new Set<string>(options?.assignedSubjectIds || []);

  // 1. Deduplicate identical DB rows by ID while preserving first-seen completeness
  const byId = new Map<string, SubjectCatalogRow>();
  for (const row of rawRows || []) {
    if (!row || !row.id) continue;
    if (!byId.has(row.id)) {
      byId.set(row.id, row);
    }
  }

  // 2. Re-code combined "নাহবেমীর ও কাফিয়া" so it never collides with standalone "নাহবেমীর" (NAH)
  const normalizedRaw = Array.from(byId.values()).map((item) => {
    const cleanName = cleanSubjectDisplayText(item.name);
    const rawCode = item.code ? String(item.code).trim().toUpperCase() : "";
    if (cleanName.includes("নাহবেমীর") && cleanName.includes("কাফিয়া")) {
      return {
        ...item,
        code: !rawCode || rawCode === "NAH" ? "NAH-KAF" : rawCode,
      };
    }
    return item;
  });

  // 3. Prioritize:
  //    (a) Rows actively referenced in class_subjects / routines / teacher_subjects (preserves FK UUID consistency)
  //    (b) Current madrasa's own rows
  //    (c) Canonical names without parenthetical suffixes
  //    (d) Rows with richer metadata (code + description)
  const sorted = [...normalizedRaw].sort((a, b) => {
    const aAssigned = assignedIds.has(a.id) ? 0 : 1;
    const bAssigned = assignedIds.has(b.id) ? 0 : 1;
    if (aAssigned !== bAssigned) return aAssigned - bAssigned;

    const aOwn = madrasaId && a.madrasa_id === madrasaId ? 0 : 1;
    const bOwn = madrasaId && b.madrasa_id === madrasaId ? 0 : 1;
    if (aOwn !== bOwn) return aOwn - bOwn;

    const aHasParen = String(a.name || "").includes("(") ? 1 : 0;
    const bHasParen = String(b.name || "").includes("(") ? 1 : 0;
    if (aHasParen !== bHasParen) return aHasParen - bHasParen;

    const aHasMeta = (a.code ? 1 : 0) + (a.description ? 1 : 0);
    const bHasMeta = (b.code ? 1 : 0) + (b.description ? 1 : 0);
    return bHasMeta - aHasMeta;
  });

  // 4. Deduplicate by normalized subject key & guarantee unique subject codes
  const seenKeys = new Set<string>();
  const usedCodes = new Set<string>();
  const deduped: SubjectCatalogRow[] = [];

  for (const item of sorted) {
    const key = normalizeSubjectKey(item.name);
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);

    let finalCode = item.code ? String(item.code).trim().toUpperCase() : item.code;
    if (finalCode && usedCodes.has(finalCode)) {
      let suffix = 2;
      while (usedCodes.has(`${finalCode}-${suffix}`)) {
        suffix += 1;
      }
      finalCode = `${finalCode}-${suffix}`;
    }
    if (finalCode) usedCodes.add(finalCode);

    deduped.push({
      ...item,
      code: finalCode,
    });
  }

  return deduped.sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "bn"),
  );
}
