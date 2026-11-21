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

/** A 200 may contain a provider rejection (e.g. MRAM 1007 or BulkSMSBD 10xx).
 * For clinical alerts require a positive submission receipt, not just an HTTP success. */
export function hasSmsReceipt(body: string): boolean {
  const text = body.trim();
  if (!text || MRAM_ERROR_CODES[text]) return false;
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj === 'object') {
      if (obj.error || obj.success === false || /fail|reject|error|invalid|denied/i.test(String(obj.status))) return false;
      if (obj.response_code != null) return String(obj.response_code) === '202';
      return obj.success === true || !!obj.message_id || !!obj.sid || /^(ok|success|accepted|queued|sent)$/i.test(String(obj.status));
    }
  } catch { /* plain-text receipts */ }
  return !/error|invalid|fail|reject|denied|insufficient|unsuccessful/i.test(text) && (/^(ok\b|success\b|sms submitted\b|accepted\b|queued\b|1001$)/i.test(text) || /^\d{6,}$/.test(text));
}

/**
 * Execute HTTP call to SMS Provider API
 */
export async function dispatchSMSGatewayRequest(
  config: SMSGatewayConfig,
  recipientPhone: string,
  messageText: string
): Promise<{ success: boolean; rawResponse: string; statusCode: number; error?: string }> {
  try {
    const rawDigits = normalizePhoneNumber(recipientPhone, false); // 01XXXXXXXXX
    const bdFullNumber = normalizePhoneNumber(recipientPhone, true); // 8801XXXXXXXXX

    if (!config.apiEndpoint) {
      return {
        success: false,
        rawResponse: "API Endpoint is empty",
        statusCode: 400,
        error: "এপিআই এন্ডপয়েন্ট ইউআরএল দেওয়া হয়নি",
      };
    }

    // Provider Specific Handling
    if (config.provider === "mram") {
      // Mram SMS: https://sms.mram.com.bd/smsapi
      // Parameters:
      // api_key: Your API Key
      // type: text/unicode
      // contacts: 88017XXXXXXXX or multi 88017XXXXXXXX+88018XXXXXXXX
      // senderid: Approved Sender ID
      // msg: SMS body (URL encoded)
      // label: transactional / promotional
      const endpoint = config.apiEndpoint || "https://sms.mram.com.bd/smsapi";
      const url = new URL(endpoint);
      url.searchParams.set("api_key", config.apiKey.trim());
      url.searchParams.set("type", config.unicode !== false ? "unicode" : "text");
      url.searchParams.set("contacts", bdFullNumber);
      if (config.senderId && config.senderId.trim()) {
        url.searchParams.set("senderid", config.senderId.trim());
      }
      url.searchParams.set("msg", messageText);
      url.searchParams.set("label", config.smsLabel || "transactional");

      const res = await fetch(url.toString(), {
        method: "GET",
        signal: AbortSignal.timeout(12000),
      });

      const bodyText = (await res.text()).trim();

      // Parse Mram Error codes or shoot ID
      const trimmedCode = bodyText.replace(/[^0-9]/g, "");
      let errorMessage = "";

      if (MRAM_ERROR_CODES[bodyText] || MRAM_ERROR_CODES[trimmedCode]) {
        errorMessage = MRAM_ERROR_CODES[bodyText] || MRAM_ERROR_CODES[trimmedCode];
      } else if (/^10\d{2}$/.test(trimmedCode) && Number(trimmedCode) >= 1002 && Number(trimmedCode) <= 1099) {
        // Any 4-digit code starting with 10 (except 1001) is an error in Mram API
        errorMessage = `এমরাম এপিআই ত্রুটি কোড: ${trimmedCode}`;
      } else if (
        bodyText.toLowerCase().includes("invalid") ||
        bodyText.toLowerCase().includes("error") ||
        bodyText.toLowerCase().includes("failed") ||
        bodyText.toLowerCase().includes("not allowed")
      ) {
        errorMessage = bodyText;
      }

      const isSuccess = res.ok && !errorMessage && (
        bodyText.toLowerCase().includes("sms submitted") ||
        bodyText.toLowerCase().includes("success") ||
        bodyText === "1001" ||
        (/^\d+$/.test(bodyText) && bodyText.length >= 6) // Numeric Shoot ID (e.g. 54321987)
      );

      return {
        success: isSuccess,
        rawResponse: bodyText,
        statusCode: res.status,
        error: errorMessage || (!isSuccess ? (MRAM_ERROR_CODES[bodyText] || MRAM_ERROR_CODES[trimmedCode] || bodyText) : undefined),
      };
    } else if (config.provider === "greenweb") {
      // Greenweb: https://api.greenweb.com.bd/api.php
      // Params: token, to, message
      const endpoint = config.apiEndpoint || "https://api.greenweb.com.bd/api.php";
      const url = new URL(endpoint);
      url.searchParams.set("token", config.apiKey);
      url.searchParams.set("to", bdFullNumber);
      url.searchParams.set("message", messageText);

      const res = await fetch(url.toString(), {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      });
      const bodyText = await res.text();
      const isSuccess = res.ok && (bodyText.includes("Ok:") || bodyText.toLowerCase().includes("success") || !bodyText.toLowerCase().includes("error"));

      return {
        success: isSuccess,
        rawResponse: bodyText,
        statusCode: res.status,
      };
    } else if (config.provider === "bulksmsbd") {
      // BulkSMSBD: https://bulksmsbd.net/api/smsapi
      // Params: api_key, type=unicode, number, senderid, message
      const endpoint = config.apiEndpoint || "https://bulksmsbd.net/api/smsapi";
      const url = new URL(endpoint);
      url.searchParams.set("api_key", config.apiKey);
      url.searchParams.set("type", config.unicode !== false ? "unicode" : "text");
      url.searchParams.set("number", rawDigits);
      if (config.senderId) {
        url.searchParams.set("senderid", config.senderId);
      }
      url.searchParams.set("message", messageText);

      const res = await fetch(url.toString(), {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      });
      const bodyText = await res.text();
      const isSuccess = res.ok && (bodyText.includes('"response_code":202') || bodyText.includes('"success"') || !bodyText.toLowerCase().includes("error"));

      return {
        success: isSuccess,
        rawResponse: bodyText,
        statusCode: res.status,
      };
    } else if (config.provider === "alphasms") {
      // Alpha SMS: https://api.sms4bd.net/api/v1/send
      const endpoint = config.apiEndpoint || "https://api.sms4bd.net/api/v1/send";
      const payload = {
        api_key: config.apiKey,
        sender_id: config.senderId,
        number: bdFullNumber,
        message: messageText,
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      const bodyText = await res.text();
      const isSuccess = res.ok && !bodyText.toLowerCase().includes("error");

      return {
        success: isSuccess,
        rawResponse: bodyText,
        statusCode: res.status,
      };
    } else if (config.provider === "elitbuzz") {
      // ElitBuzz: https://msg.elitbuzz-bd.com/smsapi
      const endpoint = config.apiEndpoint || "https://msg.elitbuzz-bd.com/smsapi";
      const url = new URL(endpoint);
      url.searchParams.set("api_key", config.apiKey);
      url.searchParams.set("type", config.unicode !== false ? "unicode" : "text");
      url.searchParams.set("contacts", bdFullNumber);
      if (config.senderId) {
        url.searchParams.set("senderid", config.senderId);
      }
      url.searchParams.set("msg", messageText);

      const res = await fetch(url.toString(), {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      });
      const bodyText = await res.text();
      const isSuccess = res.ok && !bodyText.toLowerCase().includes("error");

      return {
        success: isSuccess,
        rawResponse: bodyText,
        statusCode: res.status,
      };
    } else {
      // Custom Generic API
      const apiKeyParam = config.apiKeyParamName || "api_key";
      const phoneParam = config.phoneParamName || "contacts";
      const msgParam = config.messageParamName || "msg";
      const senderIdParam = config.senderIdParamName || "senderid";

      if (config.httpMethod === "POST_JSON") {
        let bodyData: any = {
          [apiKeyParam]: config.apiKey,
          [phoneParam]: bdFullNumber,
          [msgParam]: messageText,
        };
        if (config.senderId) {
          bodyData[senderIdParam] = config.senderId;
        }
        if (config.extraParams) {
          bodyData = { ...bodyData, ...config.extraParams };
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(config.customHeaders || {}),
        };

        const res = await fetch(config.apiEndpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(bodyData),
          signal: AbortSignal.timeout(10000),
        });
        const bodyText = await res.text();
        return {
          success: res.ok,
          rawResponse: bodyText,
          statusCode: res.status,
        };
      } else if (config.httpMethod === "POST_FORM") {
        const formData = new URLSearchParams();
        formData.append(apiKeyParam, config.apiKey);
        formData.append(phoneParam, bdFullNumber);
        formData.append(msgParam, messageText);
        if (config.senderId) {
          formData.append(senderIdParam, config.senderId);
        }
        if (config.extraParams) {
          for (const [k, v] of Object.entries(config.extraParams)) {
            formData.append(k, v);
          }
        }

        const res = await fetch(config.apiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            ...(config.customHeaders || {}),
          },
          body: formData.toString(),
          signal: AbortSignal.timeout(10000),
        });
        const bodyText = await res.text();
        return {
          success: res.ok,
          rawResponse: bodyText,
          statusCode: res.status,
        };
      } else {
        // GET Request
        const url = new URL(config.apiEndpoint);
        url.searchParams.set(apiKeyParam, config.apiKey);
        url.searchParams.set(phoneParam, bdFullNumber);
        url.searchParams.set(msgParam, messageText);
        if (config.senderId) {
          url.searchParams.set(senderIdParam, config.senderId);
        }
        if (config.extraParams) {
          for (const [k, v] of Object.entries(config.extraParams)) {
            url.searchParams.set(k, v);
          }
        }

        const res = await fetch(url.toString(), {
          method: "GET",
          headers: config.customHeaders || {},
          signal: AbortSignal.timeout(10000),
        });
        const bodyText = await res.text();
        return {
          success: res.ok,
          rawResponse: bodyText,
          statusCode: res.status,
        };
      }
    }
  } catch (err: any) {
    return {
      success: false,
      rawResponse: err.message || "Connection timeout / Network Error",
      statusCode: 500,
      error: err.message,
    };
  }
}
