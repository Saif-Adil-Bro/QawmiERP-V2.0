import { toBanglaNumber, formatBanglaCurrency } from "@/lib/numberToBangla";

export interface ParsedExpenseItem {
  id: number;
  serialBn: string;
  name: string;
  amount: number | null;
  amountFormatted: string;
  rawLine?: string;
}

/**
 * Converts Bengali digits (০-৯) to English ASCII digits (0-9).
 */
export function banglaToEnglishDigits(str: string): string {
  if (!str) return "";
  const bnToEn: Record<string, string> = {
    "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
    "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9"
  };
  return String(str).replace(/[০-৯]/g, (d) => bnToEn[d] || d);
}

/**
 * Parses multi-line or single-line expense descriptions into individual structured line items.
 * Each item contains a serial number (০১, ০২, ...), product/item description, and separate amount.
 */
export function parseExpenseItems(
  description: string | undefined | null,
  totalAmount?: number | string
): ParsedExpenseItem[] {
  const fallbackTotal = totalAmount !== undefined && totalAmount !== null
    ? (typeof totalAmount === "number" ? totalAmount : parseFloat(String(totalAmount)) || 0)
    : 0;

  if (!description || !description.trim()) {
    return [
      {
        id: 1,
        serialBn: "০১",
        name: "মাদরাসার প্রাতিষ্ঠানিক প্রয়োজনে ব্যয় নির্বাহ করা হয়েছে।",
        amount: fallbackTotal || null,
        amountFormatted: fallbackTotal ? formatBanglaCurrency(fallbackTotal) : "",
      },
    ];
  }

  // 1. Check if description is a JSON array string
  const trimmed = description.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsedJson = JSON.parse(trimmed);
      if (Array.isArray(parsedJson) && parsedJson.length > 0) {
        const jsonItems: ParsedExpenseItem[] = parsedJson.map((item: any, idx: number) => {
          const num = typeof item.amount === "number" ? item.amount : parseFloat(banglaToEnglishDigits(String(item.amount || 0)));
          const validNum = !isNaN(num) && num > 0 ? num : null;
          return {
            id: idx + 1,
            serialBn: toBanglaNumber(String(idx + 1).padStart(2, "0")),
            name: item.name || item.item || item.description || `আইটেম #${idx + 1}`,
            amount: validNum,
            amountFormatted: validNum ? formatBanglaCurrency(validNum) : "",
          };
        });
        if (jsonItems.length > 0) return jsonItems;
      }
    } catch {
      // not json, continue to line parsing
    }
  }

  // 2. Remove [FUND: ...] metadata tag if wrapped inside description
  const cleanText = trimmed.replace(/\[FUND:[^\]]+\]\s*/gi, "").trim();
  if (!cleanText) {
    return [
      {
        id: 1,
        serialBn: "০১",
        name: "মাদরাসার প্রাতিষ্ঠানিক প্রয়োজনে ব্যয় নির্বাহ করা হয়েছে।",
        amount: fallbackTotal || null,
        amountFormatted: fallbackTotal ? formatBanglaCurrency(fallbackTotal) : "",
      },
    ];
  }

  const rawLines = cleanText.split("\n").map((l) => l.trim()).filter(Boolean);
  if (rawLines.length === 0) {
    return [
      {
        id: 1,
        serialBn: "০১",
        name: "মাদরাসার প্রাতিষ্ঠানিক প্রয়োজনে ব্যয় নির্বাহ করা হয়েছে।",
        amount: fallbackTotal || null,
        amountFormatted: fallbackTotal ? formatBanglaCurrency(fallbackTotal) : "",
      },
    ];
  }

  const items: ParsedExpenseItem[] = [];
  let itemCounter = 1;

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i];

    // Strip leading numbering or bullet markers (e.g. "১.", "1.", "০১.", "1)", "-", "•", "*")
    line = line
      .replace(/^[০-৯0-9]+[.\-:)\]\s]+/, "")
      .replace(/^[\-•*]+\s*/, "")
      .trim();

    if (!line) continue;

    // Check if line is purely a general category header like "বিবিধ / অন্যান্য খরচ" or "খরচের বিবরণ:"
    const isCategoryHeading = /^(বিবিধ|অন্যান্য|খরচের বিবরণ|আইটেমসমূহ|খরচ|বিবরণ|দৈনন্দিন খরচ)\s*(\/|:|-)?\s*(অন্যান্য\s*খরচ|খরচ)?$/i.test(line);
    if (isCategoryHeading && rawLines.length > 1) {
      continue;
    }

    let matched = false;

    // Pattern 1: Name separated by separator ("-", "=", ":") followed by amount and optional currency text
    // Example: "মেহমানদারী - ২০ টাকা", "কেরোসিন তেল = ৫০/-", "ব্যাটারি পানি : ২৫০", "কাগজ কলম - ১০০ tk"
    const sepMatch = line.match(/^(.+?)\s*[-=:]\s*([০-৯0-9,.]+)\s*(?:টাকা|টাকা\s*মাত্র|tk|taka|\/-)?$/i);
    if (sepMatch) {
      const namePart = sepMatch[1].trim();
      const amountStrEng = banglaToEnglishDigits(sepMatch[2].replace(/,/g, ""));
      const num = parseFloat(amountStrEng);
      if (!isNaN(num) && namePart.length > 0) {
        items.push({
          id: itemCounter,
          serialBn: toBanglaNumber(String(itemCounter).padStart(2, "0")),
          name: namePart,
          amount: num,
          amountFormatted: formatBanglaCurrency(num),
          rawLine: rawLines[i],
        });
        itemCounter++;
        matched = true;
      }
    }

    if (!matched) {
      // Pattern 2: Trailing number with or without "টাকা"
      // Example: "মেহমানদারী ২০ টাকা", "ব্যাটারি পানি ৫টি ২৫০ টাকা", "কেরোসিন তেল ৫০ টাকা", "নাস্তা খরচ ৮০", "চা নাস্তা ১০০ টাকা"
      const trailingMatch = line.match(/^(.+?)\s+([০-৯0-9,.]+)\s*(?:টাকা|টাকা\s*মাত্র|tk|taka|\/-)?$/i);
      if (trailingMatch) {
        const potentialName = trailingMatch[1].trim();
        const amountStrEng = banglaToEnglishDigits(trailingMatch[2].replace(/,/g, ""));
        const num = parseFloat(amountStrEng);

        // Ensure the name is not just an empty string or solitary number
        if (!isNaN(num) && potentialName.length > 0) {
          items.push({
            id: itemCounter,
            serialBn: toBanglaNumber(String(itemCounter).padStart(2, "0")),
            name: potentialName,
            amount: num,
            amountFormatted: formatBanglaCurrency(num),
            rawLine: rawLines[i],
          });
          itemCounter++;
          matched = true;
        }
      }
    }

    if (!matched) {
      // Pattern 3: Line without clear price extraction (e.g. single item description)
      items.push({
        id: itemCounter,
        serialBn: toBanglaNumber(String(itemCounter).padStart(2, "0")),
        name: line,
        amount: null,
        amountFormatted: "",
        rawLine: rawLines[i],
      });
      itemCounter++;
    }
  }

  // If we have only 1 item and no separate price was detected, apply the total expense amount
  if (items.length === 1 && items[0].amount === null && fallbackTotal > 0) {
    items[0].amount = fallbackTotal;
    items[0].amountFormatted = formatBanglaCurrency(fallbackTotal);
  }

  // If no items extracted at all, fallback
  if (items.length === 0) {
    return [
      {
        id: 1,
        serialBn: "০১",
        name: cleanText || "মাদরাসার প্রাতিষ্ঠানিক প্রয়োজনে ব্যয় নির্বাহ করা হয়েছে।",
        amount: fallbackTotal || null,
        amountFormatted: fallbackTotal ? formatBanglaCurrency(fallbackTotal) : "",
      },
    ];
  }

  return items;
}
