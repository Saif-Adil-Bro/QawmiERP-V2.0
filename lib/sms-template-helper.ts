export interface SMSTag {
  tag: string;
  label: string;
  description: string;
  sampleValue: string;
  category: "student" | "finance" | "date" | "madrasa";
}

export const AVAILABLE_SMS_TAGS: SMSTag[] = [
  {
    tag: "{StudentName}",
    label: "শিক্ষার্থীর নাম",
    description: "শিক্ষার্থীর পূর্ণ নাম স্বয়ংক্রিয়ভাবে বসবে",
    sampleValue: "মোঃ আব্দুল্লাহ",
    category: "student",
  },
  {
    tag: "{Id}",
    label: "রোল / আইডি",
    description: "শিক্ষার্থীর রোল নম্বর বা ভর্তি আইডি",
    sampleValue: "১০৫",
    category: "student",
  },
  {
    tag: "{ClassName}",
    label: "জামাত / শ্রেণি",
    description: "শিক্ষার্থীর জামাত বা ক্লাসের নাম",
    sampleValue: "হিফজুল কুরআন",
    category: "student",
  },
  {
    tag: "{ParentName}",
    label: "পিতা / অভিভাবকের নাম",
    description: "পিতা বা অভিভাবকের নাম",
    sampleValue: "মোঃ আব্দুর রহিম",
    category: "student",
  },
  {
    tag: "{Phone}",
    label: "অভিভাবকের মোবাইল",
    description: "অভিভাবকের যোগাযোগের মোবাইল নম্বর",
    sampleValue: "01712345678",
    category: "student",
  },
  {
    tag: "{DueMonths}",
    label: "বকেয়া মাসসমূহ (পরিসীমা)",
    description: "যেমন: 'জানুয়ারি হতে মার্চ' অথবা 'আগস্ট'",
    sampleValue: "জানুয়ারি হতে মার্চ",
    category: "finance",
  },
  {
    tag: "{FromMonth}",
    label: "শুরুর মাস",
    description: "বকেয়া শুরুর মাস (যেমন: জানুয়ারি)",
    sampleValue: "জানুয়ারি",
    category: "finance",
  },
  {
    tag: "{ToMonth}",
    label: "শেষের মাস",
    description: "বকেয়া শেষের মাস (যেমন: মার্চ)",
    sampleValue: "মার্চ",
    category: "finance",
  },
  {
    tag: "{DueMonthsCount}",
    label: "বকেয়া মাসের সংখ্যা",
    description: "কত মাসের বেতন বকেয়া (যেমন: ৩)",
    sampleValue: "৩",
    category: "finance",
  },
  {
    tag: "{DueAmount}",
    label: "বকেয়া টাকার পরিমাণ",
    description: "শিক্ষার্থীর মোট বকেয়া বেতন বা ফি",
    sampleValue: "১,৫০০",
    category: "finance",
  },
  {
    tag: "{Month}",
    label: "চলতি মাস",
    description: "বর্তমান মাসের নাম (যেমন: আগস্ট)",
    sampleValue: "আগস্ট",
    category: "date",
  },
  {
    tag: "{TodayDate}",
    label: "আজকের তারিখ",
    description: "আজকের পূর্ণ তারিখ (যেমন: ২৭ আগস্ট, ২০২৬)",
    sampleValue: "২৭ আগস্ট, ২০২৬",
    category: "date",
  },
  {
    tag: "{DayName}",
    label: "আজকের বার / দিন",
    description: "আজ সপ্তাহের কোন দিন (যেমন: বৃহস্পতিবার)",
    sampleValue: "বৃহস্পতিবার",
    category: "date",
  },
  {
    tag: "{Year}",
    label: "বর্তমান বছর / সাল",
    description: "বর্তমান ইংরেজি বছর (যেমন: ২০২৬)",
    sampleValue: "২০২৬",
    category: "date",
  },
  {
    tag: "{MadrasaName}",
    label: "মাদ্রাসার নাম",
    description: "আপনার মাদ্রাসার নাম",
    sampleValue: "জামিয়া ইসলামিয়া দারুল উলুম",
    category: "madrasa",
  },
  {
    tag: "{MadrasaPhone}",
    label: "মাদ্রাসার হেল্পলাইন",
    description: "মাদ্রাসার অফিসিয়াল যোগাযোগ নম্বর",
    sampleValue: "01812345678",
    category: "madrasa",
  },
  {
    tag: "{PaymentLink}",
    label: "সরাসরি পেমেন্ট লিংক",
    description: "অনলাইন ফি পরিশোধের সরাসরি লিংক (হোস্টেড ডোমেইন ভিত্তিক)",
    sampleValue: "https://yourdomain.com/portal/fees?student_id=...",
    category: "finance",
  },
];

