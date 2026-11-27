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
 * Generates an intelligent 2 or 3-letter uppercase English prefix from a Madrasa name.
 * e.g.,
 * "আলহাজ্ব আবুল হোসেন" -> "AH" / "AHH"
 * "দারুল উলুম" -> "DU"
 * "মাদ্‌রাসাতুল মুসলিমীন" -> "MSM" / "MM"
 * "কাতিয়ারচর মাদ্রাসা" -> "KM"
 * "Jamia Islamia" -> "JI" / "JIS"
 */
export function generateSuggestedPrefix(
  madrasaName: string,
  existingPrefixes: string[] = []
): string {
  if (!madrasaName || !madrasaName.trim()) {
    return findUniquePrefix("QM", existingPrefixes);
  }

  const name = madrasaName.trim();
  const existingSet = new Set(existingPrefixes.map((p) => p.toUpperCase().trim()));

  // 1. Check if the name has English words
  const englishMatches = name.match(/[a-zA-Z]+/g);
  let basePrefix = "";

  if (englishMatches && englishMatches.length > 0) {
    if (englishMatches.length === 1) {
      basePrefix = englishMatches[0].slice(0, englishMatches[0].length >= 3 ? 3 : 2).toUpperCase();
    } else if (englishMatches.length === 2) {
      basePrefix = (englishMatches[0][0] + englishMatches[1][0]).toUpperCase();
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
      basePrefix = combined;
    } else if (combined.length === 1) {
      basePrefix = combined + "M";
    } else {
      basePrefix = "QM";
    }
  }

  // Ensure 2 or 3 uppercase letters
  basePrefix = basePrefix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  if (basePrefix.length < 2) {
    basePrefix = (basePrefix + "M").slice(0, 2);
  }

  return findUniquePrefix(basePrefix, existingPrefixes);
}

/**
 * Finds a unique prefix by testing sequential variations if candidate is already taken.
 */
export function findUniquePrefix(base: string, existingPrefixes: string[]): string {
  const existingSet = new Set(existingPrefixes.map((p) => p.toUpperCase().trim()));
  let candidate = base.toUpperCase().slice(0, 3);
  if (candidate.length < 2) {
    candidate = (candidate + "M").slice(0, 2);
  }
  if (!existingSet.has(candidate)) {
    return candidate;
  }

  // If candidate is 2 letters (e.g. "AH"), first try appending 3rd letter from English alphabet
  if (candidate.length === 2) {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (const l of letters) {
      const test = `${candidate}${l}`;
      if (!existingSet.has(test)) {
        return test;
      }
    }
  }

  // Try digit suffixes on 2-letter base e.g., AH1, AH2, ... AH9
  const prefix2 = candidate.slice(0, 2);
  for (let i = 1; i <= 9; i++) {
    const test = `${prefix2}${i}`;
    if (!existingSet.has(test)) {
      return test;
    }
  }

  // Try single letter variations for 3-letter candidate
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
 * Formats a student ID code with the madrasa prefix and a hyphen (-).
 * e.g., prefix "AH" + code "480001" -> "AH-480001"
 * e.g., prefix "AHH" + code "480001" -> "AHH-480001"
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
  return `${cleanPrefix}-${cleanCode}`;
}

/**
 * Normalizes a student ID so it carries AT MOST ONE prefix — always the student's
 * own madrasah prefix + numeric code (e.g. "AHM-480025").
 * Strips any existing single or chained prefixes (e.g. "MUSE-480025", "AHM-MUSE-480025",
 * "MUSE480025") before prepending `prefix`. Never double-prepends.
 */
