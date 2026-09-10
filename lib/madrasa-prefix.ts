/**
 * Converts Bengali digits (০-৯) to English ASCII digits (0-9).
 */
export function banglaToEnglishDigits(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return "";
  const bnToEn: Record<string, string> = {
    "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
    "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
  };
  return String(str).replace(/[০-৯]/g, (d) => bnToEn[d] || d);
}

/**
 * Common Bengali to English phonetic mapping for first letters of madrasa name tokens.
 */
const BN_LETTER_MAP: Record<string, string> = {
  "আ": "A", "অ": "A", "ই": "I", "ঈ": "I", "উ": "U", "ঊ": "U", "এ": "E", "ঐ": "O", "ও": "O", "ঔ": "O",
  "ক": "K", "খ": "K", "গ": "G", "ঘ": "G", "ঙ": "N",
  "চ": "C", "ছ": "C", "জ": "J", "ঝ": "J", "ঞ": "N",
  "ট": "T", "ঠ": "T", "ড": "D", "ঢ": "D", "ণ": "N",
  "ত": "T", "থ": "T", "দ": "D", "ধ": "D", "ন": "N",
  "প": "P", "ফ": "F", "ব": "B", "ভ": "B", "ম": "M",
  "য": "J", "র": "R", "ল": "L", "শ": "S", "ষ": "S", "স": "S", "হ": "H",
  "ড়": "R", "ঢ়": "R", "য়": "Y",
};

/**
 * Common special madrasa name keywords to English abbreviations
 */
const KEYWORD_MAP: Record<string, string> = {
  "আলহাজ্ব": "AH",
  "আলহাজ": "AH",
  "আবুল": "AB",
  "হোসেন": "H",
  "হাফিজিয়া": "H",
  "হাফেজিয়া": "H",
  "মাদ্রাসা": "M",
  "মাদরাসা": "M",
  "মাদ্‌রাসাতুল": "M",
  "মাদ্‌রাসা": "M",
  "মুসলিমীন": "SM",
  "মুসলিমিন": "SM",
  "দারুল": "D",
  "উলুম": "U",
  "দেওবন্দ": "D",
  "জামিয়া": "J",
  "ইসলামিয়া": "IS",
  "কাতিয়ারচর": "K",
  "কাদরিয়া": "K",
  "কাওমি": "Q",
  "কওমি": "Q",
  "নূরানী": "N",
  "নুরানী": "N",
  "ফোরকানিয়া": "F",
  "মহিলা": "M",
  "বালিকা": "B",
};

/**
 * Generates an intelligent 3-letter uppercase English prefix from a Madrasa name.
 * e.g.,
 * "আলহাজ্ব আবুল হোসেন হাফিজিয়া মাদ্রাসা" -> "AHH"
 * "মাদ্‌রাসাতুল মুসলিমীন" -> "MSM"
 * "কাতিয়ারচর দারুল উলুম" -> "KDU"
 * "Jamia Islamia" -> "JIS"
 */