export interface SMSTemplate {
  id: string;
  title: string;
  category: "Attendance" | "Fee" | "Result" | "Notice" | "Holiday" | "Custom";
  category_bangla?: string;
  message_template: string;
  is_default?: boolean;
  created_at?: string;
}

export const DEFAULT_SMS_TEMPLATES: SMSTemplate[] = [
  {
    id: "tpl-due-fee-range-1",
    title: "বকেয়া বেতন তাগাদা (মাস পরিসীমা সহ)",
    category: "Fee",
    category_bangla: "ফি বকেয়া",
    message_template: "সম্মানিত অভিভাবক, {StudentName} (রোল: {Id})-এর {DueMonths} মাস পর্যন্ত মোট {DueAmount} টাকা বেতন বকেয়া রয়েছে। আগামী ৫ দিনের মধ্যে মাদ্রাসার অফিসে পরিশোধের অনুরোধ করা হলো। - {MadrasaName}",
    is_default: true,
  },
  {
    id: "tpl-due-fee-range-2",
    title: "শুরু ও শেষ মাস উল্লেখপূর্বক বকেয়া নোটিশ",
    category: "Fee",
    category_bangla: "ফি বকেয়া",
    message_template: "সম্মানিত অভিভাবক, আপনার সন্তান {StudentName}-এর {FromMonth} হতে {ToMonth} মাস পর্যন্ত ({DueMonthsCount} মাসের) মোট {DueAmount} টাকা ফি বকেয়া রয়েছে। মাদ্রাসার যোগাযোগ: {MadrasaPhone}। - {MadrasaName}",
    is_default: true,
  },
  {
    id: "tpl-absence-1",
    title: "দৈনন্দিন অনুপস্থিতির নোটিশ",
    category: "Attendance",
    category_bangla: "হাজিরা",
    message_template: "সম্মানিত অভিভাবক, আপনার সন্তান {StudentName} (রোল: {Id}, জামাত: {ClassName}) আজ {DayName}, {TodayDate} তারিখে মাদ্রাসায় অনুপস্থিত। কোনো জরুরি কারণ থাকলে মাদ্রাসায় অবহিত করুন। - {MadrasaName}",
    is_default: true,
  },
  {
    id: "tpl-due-fee-1",
    title: "একক চলতি মাসের বেতন নোটিশ",
    category: "Fee",
    category_bangla: "ফি বকেয়া",
    message_template: "সম্মানিত অভিভাবক, {StudentName} (রোল: {Id})-এর {Month} মাসের বেতন বাবদ {DueAmount} টাকা বকেয়া রয়েছে। দ্রুত পরিশোধের অনুরোধ রইলো। - {MadrasaName}",
    is_default: true,
  },
  {
    id: "tpl-result-1",
    title: "পরীক্ষার ফলাফল প্রকাশের বিজ্ঞপ্তি",
    category: "Result",
    category_bangla: "ফলাফল",
    message_template: "সম্মানিত অভিভাবক, {StudentName} (জামাত: {ClassName})-এর সাময়িক পরীক্ষার ফলাফল প্রকাশিত হয়েছে। রিপোর্ট কার্ড সংগ্রহ ও শিক্ষকগণের সাথে সাক্ষাতের জন্য মাদ্রাসায় আমন্ত্রিত। - {MadrasaName}",
    is_default: true,
  },
  {
    id: "tpl-holiday-1",
    title: "মাদ্রাসার ছুটি ও খোলার নোটিশ",
    category: "Holiday",
    category_bangla: "ছুটি",
    message_template: "সম্মানিত অভিভাবক, আগামী {TodayDate} ({DayName}) থেকে {Month} মাস উপলক্ষে মাদ্রাসার সাধারণ ছুটি ঘোষণা করা হলো। ইনশাআল্লাহ আগামী তারিখে যথারীতি ক্লাস শুরু হবে। - {MadrasaName}",
    is_default: true,
  },
  {
    id: "tpl-urgent-notice-1",
    title: "অভিভাবক সমাবেশ ও জরুরি তলব",
    category: "Notice",
    category_bangla: "নোটিশ",
    message_template: "সম্মানিত অভিভাবক, {StudentName}-এর বিষয়ে বিশেষ আলোচনার জন্য আগামী {DayName} তারিখে মাদ্রাসার অফিসে আপনার উপস্থিতি বিশেষভাবে কাম্য। - {MadrasaName}",
    is_default: true,
  },
  {
    id: "tpl-eid-greeting-1",
    title: "ঈদ ও বিশেষ শুভেচ্ছা বার্তা",
    category: "Custom",
    category_bangla: "শুভেচ্ছা",
    message_template: "আসসালামু আলাইকুম। {StudentName} এবং আপনার সমগ্র পরিবারের প্রতি পবিত্র ঈদের আন্তরিক মোবারকবাদ। তাকাব্বালাল্লাহু মিন্না ওয়া মিনকুম। - {MadrasaName}",
    is_default: true,
  }
];

