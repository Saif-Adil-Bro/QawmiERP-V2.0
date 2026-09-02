export type SMSProvider =
  | "mram"
  | "greenweb"
  | "bulksmsbd"
  | "alphasms"
  | "elitbuzz"
  | "custom";

export interface SMSGatewayConfig {
  provider: SMSProvider;
  isEnabled: boolean;
  apiKey: string;
  senderId: string;
  apiEndpoint: string;
  httpMethod: "GET" | "POST_JSON" | "POST_FORM";
  unicode: boolean;
  
  // Specific Provider Parameters
  smsLabel?: "transactional" | "promotional";
  
  // Custom API field mappings
  apiKeyParamName?: string;
  phoneParamName?: string;
  messageParamName?: string;
  senderIdParamName?: string;
  extraParams?: Record<string, string>;
  customHeaders?: Record<string, string>;
  customBodyTemplate?: string;
  
  // Metadata & Diagnostics
  lastTestedAt?: string;
  lastTestStatus?: "success" | "failed";
  lastTestResponse?: string;
  cachedBalance?: string;
  balanceUpdatedAt?: string;
}

export interface SMSProviderPreset {
  id: SMSProvider;
  name: string;
  nameBangla: string;
  website: string;
  defaultEndpoint: string;
  defaultMethod: "GET" | "POST_JSON" | "POST_FORM";
  defaultSenderId: string;
  balanceEndpoint?: string;
  description: string;
  documentationUrl?: string;
}

export const MRAM_ERROR_CODES: Record<string, string> = {
  "1002": "Sender Id/Masking পাওয়া যায়নি (অনুমোদিত সেন্ডার আইডি ব্যবহার করুন)",
  "1003": "API Key পাওয়া যায়নি বা ভুল প্রদান করা হয়েছে",
  "1004": "স্প্যাম হিসেবে চিহ্নিত হয়েছে (SPAM SMS)",
  "1005": "সার্ভার ইন্টারনাল এরর (Internal Server Error)",
  "1006": "ব্যালেন্সের মেয়াদ পাওয়া যায়নি (Balance Validity Not Found)",
  "1007": "ব্যালেন্সের মেয়াদ শেষ হয়েছে (Balance Validity Expired)",
  "1008": "পর্যাপ্ত ব্যালেন্স নেই (Insufficient SMS Balance)",
  "1009": "অ্যাকাউন্ট নিষ্ক্রিয় (Inactive Account)",
  "1010": "সর্বোচ্চ লিমিট অতিক্রম করেছে (Max Limit Exceeded)",
  "1011": "মোবাইল নম্বরটি সঠিক নয় (Invalid Mobile Number)",
  "1012": "নম্বরটি ব্লক লিস্টে আছে (Number Blacklisted)",
  "1013": "ব্যালেন্সের মেয়াদ শেষ বা অপ্রাপ্য (Balance Validity Not Available)",
  "1014": "টেমপ্লেট ম্যাচ করেনি / অভ্যন্তরীণ এরর (No Matching Template)",
  "1015": "মেসেজের কন্টেন্ট ভ্যালিডেশন ব্যর্থ (SMS Content Validation Fails)",
  "1016": "আইপি অ্যাড্রেস বা সার্ভার অনুমোদিত নয় (IP Address Not Allowed - Mram প্যানেলে আপনার সার্ভার IP অনুমতি দিন)",
  "1017": "শিডিউল সময় সঠিক নয় (Invalid Schedule Date/Time)",
  "1018": "অ্যাকাউন্ট ডিজেবল করা হয়েছে (Account Disabled)",
};