export function generateSuggestedPrefix(
  madrasaName: string,
  existingPrefixes: string[] = []
): string {
  if (!madrasaName || !madrasaName.trim()) {
    return findUniquePrefix("QWM", existingPrefixes);
  }

  const name = madrasaName.trim();
  const existingSet = new Set(existingPrefixes.map((p) => p.toUpperCase().trim()));

  // 1. Check if the name has English words
  const englishMatches = name.match(/[a-zA-Z]+/g);
  let basePrefix = "";

  if (englishMatches && englishMatches.length > 0) {
    if (englishMatches.length === 1) {
      basePrefix = englishMatches[0].slice(0, 3).toUpperCase();
    } else if (englishMatches.length === 2) {
      basePrefix = (englishMatches[0].slice(0, 2) + englishMatches[1].slice(0, 1)).toUpperCase();
    } else {
      basePrefix = englishMatches.slice(0, 3).map((w) => w[0].toUpperCase()).join("");
    }
  } else {
    // 2. Bengali name parsing
    // Split into clean words
    const words = name
      .replace(/[^\u0980-\u09FFa-zA-Z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0);

    const candidates: string[] = [];

    // Filter out filler words if many words exist
    const significantWords = words.filter(
      (w) => !["মাদ্রাসা", "মাদরাসা", "মাদ্‌রাসা"].includes(w) || words.length <= 2
    );
    const targetWords = significantWords.length >= 2 ? significantWords : words;

    // Check keyword special mapping
    for (const w of targetWords) {
      if (KEYWORD_MAP[w]) {
        candidates.push(KEYWORD_MAP[w]);
      } else {
        // Extract first letter
        const firstChar = w[0];
        if (BN_LETTER_MAP[firstChar]) {
          candidates.push(BN_LETTER_MAP[firstChar]);
        } else {
          candidates.push("M");
        }
      }
    }

    const combined = candidates.join("");
    if (combined.length >= 3) {
      basePrefix = combined.slice(0, 3);
    } else if (combined.length === 2) {
      basePrefix = combined + "M";
    } else if (combined.length === 1) {
      basePrefix = combined + "QM";
    } else {
      basePrefix = "QWM";
    }
  }

  // Ensure 3 letters uppercase
  basePrefix = basePrefix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  while (basePrefix.length < 3) {
    basePrefix += "M";
  }

  return findUniquePrefix(basePrefix, existingPrefixes);
}

/**
 * Finds a unique prefix by testing sequential variations if candidate is already taken.
 */
export function findUniquePrefix(base: string, existingPrefixes: string[]): string {
  const existingSet = new Set(existingPrefixes.map((p) => p.toUpperCase().trim()));
  let candidate = base.toUpperCase().slice(0, 3);
  if (!existingSet.has(candidate)) {
    return candidate;
  }

  // Try digit suffixes e.g., AH1, AH2, ... AH9
  const prefix2 = candidate.slice(0, 2);
  for (let i = 1; i <= 9; i++) {
    const test = `${prefix2}${i}`;
    if (!existingSet.has(test)) {
      return test;
    }
  }

  // Try single letter variations
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (const l of letters) {
    const test = `${prefix2}${l}`;
    if (!existingSet.has(test)) {
      return test;
    }
  }

  // Fallback to random alphanumeric 3 chars
  for (let i = 10; i < 99; i++) {
    const test = `${candidate[0]}${i}`;
    if (!existingSet.has(test)) {
      return test;
    }
  }

  return candidate;
}

/**
 * Formats a student ID code with the madrasa prefix directly without any hyphen.
 * e.g., prefix "AHH" + code "480001" -> "AHH480001"
 */
export function formatStudentIdWithPrefix(
  prefix: string | null | undefined,
  numericCode: string | number | null | undefined
): string {
  const cleanCode = banglaToEnglishDigits(numericCode || "").replace(/\D/g, "") || "480001";
  const cleanPrefix = (prefix || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  
  if (!cleanPrefix) {
    return cleanCode;
  }
  return `${cleanPrefix}${cleanCode}`;
}

/**
 * Parses user input during login or search to identify prefix and numeric code.
 * Handles inputs like:
 * - "AHH480001" -> { prefix: "AHH", numericCode: "480001" }
 * - "ahh480001" -> { prefix: "AHH", numericCode: "480001" }
 * - "AHH৪৮০০০১" -> { prefix: "AHH", numericCode: "480001" }
 * - "AHH-480001" -> { prefix: "AHH", numericCode: "480001" }
 * - "480001"     -> { prefix: null, numericCode: "480001" }
 */
export function parseStudentIdentifier(identifier: string): {
  prefix: string | null;
  numericCode: string;
  originalInput: string;
} {
  const raw = (identifier || "").trim();
  const englishStr = banglaToEnglishDigits(raw);

  // Match Letters Prefix + Number (with or without hyphen or space)
  // e.g., "AHH480001", "AHH-480001", "MSM101", "AHH 480001"
  const match = englishStr.match(/^([A-Za-z]{2,6})[-_\s]?(\d+)$/i) ||
                englishStr.match(/^([A-Za-z0-9]{2,4})[-_\s]+(\d+)$/i);
  if (match) {
    const potentialPrefix = match[1].toUpperCase();
    const numericPart = match[2];
    
    return {
      prefix: potentialPrefix,
      numericCode: numericPart,
      originalInput: raw,
    };
  }

  // Pure digits only
  const digits = englishStr.replace(/\D/g, "");
  return {
    prefix: null,
    numericCode: digits || englishStr,
    originalInput: raw,
  };
}

/**
 * Extracts the prefix of a given madrasa from its metadata or properties.
 */
export function extractMadrasaPrefix(madrasa: any): string {
  if (!madrasa) return "";
  
  // 1. Direct property if exists
  if (madrasa.prefix && typeof madrasa.prefix === "string") {
    return madrasa.prefix.trim().toUpperCase();
  }
  if (madrasa.short_code && typeof madrasa.short_code === "string") {
    return madrasa.short_code.trim().toUpperCase();
  }
  if (madrasa.code && typeof madrasa.code === "string") {
    return madrasa.code.trim().toUpperCase();
  }

  // 2. From metadata in registration_no JSON
  if (madrasa.registration_no && typeof madrasa.registration_no === "string" && madrasa.registration_no.startsWith("{")) {
    try {
      const meta = JSON.parse(madrasa.registration_no);
      if (meta.prefix) return String(meta.prefix).trim().toUpperCase();
      if (meta.short_code) return String(meta.short_code).trim().toUpperCase();
      if (meta.code) return String(meta.code).trim().toUpperCase();
    } catch {
      // Ignore
    }
  }

  if (madrasa.metadata) {
    if (madrasa.metadata.prefix) return String(madrasa.metadata.prefix).trim().toUpperCase();
    if (madrasa.metadata.short_code) return String(madrasa.metadata.short_code).trim().toUpperCase();
    if (madrasa.metadata.code) return String(madrasa.metadata.code).trim().toUpperCase();
  }

  // 3. Fallback derivation from name
  return generateSuggestedPrefix(madrasa.name || "");
}