export function toBengaliNumber(num: number | string | undefined | null): string {
  if (num === undefined || num === null || num === "") return "০";
  const str = String(num);
  const bengaliDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return str.replace(/[0-9]/g, (d) => bengaliDigits[parseInt(d, 10)] || d);
}

export const BENGALI_MONTHS = [
  "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"
];

export const BENGALI_DAYS = [
  "রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"
];

export function getBengaliDateContext(date: Date = new Date()) {
  const dayIndex = date.getDay();
  const monthIndex = date.getMonth();
  const dateNum = date.getDate();
  const yearNum = date.getFullYear();

  return {
    month: BENGALI_MONTHS[monthIndex],
    monthIndex,
    dayName: BENGALI_DAYS[dayIndex],
    date: `${toBengaliNumber(dateNum)} ${BENGALI_MONTHS[monthIndex]}, ${toBengaliNumber(yearNum)}`,
    dateEn: `${dateNum} ${date.toLocaleString('en-US', { month: 'short' })}, ${yearNum}`,
    year: toBengaliNumber(yearNum),
    yearEn: String(yearNum),
  };
}

export interface StudentContextData {
  id?: string;
  student_id?: string;
  first_name?: string;
  last_name?: string;
  roll_number?: string | number;
  class_name?: string;
  classes?: { name?: string } | null;
  father_name?: string;
  parent_phone?: string;
  due_amount?: number | string;
  monthly_fee?: number | string;
}

