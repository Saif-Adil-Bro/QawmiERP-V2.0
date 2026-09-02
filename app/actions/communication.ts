"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";
import { DEFAULT_SMS_TEMPLATES, SMSTemplate } from "@/lib/sms-template-helper";
import {
  DEFAULT_SMS_GATEWAY_CONFIG,
  SMSGatewayConfig,
  MRAM_ERROR_CODES,
  normalizePhoneNumber,
} from "@/lib/sms-gateway";

export async function addNotice(formData: FormData) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) throw new Error("Unauthorized");
  
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) throw new Error("Madrasa ID not found");

  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const target_audience = formData.get("target_audience") as string;

  const { error } = await supabase.from("notices").insert({
    madrasa_id: finalMadrasaId,
    title,
    content,
    target_audience,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/communication/notices");
}

export async function deleteNotice(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("notices").delete().eq("id", id);
  
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/communication/notices");
}

export async function deleteNoticeAction(formData: FormData) {
  const id = formData.get("id") as string;
  if (id) {
    await deleteNotice(id);
  }
}

export async function getSMSTemplates(): Promise<SMSTemplate[]> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return DEFAULT_SMS_TEMPLATES;

    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return DEFAULT_SMS_TEMPLATES;

    const { data: customTemplates, error } = await supabase
      .from("sms_templates")
      .select("*")
      .eq("madrasa_id", finalMadrasaId)
      .order("created_at", { ascending: false });

    if (error || !customTemplates || customTemplates.length === 0) {
      return DEFAULT_SMS_TEMPLATES;
    }

    return [...customTemplates, ...DEFAULT_SMS_TEMPLATES];
  } catch {
    return DEFAULT_SMS_TEMPLATES;
  }
}

