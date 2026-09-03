// Bengali number and words conversion utilities

const banglaDigits: { [key: string]: string } = {
  '0': '০',
  '1': '১',
  '2': '২',
  '3': '৩',
  '4': '৪',
  '5': '৫',
  '6': '৬',
  '7': '৭',
  '8': '৮',
  '9': '৯'
};

export function toBanglaNumber(num: number | string | null | undefined): string {
  if (num === null || num === undefined || num === '') return '';
  return String(num).replace(/[0-9]/g, (digit) => banglaDigits[digit] || digit);
}

export function formatBanglaCurrency(num: number | string | null | undefined): string {
  if (num === null || num === undefined || num === '') return '০';
  const val = typeof num === 'number' ? num : parseFloat(String(num));
  if (isNaN(val)) return '০';
  
  // Format with standard comma grouping
  const formatted = Number(val).toLocaleString('en-IN');
  return toBanglaNumber(formatted);
}

export const formatCurrencyBangla = formatBanglaCurrency;

export function translateMonthToBangla(month: string | null | undefined): string {
  if (!month) return '';
  const monthMap: Record<string, string> = {
    'January': 'জানুয়ারি',
    'February': 'ফেব্রুয়ারি',
    'March': 'মার্চ',
    'April': 'এপ্রিল',
    'May': 'মে',
    'June': 'জুন',
    'July': 'জুলাই',
    'August': 'আগস্ট',
    'September': 'সেপ্টেম্বর',
    'October': 'অক্টোবর',
    'November': 'নভেম্বর',
    'December': 'ডিসেম্বর'
  };
  return monthMap[month] || month;
}

const units = ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ', 
  'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোলো', 'সতেরো', 'আঠারো', 'উনিশ', 'বিশ',
  'একুশ', 'বাইশ', 'তেইশ', 'চব্বিশ', 'পঁচিশ', 'ছাব্বিশ', 'সাতাশ', 'আঠাশ', 'উনত্রিশ', 'ত্রিশ',
  'একত্রিশ', 'বত্রিশ', 'তেত্রিশ', 'চৌত্রিশ', 'পঁয়ত্রিশ', 'ছত্রিশ', 'সাঁইত্রিশ', 'আটত্রিশ', 'উনচল্লিশ', 'চল্লিশ',
  'একচল্লিশ', 'বিয়াল্লিশ', 'তেতাল্লিশ', 'চুয়াল্লিশ', 'পঁয়তাল্লিশ', 'ছেচল্লিশ', 'সাতচল্লিশ', 'আটচল্লিশ', 'উনপঞ্চাশ', 'পঞ্চাশ',
  'একান্ন', 'বায়ান্ন', 'তিপ্পান্ন', 'চুয়ান্ন', 'পঞ্চান্ন', 'ছাপ্পান্ন', 'সাতান্ন', 'আটান্ন', 'উনষাট', 'ষাট',
  'একষট্টি', 'বাষট্টি', 'তেষট্টি', 'চৌষট্টি', 'পঁয়ষট্টি', 'ছেষট্টি', 'সাতষট্টি', 'আটষট্টি', 'উনসত্তর', 'সত্তর',
  'একাত্তর', 'বাহাত্তর', 'তিয়াত্তর', 'চুয়াত্তর', 'পঁচাত্তর', 'ছিয়াত্তর', 'সাতাত্তর', 'আটাত্তর', 'উনাশি', 'আশি',
  'একাশি', 'বিরাশি', 'তিরাশি', 'চুরাশি', 'পঁচাশি', 'ছিয়াশি', 'সাতাশি', 'অষ্টআশি', 'উননব্বই', 'নব্বই',
  'একানব্বই', 'বানব্বই', 'তিরানব্বই', 'চুরানব্বই', 'পঁচানব্বই', 'ছিয়ানব্বই', 'সাতানব্বই', 'আটানব্বই', 'নিরানব্বই'];

function convertUnderThousand(n: number): string {
  let res = '';
  if (n >= 100) {
    const h = Math.floor(n / 100);
    res += (h === 1 ? 'একশত ' : h === 2 ? 'দুইশত ' : units[h] + ' শত ');
    n %= 100;
  }
  if (n > 0) {
    res += units[n] + ' ';
  }
  return res.trim();
}

export function numberToBanglaWords(num: number | string | null | undefined): string {
  if (num === null || num === undefined || num === '') return 'শূন্য টাকা মাত্র';
  const val = Math.floor(typeof num === 'number' ? num : parseFloat(String(num)));
  if (isNaN(val) || val === 0) return 'শূন্য টাকা মাত্র';

  let remaining = val;
  let words = '';

  // Crore (কোটি) = 10,000,000
  if (remaining >= 10000000) {
    const crore = Math.floor(remaining / 10000000);
    words += numberToBanglaWords(crore).replace(' টাকা মাত্র', '') + ' কোটি ';
    remaining %= 10000000;
  }

  // Lakh (লাখ) = 100,000
  if (remaining >= 100000) {
    const lakh = Math.floor(remaining / 100000);
    words += units[lakh] + ' লাখ ';
    remaining %= 100000;
  }

  // Thousand (হাজার) = 1,000
  if (remaining >= 1000) {
    const thousand = Math.floor(remaining / 1000);
    words += units[thousand] + ' হাজার ';
    remaining %= 1000;
  }

  // Hundred and below
  if (remaining > 0) {
    words += convertUnderThousand(remaining) + ' ';
  }

  return words.trim() + ' টাকা মাত্র';
}