export function renderDynamicTemplate(
  templateText: string,
  student?: StudentContextData | null,
  options?: {
    madrasaName?: string;
    madrasaPhone?: string;
    dueAmount?: number | string;
    fromMonth?: string;
    toMonth?: string;
    dueMonthsText?: string;
    baseUrl?: string;
    paymentLink?: string;
    date?: Date;
  }
): string {
  if (!templateText) return "";

  const dateCtx = getBengaliDateContext(options?.date || new Date());
  const fullName = student
    ? `${student.first_name || ""} ${student.last_name || ""}`.trim() || "শিক্ষার্থী"
    : "মোঃ আব্দুল্লাহ";

  const rollOrId = student?.roll_number
    ? toBengaliNumber(student.roll_number)
    : student?.student_id || "১০১";

  const className =
    student?.class_name ||
    student?.classes?.name ||
    "হিফজুল কুরআন";

  const parentName = student?.father_name || "সম্মানিত অভিভাবক";
  const parentPhone = student?.parent_phone || "০১৭১২৩৪৫৬৭৮";
  
  const rawDue = options?.dueAmount !== undefined
    ? options.dueAmount
    : student?.due_amount !== undefined
    ? student.due_amount
    : student?.monthly_fee || 1200;
  
  const dueFormatted = toBengaliNumber(rawDue);
  const madrasaName = options?.madrasaName || "মাদ্রাসাতুল মুসলিমীন";
  const madrasaPhone = options?.madrasaPhone || "০১৮১২৩৪৫৬৭৮";

  // Month range calculations
  const fromMonth = options?.fromMonth || dateCtx.month;
  const toMonth = options?.toMonth || dateCtx.month;

  let dueMonthsFormatted = "";
  let dueMonthsCount = "১";

  if (options?.dueMonthsText) {
    dueMonthsFormatted = options.dueMonthsText;
  } else if (fromMonth === toMonth) {
    dueMonthsFormatted = fromMonth;
    dueMonthsCount = "১";
  } else {
    dueMonthsFormatted = `${fromMonth} হতে ${toMonth}`;
    const fromIdx = BENGALI_MONTHS.indexOf(fromMonth);
    const toIdx = BENGALI_MONTHS.indexOf(toMonth);
    if (fromIdx !== -1 && toIdx !== -1) {
      const diff = toIdx >= fromIdx ? toIdx - fromIdx + 1 : (12 - fromIdx) + toIdx + 1;
      dueMonthsCount = toBengaliNumber(diff);
    }
  }

  // Determine dynamic payment link for student
  let resolvedPaymentLink = options?.paymentLink || "";
  if (!resolvedPaymentLink) {
    const sId = student?.id || student?.student_id;
    if (sId) {
      const baseUrl = options?.baseUrl || (typeof window !== "undefined" ? window.location.origin : "");
      resolvedPaymentLink = baseUrl
        ? `${baseUrl.replace(/\/+$/, "")}/portal/fees?student_id=${sId}`
        : `/portal/fees?student_id=${sId}`;
    }
  }

  let result = templateText;

  const replaceMap: Record<string, string> = {
    // Student Name
    "{StudentName}": fullName,
    "{studentName}": fullName,
    "{student_name}": fullName,
    "{নাম}": fullName,
    "{ছাত্রের_নাম}": fullName,
    "{শিক্ষার্থীর_নাম}": fullName,

    // ID / Roll
    "{Id}": String(rollOrId),
    "{id}": String(rollOrId),
    "{student_id}": String(rollOrId),
    "{StudentId}": String(rollOrId),
    "{RollNumber}": String(rollOrId),
    "{rollNumber}": String(rollOrId),
    "{রোল}": String(rollOrId),
    "{আইডি}": String(rollOrId),

    // Class Name
    "{ClassName}": className,
    "{className}": className,
    "{class_name}": className,
    "{class}": className,
    "{জামাত}": className,
    "{শ্রেণি}": className,

    // Parent
    "{ParentName}": parentName,
    "{parentName}": parentName,
    "{father_name}": parentName,
    "{পিতা}": parentName,
    "{অভিভাবক}": parentName,
    "{অভিভাবকের_নাম}": parentName,

    // Phone
    "{Phone}": parentPhone,
    "{phone}": parentPhone,
    "{parent_phone}": parentPhone,
    "{মোবাইল}": parentPhone,
    "{ফোন}": parentPhone,

    // Due / Amount
    "{DueAmount}": dueFormatted,
    "{dueAmount}": dueFormatted,
    "{due_amount}": dueFormatted,
    "{বকেয়া_টাকা}": dueFormatted,
    "{বেতন_বকেয়া}": dueFormatted,
    "{টাকা}": dueFormatted,
    "{পরিমাণ}": dueFormatted,

    // Month Range & Due Months
    "{DueMonths}": dueMonthsFormatted,
    "{dueMonths}": dueMonthsFormatted,
    "{due_months}": dueMonthsFormatted,
    "{বকেয়া_মাস}": dueMonthsFormatted,
    "{বকেয়া_মাস_সমূহ}": dueMonthsFormatted,
    "{মাস_পরিসীমা}": dueMonthsFormatted,

    "{FromMonth}": fromMonth,
    "{fromMonth}": fromMonth,
    "{from_month}": fromMonth,
    "{শুরুর_মাস}": fromMonth,

    "{ToMonth}": toMonth,
    "{toMonth}": toMonth,
    "{to_month}": toMonth,
    "{শেষের_মাস}": toMonth,

    "{DueMonthsCount}": dueMonthsCount,
    "{dueMonthsCount}": dueMonthsCount,
    "{বকেয়া_মাসের_সংখ্যা}": dueMonthsCount,
    "{মাসের_সংখ্যা}": dueMonthsCount,

    // Month
    "{Month}": dateCtx.month,
    "{month}": dateCtx.month,
    "{মাস}": dateCtx.month,
    "{চলতি_মাস}": dateCtx.month,

    // Today Date
    "{TodayDate}": dateCtx.date,
    "{todayDate}": dateCtx.date,
    "{date}": dateCtx.date,
    "{Date}": dateCtx.date,
    "{আজকের_তারিখ}": dateCtx.date,
    "{তারিখ}": dateCtx.date,

    // Day Name
    "{DayName}": dateCtx.dayName,
    "{dayName}": dateCtx.dayName,
    "{day}": dateCtx.dayName,
    "{বার}": dateCtx.dayName,
    "{দিন}": dateCtx.dayName,

    // Year
    "{Year}": dateCtx.year,
    "{year}": dateCtx.year,
    "{বছর}": dateCtx.year,
    "{সাল}": dateCtx.year,

    // Madrasa Name & Phone
    "{MadrasaName}": madrasaName,
    "{madrasaName}": madrasaName,
    "{madrasa_name}": madrasaName,
    "{মাদ্রাসার_নাম}": madrasaName,
    "{MadrasaPhone}": madrasaPhone,
    "{madrasaPhone}": madrasaPhone,
    "{মাদ্রাসার_ফোন}": madrasaPhone,
    "{যোগাযোগ_নম্বর}": madrasaPhone,

    // Dynamic Payment Link (using running website base URL)
    "{PaymentLink}": resolvedPaymentLink,
    "{paymentLink}": resolvedPaymentLink,
    "{payment_link}": resolvedPaymentLink,
    "{পেমেন্ট_লিংক}": resolvedPaymentLink,
    "{পেমেন্ট_ইউআরএল}": resolvedPaymentLink,
    "[পেমেন্ট লিংক]": resolvedPaymentLink,
  };

  // Perform case-insensitive & alias replacement
  for (const [key, value] of Object.entries(replaceMap)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    result = result.replace(regex, value);
  }

  return result;
}