export function normalizeStudentIdWithPrefix(
  rawId: string | number | null | undefined,
  prefix: string | null | undefined
): string {
  const cleanPrefix = (prefix || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const raw = banglaToEnglishDigits(rawId ?? "").trim().toUpperCase();
  if (!raw) return "";

  // Case 1: One or more hyphen/underscore/space-separated prefixes followed by digits
  // e.g. "AHM-MUSE-480025", "MUSE-480025", "QM_480001"
  const chainedDigitsMatch = raw.match(/^(?:[A-Z][A-Z0-9]{0,7}[-_\s]+)+(\d+)$/);
  if (chainedDigitsMatch) {
    const numericPart = chainedDigitsMatch[1];
    return cleanPrefix ? `${cleanPrefix}-${numericPart}` : numericPart;
  }

  // Case 2: Concatenated letters prefix + 4+ digits without hyphen (e.g. "MUSE480025", "AHM480001")
  const compactMatch = raw.match(/^([A-Z]{2,6})(\d{4,})$/);
  if (compactMatch) {
    const numericPart = compactMatch[2];
    return cleanPrefix ? `${cleanPrefix}-${numericPart}` : `${compactMatch[1]}-${numericPart}`;
  }

  // Case 3: Pure digits (e.g. "480025")
  if (/^\d+$/.test(raw)) {
    return cleanPrefix ? `${cleanPrefix}-${raw}` : raw;
  }

  // Case 4: Already starts with the target prefix
  if (cleanPrefix) {
    if (raw.startsWith(`${cleanPrefix}-`)) return raw;
    if (raw.startsWith(cleanPrefix)) {
      const remainder = raw.slice(cleanPrefix.length).replace(/^[-_\s]+/, "");
      return remainder ? `${cleanPrefix}-${remainder}` : raw;
    }
    // If it starts with some other hyphenated prefix(es), replace the prefix rather than stacking
    const otherPrefixed = raw.match(/^(?:[A-Z][A-Z0-9]{0,7}-)+([A-Z0-9]+)$/);
    if (otherPrefixed) {
      return `${cleanPrefix}-${otherPrefixed[1]}`;
    }
    return `${cleanPrefix}-${raw.replace(/^[-_\s]+/, "")}`;
  }

  return raw;
}

/**
 * Parses user input during login or search to identify prefix and numeric code.
 * Handles inputs like:
 * - "AH-480001"  -> { prefix: "AH", numericCode: "480001" }
 * - "AHH-480001" -> { prefix: "AHH", numericCode: "480001" }
 * - "AH480001"   -> { prefix: "AH", numericCode: "480001" }
 * - "AHH480001"  -> { prefix: "AHH", numericCode: "480001" }
 * - "AH-৪৮০০০১"  -> { prefix: "AH", numericCode: "480001" }
 * - "480001"     -> { prefix: null, numericCode: "480001" }
 * - "AHM-MUSE-480025" -> { prefix: "AHM", numericCode: "480025" }
 */
export function parseStudentIdentifier(identifier: string): {
  prefix: string | null;
  numericCode: string;
  originalInput: string;
} {
  const raw = (identifier || "").trim();
  const englishStr = banglaToEnglishDigits(raw);

  // Handle accidentally double-prefixed input (e.g. "AHM-MUSE-480025") -> first prefix + digits
  const chainedMatch = englishStr.match(/^([A-Za-z][A-Za-z0-9]{1,5})(?:[-_\s]+[A-Za-z][A-Za-z0-9]{1,5})+[-_\s]+(\d+)$/i);
  if (chainedMatch) {
    return {
      prefix: chainedMatch[1].toUpperCase(),
      numericCode: chainedMatch[2],
      originalInput: raw,
    };
  }

  // Match Letters Prefix (2 to 6 letters) + Number (with or without hyphen or space)
  // e.g., "AH-480001", "AHH-480001", "AH480001", "AHH480001", "MSM101", "AH 480001"
  const match = englishStr.match(/^([A-Za-z]{2,6})[-_\s]?(\d+)$/i) ||
                englishStr.match(/^([A-Za-z0-9]{2,6})[-_\s]+(\d+)$/i);
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

function pickSavedPrefix(obj: any): string {
  if (!obj || typeof obj !== "object") return "";
  const candidates = [
    obj.id_prefix,
    obj.prefix,
    obj.short_code,
    obj.code,
    obj.madrasa_info?.id_prefix,
    obj.madrasa_info?.prefix,
    obj.madrasa_info?.short_code,
  ];
  for (const val of candidates) {
    if (typeof val === "string" && val.trim()) {
      const clean = val.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (clean) return clean;
    }
  }
  return "";
}

/**
 * Extracts ONLY an explicitly saved prefix from a madrasa object or metadata
 * (without deriving from name or falling back to "QM").
 */
export function extractSavedMadrasaPrefix(madrasa: any): string {
  if (!madrasa || typeof madrasa !== "object") return "";

  const direct = pickSavedPrefix(madrasa);
  if (direct) return direct;

  if (madrasa.registration_no && typeof madrasa.registration_no === "string" && madrasa.registration_no.trim().startsWith("{")) {
    try {
      const meta = JSON.parse(madrasa.registration_no);
      const fromReg = pickSavedPrefix(meta);
      if (fromReg) return fromReg;
    } catch {
      // Ignore malformed JSON
    }
  }

  if (madrasa.metadata && typeof madrasa.metadata === "object") {
    const fromMeta = pickSavedPrefix(madrasa.metadata);
    if (fromMeta) return fromMeta;
  }

  return "";
}

/**
 * Resolves a madrasa's prefix in strict priority order:
 * 1. Saved prefix (id_prefix / prefix / short_code / madrasa_info.prefix / registration_no / metadata)
 * 2. Derived from that madrasa's own name
 * 3. Neutral generic default ("QM")
 * Never returns another tenant's hardcoded prefix.
 */
export function resolveMadrasaPrefix(madrasa: any, fallbackName?: string): string {
  const saved = extractSavedMadrasaPrefix(madrasa);
  if (saved) return saved;

  let name = fallbackName || "";
  if (!name && madrasa && typeof madrasa === "object") {
    name =
      madrasa.name ||
      madrasa.madrasa_name ||
      madrasa.madrasa_info?.name ||
      madrasa.metadata?.name ||
      madrasa.metadata?.madrasa_info?.name ||
      "";
    if (!name && typeof madrasa.registration_no === "string" && madrasa.registration_no.trim().startsWith("{")) {
      try {
        const meta = JSON.parse(madrasa.registration_no);
        name = meta?.name || meta?.madrasa_info?.name || "";
      } catch {
        // Ignore
      }
    }
  }

  return generateSuggestedPrefix(typeof name === "string" ? name : "") || "QM";
}

/**
 * Extracts the prefix of a given madrasa from its metadata or properties.
 * Falls back to deriving from its own name, then neutral "QM".
 */
export function extractMadrasaPrefix(madrasa: any): string {
  if (!madrasa) return "";
  return resolveMadrasaPrefix(madrasa);
}