export const SMS_PROVIDER_PRESETS: SMSProviderPreset[] = [
  {
    id: "mram",
    name: "Mram SMS (sms.mram.com.bd)",
    nameBangla: "এমরাম এসএমএস (Mram SMS)",
    website: "https://mram.com.bd",
    defaultEndpoint: "https://sms.mram.com.bd/smsapi",
    defaultMethod: "GET",
    defaultSenderId: "",
    balanceEndpoint: "https://sms.mram.com.bd/miscapi/{apiKey}/getBalance",
    description: "জনপ্রিয় ও নির্ভরযোগ্য বাংলাদেশি এসএমএস গেটওয়ে (মাস্কিং ও নন-মাস্কিং)।",
    documentationUrl: "https://mram.com.bd/api-doc",
  },
  {
    id: "greenweb",
    name: "Greenweb SMS (greenweb.com.bd)",
    nameBangla: "গ্রিনওয়েব এসএমএস (Greenweb)",
    website: "https://greenweb.com.bd",
    defaultEndpoint: "https://api.greenweb.com.bd/api.php",
    defaultMethod: "GET",
    defaultSenderId: "",
    balanceEndpoint: "https://api.greenweb.com.bd/greb/api/balance.php",
    description: "সবচেয়ে জনপ্রিয় দ্রুতগতির এসএমএস এপিআই গেটওয়ে।",
    documentationUrl: "https://greenweb.com.bd/sms-api",
  },
  {
    id: "bulksmsbd",
    name: "BulkSMS BD (bulksmsbd.net)",
    nameBangla: "বাল্ক এসএমএস বিডি (BulkSMS BD)",
    website: "https://bulksmsbd.net",
    defaultEndpoint: "https://bulksmsbd.net/api/smsapi",
    defaultMethod: "GET",
    defaultSenderId: "",
    balanceEndpoint: "https://bulksmsbd.net/api/getBalanceApi",
    description: "দ্রুত ডেলিভারি ও রিয়েল-টাইম ব্যালেন্স ট্র্যাকিং যুক্ত এপিআই।",
    documentationUrl: "https://bulksmsbd.net/developers",
  },
  {
    id: "alphasms",
    name: "Alpha SMS / SMS4BD (alpha.net.bd)",
    nameBangla: "আলফা এসএমএস (Alpha SMS)",
    website: "https://alpha.net.bd",
    defaultEndpoint: "https://api.sms4bd.net/api/v1/send",
    defaultMethod: "POST_JSON",
    defaultSenderId: "",
    description: "আলফা নেটওয়ার্কের সুরক্ষিত এসএমএস প্ল্যাটফর্ম।",
  },
  {
    id: "elitbuzz",
    name: "ElitBuzz / Diana Host (elitbuzz-bd.com)",
    nameBangla: "এলিটবাজ এসএমএস (ElitBuzz)",
    website: "https://elitbuzz-bd.com",
    defaultEndpoint: "https://msg.elitbuzz-bd.com/smsapi",
    defaultMethod: "GET",
    defaultSenderId: "",
    description: "টেলিকম অনুমোদিত শক্তিশালী বাল্ক এসএমএস গেটওয়ে।",
  },
  {
    id: "custom",
    name: "Custom REST / HTTP SMS API",
    nameBangla: "কাস্টম এসএমএস এপিআই (Custom API)",
    website: "",
    defaultEndpoint: "https://your-sms-gateway.com/api/send",
    defaultMethod: "GET",
    defaultSenderId: "",
    description: "যেকোনো দেশি/বিদেশি এসএমএস সার্ভারের GET বা POST API এন্ডপয়েন্ট লিঙ্ক করুন।",
  },
];

export const DEFAULT_SMS_GATEWAY_CONFIG: SMSGatewayConfig = {
  provider: "mram",
  isEnabled: false,
  apiKey: "",
  senderId: "",
  apiEndpoint: "https://sms.mram.com.bd/smsapi",
  httpMethod: "GET",
  unicode: true,
  smsLabel: "transactional",
  apiKeyParamName: "api_key",
  phoneParamName: "contacts",
  messageParamName: "msg",
  senderIdParamName: "senderid",
};

/**
 * Standardize Bangladeshi phone number to either 01XXXXXXXXX or 8801XXXXXXXXX
 */
export function normalizePhoneNumber(rawPhone: string, withCountryCode = false): string {
  if (!rawPhone) return "";
  
  // Convert any Bengali digits to English
  const bengaliDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  let phone = String(rawPhone).trim();
  for (let i = 0; i < 10; i++) {
    phone = phone.replaceAll(bengaliDigits[i], String(i));
  }

  // Remove non-digit characters
  phone = phone.replace(/\D/g, "");

  // If starts with 880, extract 11 digit local
  if (phone.startsWith("880") && phone.length >= 13) {
    phone = phone.substring(2); // starts with 0
  } else if (phone.length === 10 && phone.startsWith("1")) {
    phone = "0" + phone;
  }

  if (withCountryCode) {
    if (phone.startsWith("0")) {
      return "88" + phone;
    }
    return phone.startsWith("88") ? phone : "880" + phone;
  }

  return phone;
}
