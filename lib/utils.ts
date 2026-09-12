import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts Bengali digits (০-৯) to English digits (0-9)
 */
export function normalizeBanglaDigitsToEnglish(input: string = ""): string {
  if (!input) return "";
  const bnToEnMap: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  return input.replace(/[০-৯]/g, (d) => bnToEnMap[d] || d);
}

/**
 * Parses any phone string (Bengali or English digits) into valid WhatsApp and tel: links
 */
export function parsePhoneContact(phoneStr?: string | null): {
  cleanDigits: string;
  whatsappUrl: string;
  telUrl: string;
  displayFormatted: string;
} {
  if (!phoneStr) {
    return { cleanDigits: "", whatsappUrl: "", telUrl: "", displayFormatted: "" };
  }

  const normalized = normalizeBanglaDigitsToEnglish(phoneStr);
  const cleanDigits = normalized.replace(/[^0-9]/g, "");

  if (!cleanDigits || cleanDigits.length < 6) {
    return { cleanDigits: "", whatsappUrl: "", telUrl: "", displayFormatted: phoneStr };
  }

  let whatsappNumber = cleanDigits;
  if (whatsappNumber.startsWith("880")) {
    // already international
  } else if (whatsappNumber.startsWith("0")) {
    whatsappNumber = `88${whatsappNumber}`;
  } else if (!whatsappNumber.startsWith("88")) {
    whatsappNumber = `880${whatsappNumber}`;
  }

  return {
    cleanDigits,
    whatsappUrl: `https://wa.me/${whatsappNumber}`,
    telUrl: `tel:${cleanDigits.startsWith("0") ? cleanDigits : (cleanDigits.startsWith("880") ? `+${cleanDigits}` : `0${cleanDigits}`)}`,
    displayFormatted: phoneStr,
  };
}

/**
 * Detects if a string contains Bengali characters ([\u0980-\u09FF])
 */
export function hasBengaliText(text: string = ""): boolean {
  if (!text) return false;
  return /[\u0980-\u09FF]/.test(text);
}

/**
 * Detects if a string contains Arabic characters
 */
export function hasArabicText(text: string = ""): boolean {
  if (!text) return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/**
 * Checks if a string is PURE Arabic (contains Arabic characters and NO Bengali characters).
 * If a text is mixed (contains both Arabic and Bengali), it returns false (treated as Bengali/LTR).
 */
export function isPureArabicText(text: string = ""): boolean {
  if (!text) return false;
  return hasArabicText(text) && !hasBengaliText(text);
}

/**
 * Backward-compatible alias for hasArabicText
 */
export function isArabicText(text: string = ""): boolean {
  return hasArabicText(text);
}

/**
 * Determines text direction based on whether text is pure Arabic or contains Bengali / mixed
 */
export function getTextDirection(text: string = "", mode: "auto" | "rtl" | "ltr" = "auto"): "rtl" | "ltr" {
  if (mode === "rtl") return "rtl";
  if (mode === "ltr") return "ltr";
  return isPureArabicText(text) ? "rtl" : "ltr";
}

/**
 * Converts a number to Bengali numerals (০-৯)
 */
export function toBengaliNumerals(num: number | string = 0): string {
  if (num === null || num === undefined) return "০";
  const digits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return num.toString().split("").map(d => digits[parseInt(d)] || d).join("");
}

/**
 * Converts a number to Bengali words (কথায় প্রকাশ)
 */
export function numberToBanglaWords(num: number): string {
  if (num === 0) return "শূন্য টাকা মাত্র";
  if (num < 0) return "মাইনাস " + numberToBanglaWords(Math.abs(num));

  const units = [
    "", "এক", "দুই", "তিন", "চার", "পাঁচ", "ছয়", "সাত", "আট", "নয়", "দশ",
    "এগারো", "বারো", "তেরো", "চৌদ্দ", "পনেরো", "ষোলো", "সতেরো", "আঠারো", "উনিশ", "বিশ",
    "একুশ", "বাইশ", "তেইশ", "চব্বিশ", "পঁচিশ", "ছাব্বিশ", "সাতাশ", "আঠাশ", "উনত্রিশ", "ত্রিশ",
    "একত্রিশ", "বত্রিশ", "তেত্রিশ", "চৌত্রিশ", "পঁয়ত্রিশ", "ছত্রিশ", "সাঁইত্রিশ", "আটত্রিশ", "উনচল্লিশ", "চল্লিশ",
    "একচল্লিশ", "বিয়াল্লিশ", "তেতাল্লিশ", "চুয়াল্লিশ", "পঁয়তাল্লিশ", "ছেচল্লিশ", "সাতচল্লিশ", "আটচল্লিশ", "উনপঞ্চাশ", "পঞ্চাশ",
    "একান্ন", "বায়ান্ন", "তিপ্পান্ন", "চুয়ান্ন", "পঞ্চান্ন", "ছাপ্পান্ন", "সাতান্ন", "আটান্ন", "উনষাট", "ষাট",
    "একষট্টি", "বাষট্টি", "তেষট্টি", "চৌষট্টি", "পঁয়ষট্টি", "ছেষট্টি", "সাতষট্টি", "আটষট্টি", "উনসত্তর", "সত্তর",
    "একাত্তর", "বাহাত্তর", "তিয়াত্তর", "চুয়াত্তর", "পঁচাত্তর", "ছিয়াত্তর", "সাতাত্তর", "আটাত্তর", "উনাশি", "আশি",
    "একাশি", "বিরাশি", "তিরাশি", "চুরাশি", "পঁচাশি", "ছিয়াশি", "সাতাশি", "আটাশি", "ঊননব্বই", "নব্বই",
    "একানব্বই", "বানব্বই", "তিরানব্বই", "চুরানব্বই", "পঁচানব্বই", "ছিয়ানব্বই", "সাতানব্বই", "আটানব্বই", "নিরানব্বই"
  ];

  function convertPart(n: number): string {
    let res = "";
    if (n >= 10000000) {
      const crore = Math.floor(n / 10000000);
      res += convertPart(crore) + " কোটি ";
      n %= 10000000;
    }
    if (n >= 100000) {
      const lakh = Math.floor(n / 100000);
      res += units[lakh] + " লাখ ";
      n %= 100000;
    }
    if (n >= 1000) {
      const thousand = Math.floor(n / 1000);
      res += units[thousand] + " হাজার ";
      n %= 1000;
    }
    if (n >= 100) {
      const hundred = Math.floor(n / 100);
      res += units[hundred] + " শত ";
      n %= 100;
    }
    if (n > 0) {
      res += units[n] + " ";
    }
    return res.trim();
  }

  return `${convertPart(Math.floor(num))} টাকা মাত্র`;
}

/**
 * Converts a number to Arabic-Indic numerals (٠-٩)
 */
export function toArabicNumerals(num: number | string = 0): string {
  if (num === null || num === undefined) return "٠";
  const digits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return num.toString().split("").map(d => digits[parseInt(d)] || d).join("");
}

