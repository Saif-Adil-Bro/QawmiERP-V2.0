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