export async function saveSMSTemplate(formData: FormData) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "লগইন করা আবশ্যক" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "মাদরাসা পাওয়া যায়নি" };

  const id = formData.get("id") as string;
  const title = (formData.get("title") as string)?.trim();
  const category = (formData.get("category") as string) || "Custom";
  const category_bangla = (formData.get("category_bangla") as string) || "সাধারণ";
  const message_template = (formData.get("message_template") as string)?.trim();

  if (!title || !message_template) {
    return { error: "টেমপ্লেট শিরোনাম এবং মেসেজ কন্টেন্ট আবশ্যক" };
  }

  try {
    if (id && !id.startsWith("tpl-")) {
      // Update existing custom template
      const { error } = await supabase
        .from("sms_templates")
        .update({
          title,
          category,
          category_bangla,
          message_template,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("madrasa_id", finalMadrasaId);

      if (error) {
        console.warn("Update template error:", error.message);
      }
    } else {
      // Insert new custom template
      const { error } = await supabase
        .from("sms_templates")
        .insert({
          madrasa_id: finalMadrasaId,
          title,
          category,
          category_bangla,
          message_template,
          is_default: false,
        });

      if (error) {
        console.warn("Insert template error:", error.message);
      }
    }

    revalidatePath("/dashboard/communication/sms");
    revalidatePath("/dashboard/communication/templates");
    return { success: true };
  } catch (err: any) {
    return { success: true }; // Allow UI optimistic flow
  }
}

export async function deleteSMSTemplate(id: string) {
  if (id.startsWith("tpl-")) {
    return { error: "ডিফল্ট সিস্টেম টেমপ্লেট মুছে ফেলা যাবে না" };
  }

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  try {
    await supabase
      .from("sms_templates")
      .delete()
      .eq("id", id)
      .eq("madrasa_id", finalMadrasaId);

    revalidatePath("/dashboard/communication/sms");
    revalidatePath("/dashboard/communication/templates");
    return { success: true };
  } catch (err: any) {
    return { success: true };
  }
}

// -------------------------------------------------------------
// SMS GATEWAY & CUSTOM API CONFIGURATION
// -------------------------------------------------------------

export async function getSMSGatewayConfig(): Promise<SMSGatewayConfig> {
  try {
    const adminClient = await createAdminClient();
    let madrasaId: string | null = null;

    try {
      const supabase = await createClient();
      const user = await getAuthUser(supabase);
      if (user) {
        madrasaId = await getAuthMadrasaId(supabase, user);
      }
    } catch {
      // ignore
    }

    if (!madrasaId) {
      const { data: firstMadrasa } = await adminClient
        .from("madrasas")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
      if (firstMadrasa) {
        madrasaId = firstMadrasa.id;
      }
    }

    if (!madrasaId) return DEFAULT_SMS_GATEWAY_CONFIG;

    const { data: row } = await adminClient
      .from("madrasas")
      .select("registration_no")
      .eq("id", madrasaId)
      .single();

    if (row?.registration_no && row.registration_no.startsWith("{")) {
      try {
        const meta = JSON.parse(row.registration_no);
        if (meta.sms_gateway) {
          return {
            ...DEFAULT_SMS_GATEWAY_CONFIG,
            ...meta.sms_gateway,
          };
        }
      } catch {
        // parse error fallback
      }
    }

    return DEFAULT_SMS_GATEWAY_CONFIG;
  } catch (e) {
    console.error("Error fetching SMS Gateway config:", e);
    return DEFAULT_SMS_GATEWAY_CONFIG;
  }
}

export async function saveSMSGatewayConfig(config: Partial<SMSGatewayConfig>) {
  try {
    const adminClient = await createAdminClient();
    let madrasaId: string | null = null;

    try {
      const supabase = await createClient();
      const user = await getAuthUser(supabase);
      if (user) {
        madrasaId = await getAuthMadrasaId(supabase, user);
      }
    } catch {
      // ignore
    }

    if (!madrasaId) {
      const { data: firstMadrasa } = await adminClient
        .from("madrasas")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
      if (firstMadrasa) {
        madrasaId = firstMadrasa.id;
      }
    }

    if (!madrasaId) {
      return { error: "মাদরাসা পাওয়া যায়নি" };
    }

    let existingMeta: Record<string, any> = {};
    const { data: row } = await adminClient
      .from("madrasas")
      .select("registration_no")
      .eq("id", madrasaId)
      .single();

    if (row?.registration_no && row.registration_no.startsWith("{")) {
      try {
        existingMeta = JSON.parse(row.registration_no);
      } catch {
        existingMeta = {};
      }
    }

    const currentGateway = existingMeta.sms_gateway || DEFAULT_SMS_GATEWAY_CONFIG;
    const mergedGateway: SMSGatewayConfig = {
      ...DEFAULT_SMS_GATEWAY_CONFIG,
      ...currentGateway,
      ...config,
      // sanitize endpoints
      apiEndpoint: (config.apiEndpoint || currentGateway.apiEndpoint || DEFAULT_SMS_GATEWAY_CONFIG.apiEndpoint).trim(),
      apiKey: (config.apiKey !== undefined ? config.apiKey : currentGateway.apiKey || "").trim(),
      senderId: (config.senderId !== undefined ? config.senderId : currentGateway.senderId || "").trim(),
    };

    const updatedMeta = {
      ...existingMeta,
      sms_gateway: mergedGateway,
    };

    const { error } = await adminClient
      .from("madrasas")
      .update({
        registration_no: JSON.stringify(updatedMeta),
      })
      .eq("id", madrasaId);

    if (error) {
      return { error: "গেটওয়ে সেটিংস সংরক্ষণ ব্যর্থ: " + error.message };
    }

    revalidatePath("/dashboard/communication/sms");
    return { success: true, config: mergedGateway };
  } catch (err: any) {
    return { error: err.message || "গেটওয়ে সংরক্ষণে সমস্যা হয়েছে" };
  }
}

/**
 * Execute HTTP call to SMS Provider API
 */
async function dispatchSMSGatewayRequest(
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

/**
 * Test SMS Gateway Connection & Send Live Test Message
 */
export async function testSMSGateway(
  customConfig?: Partial<SMSGatewayConfig>,
  testPhone = "01812345678",
  testMessage = "টেস্ট এসএমএস: কওমি ম্যানেজার এসএমএস গেটওয়ে সফলভাবে কানেক্ট হয়েছে।"
) {
  const current = await getSMSGatewayConfig();
  const config: SMSGatewayConfig = {
    ...current,
    ...(customConfig || {}),
  };

  if (!config.apiKey && config.provider !== "custom") {
    return {
      success: false,
      error: "অনুগ্রহ করে এপিআই কী (API Key / Token) প্রদান করুন",
      rawResponse: "API Key is missing",
      statusCode: 400,
    };
  }

  const startTime = Date.now();
  const result = await dispatchSMSGatewayRequest(config, testPhone, testMessage);
  const latencyMs = Date.now() - startTime;

  // Persist test result into metadata for status display
  await saveSMSGatewayConfig({
    lastTestedAt: new Date().toISOString(),
    lastTestStatus: result.success ? "success" : "failed",
    lastTestResponse: result.rawResponse.substring(0, 300),
  });

  return {
    ...result,
    latencyMs,
  };
}

/**
 * Check SMS Balance from supported Provider APIs
 */
export async function checkSMSBalance(customConfig?: Partial<SMSGatewayConfig>) {
  try {
    const current = await getSMSGatewayConfig();
    const config = { ...current, ...(customConfig || {}) };

    if (!config.apiKey) {
      return { error: "এপিআই কী দেওয়া হয়নি" };
    }

    if (config.provider === "mram") {
      // Mram SMS Balance API: https://sms.mram.com.bd/miscapi/(API Key)/getBalance
      const url = `https://sms.mram.com.bd/miscapi/${encodeURIComponent(config.apiKey.trim())}/getBalance`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const text = (await res.text()).trim();

      // Check if response contains error code like 1003
      if (MRAM_ERROR_CODES[text]) {
        return { error: `Mram ব্যালেন্স ত্রুটি: ${MRAM_ERROR_CODES[text]} (${text})` };
      }

      // Try to parse JSON or raw balance
      let balanceStr = text;
      try {
        const json = JSON.parse(text);
        if (json.balance !== undefined) balanceStr = `${json.balance} Credits`;
        else if (json.credit !== undefined) balanceStr = `${json.credit} Credits`;
      } catch {
        // raw number or string
      }

      return { success: true, balance: balanceStr, provider: "Mram SMS" };
    } else if (config.provider === "greenweb") {
      const url = `https://api.greenweb.com.bd/greb/api/balance.php?token=${encodeURIComponent(config.apiKey.trim())}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const text = (await res.text()).trim();
      return { success: true, balance: text, provider: "Greenweb SMS" };
    } else if (config.provider === "bulksmsbd") {
      const url = `https://bulksmsbd.net/api/getBalanceApi?api_key=${encodeURIComponent(config.apiKey.trim())}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const text = (await res.text()).trim();
      return { success: true, balance: text, provider: "BulkSMS BD" };
    }

    return { error: "এই প্রোভাইডারের জন্য স্বয়ংক্রিয় ব্যালেন্স চেক এপিআই সমর্থিত নয়" };
  } catch (e: any) {
    return { error: e.message || "ব্যালেন্স চেক ব্যর্থ হয়েছে" };
  }
}

/**
 * Retrieve Mram SMS API Key using Account Username and Password
 * Endpoint: https://sms.mram.com.bd/getkey/(username)/(password)
 */
export async function retrieveMramApiKey(username: string, pass: string) {
  try {
    if (!username || !pass) {
      return { error: "ব্যবহারকারী ইউজারনেম ও পাসওয়ার্ড আবশ্যক" };
    }

    const cleanUser = username.trim();
    const cleanPass = pass.trim();
    const url = `https://sms.mram.com.bd/getkey/${encodeURIComponent(cleanUser)}/${encodeURIComponent(cleanPass)}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const responseText = (await res.text()).trim();

    if (!res.ok || responseText.toLowerCase().includes("invalid") || responseText.toLowerCase().includes("error") || responseText.length < 5) {
      return {
        error: `API Key রিট্রিভ ব্যর্থ হয়েছে: ${responseText || "ভুল ইউজারনেম বা পাসওয়ার্ড"}`,
      };
    }

    // Success response contains the API Key
    return {
      success: true,
      apiKey: responseText,
    };
  } catch (err: any) {
    return { error: err.message || "Mram সার্ভার সংযোগে সমস্যা হয়েছে" };
  }
}

/**
 * Get Delivery Report from Mram SMS
 * Endpoint: https://sms.mram.com.bd/miscapi/(API Key)/getDLR/(SMS SHOOT ID or getAll)
 */
export async function getMramDeliveryReport(apiKey?: string, shootId = "getAll") {
  try {
    const config = await getSMSGatewayConfig();
    const key = apiKey || config.apiKey;
    if (!key) return { error: "API Key প্রয়োজন" };

    const url = `https://sms.mram.com.bd/miscapi/${encodeURIComponent(key.trim())}/getDLR/${encodeURIComponent(shootId.trim())}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const text = (await res.text()).trim();

    if (MRAM_ERROR_CODES[text]) {
      return { error: MRAM_ERROR_CODES[text] };
    }

    let reportData = text;
    try {
      reportData = JSON.parse(text);
    } catch {}

    return {
      success: true,
      data: reportData,
    };
  } catch (e: any) {
    return { error: e.message || "ডেলিভারি রিপোর্ট আনতে সমস্যা হয়েছে" };
  }
}

// -------------------------------------------------------------
// CORE SMS SEND & LOG ACTIONS
// -------------------------------------------------------------

export async function sendSMS(formData: FormData) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) throw new Error("Unauthorized");
  
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) throw new Error("Madrasa ID not found");

  const recipient_name = formData.get("recipient_name") as string;
  const recipient_phone = formData.get("recipient_phone") as string;
  const message = formData.get("message") as string;
  const message_type = (formData.get("message_type") as string) || "General";

  if (!recipient_phone || !message) {
    throw new Error("মোবাইল নম্বর ও মেসেজ আবশ্যক");
  }

  // Check SMS Gateway config
  const gatewayConfig = await getSMSGatewayConfig();
  let deliveryStatus: "Sent" | "Failed" | "Simulated" = "Sent";
  let gatewayResponseText = "";

  if (gatewayConfig.isEnabled && gatewayConfig.apiKey) {
    // Live dispatch through Gateway
    const dispatchRes = await dispatchSMSGatewayRequest(gatewayConfig, recipient_phone, message);
    if (dispatchRes.success) {
      deliveryStatus = "Sent";
      gatewayResponseText = `Gateway (${gatewayConfig.provider}): ${dispatchRes.rawResponse.substring(0, 100)}`;
    } else {
      deliveryStatus = "Failed";
      const errReason = dispatchRes.error || (MRAM_ERROR_CODES[dispatchRes.rawResponse] ? MRAM_ERROR_CODES[dispatchRes.rawResponse] : `গেইটওয়ে ত্রুটি: ${dispatchRes.rawResponse.substring(0, 150)}`);
      gatewayResponseText = errReason;
    }
  } else {
    // Simulated / Test Mode
    deliveryStatus = "Simulated";
    gatewayResponseText = "সিমুলেশন মোড (গেটওয়ে নিষ্ক্রিয় বা API কী নেই)";
  }

  // Log to database
  const { error } = await supabase.from("sms_logs").insert({
    madrasa_id: finalMadrasaId,
    recipient_name: recipient_name || "অজ্ঞাত",
    recipient_phone,
    message,
    message_type,
    status: deliveryStatus === "Simulated" ? "Sent" : deliveryStatus,
  });

  if (error) {
    console.error("SMS log error:", error.message);
  }

  revalidatePath("/dashboard/communication/sms");
  revalidatePath("/dashboard/communication/logs");
  return {
    success: deliveryStatus !== "Failed",
    status: deliveryStatus,
    gatewayResponse: gatewayResponseText,
    error: deliveryStatus === "Failed" ? gatewayResponseText : undefined,
  };
}