export function calculateSMSParts(text: string): {
  charCount: number;
  smsCount: number;
  encoding: "Unicode" | "GSM";
  remainingChars: number;
} {
  const isUnicode = /[^\u0000-\u007F]/.test(text);
  const charCount = text.length;

  if (isUnicode) {
    // Bengali/Unicode: 1st SMS = 70 chars, concatenated SMS = 67 chars each
    if (charCount <= 70) {
      return {
        charCount,
        smsCount: charCount === 0 ? 0 : 1,
        encoding: "Unicode",
        remainingChars: 70 - charCount,
      };
    } else {
      const smsCount = Math.ceil(charCount / 67);
      const remainingChars = smsCount * 67 - charCount;
      return {
        charCount,
        smsCount,
        encoding: "Unicode",
        remainingChars,
      };
    }
  } else {
    // Standard ASCII/GSM: 1st SMS = 160 chars, concatenated = 153 chars each
    if (charCount <= 160) {
      return {
        charCount,
        smsCount: charCount === 0 ? 0 : 1,
        encoding: "GSM",
        remainingChars: 160 - charCount,
      };
    } else {
      const smsCount = Math.ceil(charCount / 153);
      const remainingChars = smsCount * 153 - charCount;
      return {
        charCount,
        smsCount,
        encoding: "GSM",
        remainingChars,
      };
    }
  }
}