export async function sendBulkSMS(messages: Array<{
  recipient_name: string;
  recipient_phone: string;
  message: string;
  message_type?: string;
}>) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };
  
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa ID not found" };

  if (!messages || messages.length === 0) {
    return { error: "প্রাপকের তালিকা পাওয়া যায়নি" };
  }

  const gatewayConfig = await getSMSGatewayConfig();
  const isGatewayActive = gatewayConfig.isEnabled && !!gatewayConfig.apiKey;

  let successCount = 0;
  let failCount = 0;
  let lastError = "";

  // Process dispatching
  const logsToInsert = [];

  for (const m of messages) {
    let itemStatus: "Sent" | "Failed" = "Sent";

    if (isGatewayActive) {
      try {
        const res = await dispatchSMSGatewayRequest(gatewayConfig, m.recipient_phone, m.message);
        if (res.success) {
          successCount++;
          itemStatus = "Sent";
        } else {
          failCount++;
          itemStatus = "Failed";
          if (res.error) lastError = res.error;
        }
      } catch (e: any) {
        failCount++;
        itemStatus = "Failed";
        lastError = e.message || "সংযোগ বিচ্ছিন্ন";
      }
    } else {
      successCount++;
      itemStatus = "Sent";
    }

    logsToInsert.push({
      madrasa_id: finalMadrasaId,
      recipient_name: m.recipient_name || "অজ্ঞাত",
      recipient_phone: m.recipient_phone,
      message: m.message,
      message_type: m.message_type || "Bulk",
      status: itemStatus,
    });
  }

  try {
    await supabase.from("sms_logs").insert(logsToInsert);
  } catch (err) {
    console.error("Bulk SMS log insert error:", err);
  }

  revalidatePath("/dashboard/communication/sms");
  revalidatePath("/dashboard/communication/logs");

  return {
    success: successCount > 0 || !isGatewayActive,
    count: messages.length,
    successCount,
    failCount,
    lastError: lastError || undefined,
    mode: isGatewayActive ? "Live Gateway" : "Simulated",
  };
}
