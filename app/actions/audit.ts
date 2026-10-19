"use server";

import { toDhakaDateStringFrom, getDhakaYear } from "@/lib/date-utils";
import { writeGuard } from "@/lib/action-authorization";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";
import { parseExpenseFund, isVoidedExpense, isVoidDonation } from "@/lib/fund-utils";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import { getFeeMetadata } from "./fee-management";

const classifyAuditFund = (typeStr?: string, notesStr?: string, fundId?: string): "general" | "lillah" | "zakat" | "building" => {
  if (fundId) {
    const f = fundId.toLowerCase();
    if (f === "fund-zakat" || f.includes("zakat")) return "zakat";
    if (f === "fund-lillah" || f.includes("lillah")) return "lillah";
    if (f === "fund-dev" || f === "fund-building" || f.includes("building") || f.includes("dev")) return "building";
    if (f === "fund-general" || f.includes("general")) return "general";
  }
  const combined = `${typeStr || ""} ${notesStr || ""}`.toLowerCase();
  if (
    combined.includes("zakat") ||
    combined.includes("যাকাত") ||
    combined.includes("fitra") ||
    combined.includes("sadqah") ||
    combined.includes("ফিতরা") ||
    combined.includes("সদকা")
  ) {
    return "zakat";
  }
  if (
    combined.includes("lillah") ||
    combined.includes("লিল্লাহ") ||
    combined.includes("orphan") ||
    combined.includes("এতিম") ||
    combined.includes("খাবার") ||
    combined.includes("খোরাকি") ||
    combined.includes("বোর্ডিং") ||
    combined.includes("leather") ||
    combined.includes("চামড়া")
  ) {
    return "lillah";
  }
  if (
    combined.includes("building") ||
    combined.includes("মসজিদ") ||
    combined.includes("উন্নয়ন") ||
    combined.includes("নির্মাণ") ||
    combined.includes("dev")
  ) {
    return "building";
  }
  return "general";
};

export interface FundAuditSummary {
  fundId: string;
  fundName: string;
  fundArabicName: string;
  openingBalance: number;
  totalIncome: number;
  totalExpense: number;
  closingBalance: number;
  incomesByCategory: { category: string; amount: number }[];
  expensesByCategory: { category: string; amount: number }[];
}

export interface AuditSettings {
  openingBalances?: {
    general?: number;
    lillah?: number;
    zakat?: number;
    building?: number;
  };
  bankName?: string;
  accountNumber?: string;
  bankBalance?: number;
  cashInHand?: number;
  signatories?: {
    auditorName?: string;
    directorName?: string;
    principalName?: string;
    presidentName?: string;
  };
  hijriYear?: string;
}

export interface AnnualAuditStatement {
  fiscalYear: string;
  hijriYear: string;
  startDate: string;
  endDate: string;
  madrasaName: string;
  madrasaAddress: string;
  madrasaPhone?: string;
  logoUrl?: string;
  slogan?: string;
  registrationNo?: string;
  principalName?: string;
  signatories?: {
    auditorName?: string;
    directorName?: string;
    principalName?: string;
    presidentName?: string;
  };
  bankDetails?: {
    bankName: string;
    accountNumber?: string;
    bankBalance: number;
  };
  auditConfig?: AuditSettings;
  funds: {
    generalFund: FundAuditSummary;
    lillahFund: FundAuditSummary;
    zakatFund: FundAuditSummary;
    buildingFund: FundAuditSummary;
  };
  grandTotal: {
    openingBalance: number;
    totalIncome: number;
    totalExpense: number;
    netSurplus: number;
    closingBalance: number;
    cashInHand: number;
    bankBalance: number;
  };
  incomeBreakdown: { category: string; amount: number; percentage: number }[];
  expenseBreakdown: { category: string; amount: number; percentage: number }[];
}

export async function saveAuditSettings(
  year: string,
  settings: AuditSettings
): Promise<{ success: boolean; error?: string }> {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("generic");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { success: false, error: "অননুমোদিত ব্যবহারকারী" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { success: false, error: "মাদরাসা আইডি পাওয়া যায়নি" };

    const meta: any = await getMadrasaMetadata(madrasaId);
    if (!meta.audit_settings) {
      meta.audit_settings = {};
    }
    meta.audit_settings[year] = {
      ...(meta.audit_settings[year] || {}),
      ...settings,
    };

    const saved = await saveMadrasaMetadata(madrasaId, meta);
    if (!saved) {
      return { success: false, error: "সেটিংস সংরক্ষণ করা যায়নি" };
    }

    revalidatePath("/dashboard/accounting/audit");
    return { success: true };
  } catch (err: any) {
    console.error("Error saving audit settings:", err);
    return { success: false, error: err.message || "ব্যর্থ হয়েছে" };
  }
}

export async function getAnnualAuditStatement(
  year: string = String(getDhakaYear()),
  startDateCustom?: string,
  endDateCustom?: string
): Promise<AnnualAuditStatement | null> {
  const supabase = await createClient();
  const adminClient = await createAdminClient();
  const user = await getAuthUser(supabase);
  if (!user) return null;

  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) return null;

  const startDate = startDateCustom || `${year}-01-01`;
  const endDate = endDateCustom || `${year}-12-31`;

  // 1. Fetch Madrasa info & metadata
  const { data: madrasa } = await adminClient
    .from("madrasas")
    .select("*")
    .eq("id", madrasaId)
    .single();

  const [meta, feeMeta] = await Promise.all([
    getMadrasaMetadata(madrasaId),
    getFeeMetadata(madrasaId),
  ]);
  const auditSettings: AuditSettings = (meta as any).audit_settings?.[year] || {};

  // 2. Fetch all student fee payments from relational fee tables via getFeeMetadata
  const feePayments = (feeMeta.payments || []).filter(
    (p: any) => p.status !== "REVERSED" && p.status !== "VOID"
  );

  // 3. Fetch all donations (Income: General, Lillah, Zakat, Building)
  const { data: donationsData, error: donErr } = await adminClient
    .from("donations")
    .select("*")
    .eq("madrasa_id", madrasaId)
    .gte("donation_date", startDate)
    .lte("donation_date", endDate);

  if (donErr) {
    console.error("Error fetching donations in audit:", donErr);
  }

  // 4. Fetch general expenses
  const { data: expensesData } = await adminClient
    .from("expenses")
    .select("*")
    .eq("madrasa_id", madrasaId)
    .gte("expense_date", startDate)
    .lte("expense_date", endDate);

  // 5. Fetch Bazar expenses (Lillah boarding food)
  const { data: bazarData } = await adminClient
    .from("bazar_expenses")
    .select("*")
    .eq("madrasa_id", madrasaId)
    .gte("expense_date", startDate)
    .lte("expense_date", endDate);

  // 6. Calculate Prior Period Balances (prior to startDate) for dynamic opening balance calculation
  let priorGenOpening = 0;
  let priorLilOpening = 0;
  let priorZakOpening = 0;
  let priorBldOpening = 0;

  try {
    const [priorDonationsRes, priorExpRes, priorBazarRes] = await Promise.all([
      adminClient.from("donations").select("*").eq("madrasa_id", madrasaId).lt("donation_date", startDate),
      adminClient.from("expenses").select("amount, description, category").eq("madrasa_id", madrasaId).lt("expense_date", startDate),
      adminClient.from("bazar_expenses").select("amount, items_details").eq("madrasa_id", madrasaId).lt("expense_date", startDate),
    ]);

    let pGenIn = 0, pLilIn = 0, pZakIn = 0, pBldIn = 0;
    let pGenEx = 0, pLilEx = 0, pZakEx = 0, pBldEx = 0;

    // Prior fee payments from relational fee tables
    feePayments.forEach((p: any) => {
      const pDate = p.payment_date || (p.created_at ? toDhakaDateStringFrom(p.created_at) : "");
      if (pDate && pDate < startDate) {
        if (p.allocations && p.allocations.length > 0) {
          let allocatedSum = 0;
          p.allocations.forEach((alloc: any) => {
            const amt = Number(alloc.allocated_amount || 0);
            if (amt <= 0) return;
            allocatedSum += amt;
            const targetFundId = alloc.fund_id || p.fund_id;
            if (targetFundId === "fund-lillah") {
              pLilIn += amt;
            } else if (targetFundId) {
              pGenIn += amt;
            } else {
              const name = alloc.fee_type_name || "মাসিক বেতন";
              const combined = `${name} ${p.notes || ""}`.toLowerCase();
              if (combined.includes("বোর্ডিং") || combined.includes("খাবার") || combined.includes("hostel") || combined.includes("lillah")) {
                pLilIn += amt;
              } else {
                pGenIn += amt;
              }
            }
          });
          const extraAdvance = Number(p.advance_amount || 0);
          const fineTotal = Number(p.fine_total || 0);
          const totalRec = Number(p.total_amount_received || 0);
          const remainder = Math.max(0, totalRec - allocatedSum);
          const extra = (extraAdvance + fineTotal > 0) ? (extraAdvance + fineTotal) : remainder;
          if (extra > 0) {
            pGenIn += extra;
          }
        } else {
          const amt = Number(p.total_amount_received || 0);
          const notes = (p.notes || "").toLowerCase();
          const type = ((p.allocations?.[0]?.fee_type_name || "") + " " + notes).toLowerCase();
          if (type.includes("বোর্ডিং") || type.includes("খাবার") || type.includes("hostel")) {
            pLilIn += amt;
          } else {
            pGenIn += amt;
          }
        }
      }
    });



    (priorDonationsRes.data || []).forEach((d: any) => {
      if (isVoidDonation(d)) return;
      const amt = Number(d.amount || 0);
      const target = classifyAuditFund(d.donation_type, d.notes, d.fund_id);
      if (target === "zakat") pZakIn += amt;
      else if (target === "lillah") pLilIn += amt;
      else if (target === "building") pBldIn += amt;
      else pGenIn += amt;
    });

    // Prior Metadata Revenue Streams (prior to startDate)
    const priorDonationKeys = new Set<string>();
    (priorDonationsRes.data || []).forEach((d: any) => {
      if (d.id) priorDonationKeys.add(d.id);
      if (d.receipt_no) priorDonationKeys.add(d.receipt_no);
    });

    // Prior Subscriptions
    (meta.donor_subscription_payments || []).forEach((sp: any) => {
      const d = sp.payment_date || sp.date || (sp.created_at ? toDhakaDateStringFrom(sp.created_at) : "");
      const k = sp.id || sp.receipt_no;
      if (d && d < startDate && !priorDonationKeys.has(k)) {
        const amt = Number(sp.amount || 0);
        const target = classifyAuditFund(sp.fund_name || sp.fund_category, sp.notes);
        if (target === "zakat") pZakIn += amt;
        else if (target === "lillah") pLilIn += amt;
        else if (target === "building") pBldIn += amt;
        else pGenIn += amt;
      }
    });

    // Prior Donation Boxes
    (meta.donation_box_logs || []).forEach((bl: any) => {
      const d = bl.collection_date || bl.date || (bl.created_at ? toDhakaDateStringFrom(bl.created_at) : "");
      const k = bl.receipt_no || bl.id;
      if (d && d < startDate && !priorDonationKeys.has(k)) {
        const amt = Number(bl.amount || 0);
        const target = classifyAuditFund(bl.fund_name, bl.notes);
        if (target === "zakat") pZakIn += amt;
        else if (target === "lillah") pLilIn += amt;
        else if (target === "building") pBldIn += amt;
        else pGenIn += amt;
      }
    });

    // Prior Online Donations
    (meta.online_donations || []).forEach((od: any) => {
      if (od.status === "COMPLETED" || od.status === "VERIFIED" || od.status === "SUCCESS") {
        const dt = od.payment_date || (od.created_at ? toDhakaDateStringFrom(od.created_at) : "");
        const k = od.receipt_no || od.transaction_id || od.id;
        if (dt && dt < startDate && !priorDonationKeys.has(k)) {
          const amt = Number(od.amount || 0);
          const target = classifyAuditFund(od.fund_category || od.fund_name || od.purpose, od.notes);
          if (target === "zakat") pZakIn += amt;
          else if (target === "lillah") pLilIn += amt;
          else if (target === "building") pBldIn += amt;
          else pGenIn += amt;
        }
      }
    });

    // Prior Qurbani Leather
    (meta.qurbani_leather_records || meta.leather_batches || []).forEach((lr: any) => {
      const d = lr.collection_date || lr.sale_date || lr.date || (lr.created_at ? toDhakaDateStringFrom(lr.created_at) : "");
      const k = lr.receipt_no || lr.id;
      if (d && d < startDate && !priorDonationKeys.has(k)) {
        const inc = Number(lr.received_amount || lr.total_sale_price || lr.total_sale_amount || 0);
        const exp = Number(lr.transport_labour_cost || lr.transport_labor_cost || 0);
        if (inc > 0) pLilIn += inc;
        if (exp > 0) pLilEx += exp;
      }
    });

    (priorExpRes.data || []).forEach((e: any) => {
      if (isVoidedExpense(e)) return;
      const amt = Number(e.amount || 0);
      const parsed = parseExpenseFund(e.description);
      const fund = (parsed.fundId || "").toLowerCase();
      if (fund.includes("zakat") || fund.includes("যাকাত")) pZakEx += amt;
      else if (fund.includes("lillah") || fund.includes("লিল্লাহ") || fund.includes("orphan") || fund.includes("এতিম")) pLilEx += amt;
      else if (fund.includes("building") || fund.includes("উন্নয়ন")) pBldEx += amt;
      else pGenEx += amt;
    });

    (priorBazarRes.data || []).forEach((b: any) => {
      const amt = Number(b.amount || 0);
      pLilEx += amt;
    });

    priorGenOpening = pGenIn - pGenEx;
    priorLilOpening = pLilIn - pLilEx;
    priorZakOpening = pZakIn - pZakEx;
    priorBldOpening = pBldIn - pBldEx;
  } catch (err) {
    console.error("Error calculating prior balances:", err);
  }

  // Determine Opening Balances:
  // User configured settings take precedence, otherwise dynamically computed prior balance (defaulting to 0)
  const configuredOpenings = auditSettings.openingBalances || {};
  const genOpening = configuredOpenings.general !== undefined ? Number(configuredOpenings.general) : priorGenOpening;
  const lilOpening = configuredOpenings.lillah !== undefined ? Number(configuredOpenings.lillah) : priorLilOpening;
  const zakOpening = configuredOpenings.zakat !== undefined ? Number(configuredOpenings.zakat) : priorZakOpening;
  const bldOpening = configuredOpenings.building !== undefined ? Number(configuredOpenings.building) : priorBldOpening;

  // 7. Fund Buckets
  const generalIncomes: { category: string; amount: number }[] = [];
  const generalExpenses: { category: string; amount: number }[] = [];

  const lillahIncomes: { category: string; amount: number }[] = [];
  const lillahExpenses: { category: string; amount: number }[] = [];

  const zakatIncomes: { category: string; amount: number }[] = [];
  const zakatExpenses: { category: string; amount: number }[] = [];

  const buildingIncomes: { category: string; amount: number }[] = [];
  const buildingExpenses: { category: string; amount: number }[] = [];

  // Helper to add into category bucket
  const addCategoryAmount = (
    list: { category: string; amount: number }[],
    cat: string,
    amount: number
  ) => {
    const existing = list.find((item) => item.category === cat);
    if (existing) {
      existing.amount += amount;
    } else {
      list.push({ category: cat, amount });
    }
  };

  const isDateInRange = (dStr?: string): boolean => {
    if (!dStr) return false;
    const cleanDate = dStr.includes("T") ? toDhakaDateStringFrom(dStr) : dStr.trim();
    return cleanDate >= startDate && cleanDate <= endDate;
  };

  // Track database donation IDs/receipts to avoid double-counting metadata streams
  const trackedDonationKeys = new Set<string>();
  (donationsData || []).forEach((d: any) => {
    if (d.id) trackedDonationKeys.add(d.id);
    if (d.receipt_no) trackedDonationKeys.add(d.receipt_no);
    const rMatch = d.notes?.match(/\[(?:চালান|রিসিট|কুরবানির চামড়া বিক্রয়|দানবাক্স কালেকশন):\s*([^\]|,]+)/)?.[1];
    if (rMatch) trackedDonationKeys.add(rMatch.trim());
  });

  // Process Fees from Relational Tables
  feePayments.forEach((p: any) => {
    const pDate = p.payment_date || (p.created_at ? toDhakaDateStringFrom(p.created_at) : "");
    if (pDate && pDate >= startDate && pDate <= endDate) {
      if (p.allocations && p.allocations.length > 0) {
        let allocatedSum = 0;
        p.allocations.forEach((alloc: any) => {
          const amt = Number(alloc.allocated_amount || 0);
          if (amt <= 0) return;
          allocatedSum += amt;
          const targetFundId = alloc.fund_id || p.fund_id;
          const name = alloc.fee_type_name || "মাসিক বেতন ও ভর্তি ফি";
          if (targetFundId === "fund-lillah") {
            addCategoryAmount(lillahIncomes, "ছাত্র বোর্ডিং ও খাবার ফি", amt);
          } else if (targetFundId) {
            addCategoryAmount(generalIncomes, name, amt);
          } else {
            const combined = `${name} ${p.notes || ""}`.toLowerCase();
            if (combined.includes("বোর্ডিং") || combined.includes("খাবার") || combined.includes("hostel")) {
              addCategoryAmount(lillahIncomes, "ছাত্র বোর্ডিং ও খাবার ফি", amt);
            } else {
              addCategoryAmount(generalIncomes, name, amt);
            }
          }
        });
        const extraAdvance = Number(p.advance_amount || 0);
        const fineTotal = Number(p.fine_total || 0);
        const totalReceived = Number(p.total_amount_received || 0);
        const remainder = Math.max(0, totalReceived - allocatedSum);
        const extraIncome = (extraAdvance + fineTotal > 0) ? (extraAdvance + fineTotal) : remainder;
        if (extraIncome > 0) {
          addCategoryAmount(generalIncomes, "অতিরিক্ত / জরিমানা / অগ্রিম ফি", extraIncome);
        }
      } else {
        const amt = Number(p.total_amount_received || 0);
        const combined = `${p.notes || ""}`.toLowerCase();
        if (combined.includes("বোর্ডিং") || combined.includes("খাবার") || combined.includes("hostel")) {
          addCategoryAmount(lillahIncomes, "ছাত্র বোর্ডিং ও খাবার ফি", amt);
        } else {
          addCategoryAmount(generalIncomes, "মাসিক বেতন ও ভর্তি ফি", amt);
        }
      }
    }
  });

  // Process Database Donations
  (donationsData || []).forEach((don: any) => {
    if (isVoidDonation(don)) return;
    const amt = Number(don.amount || 0);
    const target = classifyAuditFund(don.donation_type, don.notes, don.fund_id);
    const label = don.donation_type || "দান / অনুদান";
    const combined = `${don.donation_type || ""} ${don.notes || ""}`.toLowerCase();

    if (target === "zakat") {
      const catName = combined.includes("ফিতরা") || combined.includes("fitra") || combined.includes("সদকা")
        ? (label.includes("ফিতরা") ? label : `ফিতরা ও সদকা তহবিল (${label})`)
        : (label.includes("যাকাত") ? label : `যাকাত তহবিল (${label})`);
      addCategoryAmount(zakatIncomes, catName, amt);
    } else if (target === "lillah") {
      const catName = combined.includes("এতিম") || combined.includes("orphan")
        ? (label.includes("এতিম") ? label : `এতিম কল্যাণ তহবিল (${label})`)
        : (label.includes("লিল্লাহ") ? label : `লিল্লাহ তহবিল (${label})`);
      addCategoryAmount(lillahIncomes, catName, amt);
    } else if (target === "building") {
      addCategoryAmount(buildingIncomes, label.includes("উন্নয়ন") || label.includes("নির্মাণ") ? label : `উন্নয়ন ও নির্মাণ (${label})`, amt);
    } else {
      addCategoryAmount(generalIncomes, label, amt);
    }
  });

  // Process Mahfil Receipts & Direct Transactions from Metadata
  const mahfils = meta.mahfils || [];
  mahfils.forEach((m: any) => {
    const isSettled = Boolean(m.settlement || (m.settlements && m.settlements.length > 0));

    if (!isSettled) {
      const books = m.receipt_books || [];
      books.forEach((bk: any) => {
        const target = classifyAuditFund(bk.category, bk.receipt_type || "মাহফিল রসিদ বই আদায়");
        if (Array.isArray(bk.deposit_history) && bk.deposit_history.length > 0) {
          bk.deposit_history.forEach((dep: any) => {
            const recNo = dep.receipt_no || bk.receipt_no || dep.id;
            if (isDateInRange(dep.date) && !trackedDonationKeys.has(recNo)) {
              const amt = Number(dep.amount || 0);
              if (target === "lillah") addCategoryAmount(lillahIncomes, "মাহফিল কালেকশন (লিল্লাহ)", amt);
              else if (target === "zakat") addCategoryAmount(zakatIncomes, "মাহফিল কালেকশন (যাকাত)", amt);
              else if (target === "building") addCategoryAmount(buildingIncomes, "মাহফিল কালেকশন (উন্নয়ন)", amt);
              else addCategoryAmount(generalIncomes, "মাহফিল কালেকশন (সাধারণ)", amt);
            }
          });
        } else if (Number(bk.total_collected || 0) > 0) {
          const d = bk.return_date || bk.issued_date || m.start_date || "";
          const recNo = bk.receipt_no || bk.id;
          if (isDateInRange(d) && !trackedDonationKeys.has(recNo)) {
            const amt = Number(bk.total_collected || 0);
            if (target === "lillah") addCategoryAmount(lillahIncomes, "মাহফিল কালেকশন (লিল্লাহ)", amt);
            else if (target === "zakat") addCategoryAmount(zakatIncomes, "মাহফিল কালেকশন (যাকাত)", amt);
            else if (target === "building") addCategoryAmount(buildingIncomes, "মাহফিল কালেকশন (উন্নয়ন)", amt);
            else addCategoryAmount(generalIncomes, "মাহফিল কালেকশন (সাধারণ)", amt);
          }
        }
      });
    }

    const txns = m.transactions || [];
    txns.forEach((t: any) => {
      const d = t.date || m.start_date || "";
      const tKey = t.id || t.voucher_no;
      const isInternalSettlement =
        (t.id && t.id.startsWith("txn_settle")) ||
        (t.category && (t.category.includes("উদ্বৃত্ত") || t.category.includes("স্থানান্তর"))) ||
        (t.description && (t.description.includes("উদ্বৃত্ত") || t.description.includes("স্থানান্তর")));

      if (isInternalSettlement) return;

      if (isDateInRange(d)) {
        if (t.type === "INCOME" && !isSettled && !trackedDonationKeys.has(tKey)) {
          const target = classifyAuditFund(t.category, t.description);
          const amt = Number(t.amount || 0);
          if (target === "lillah") addCategoryAmount(lillahIncomes, "মাহফিল দান ও অনুদান", amt);
          else if (target === "zakat") addCategoryAmount(zakatIncomes, "মাহফিল যাকাত অনুদান", amt);
          else if (target === "building") addCategoryAmount(buildingIncomes, "মাহফিল উন্নয়ন অনুদান", amt);
          else addCategoryAmount(generalIncomes, "মাহফিল সাধারণ অনুদান", amt);
        } else if (t.type === "EXPENSE" && !isSettled) {
          const parsed = parseExpenseFund(t.description || t.category);
          const fId = (parsed.fundId || "").toLowerCase();
          const amt = Number(t.amount || 0);
          if (fId.includes("lillah")) addCategoryAmount(lillahExpenses, "মাহফিল ব্যয় (লিল্লাহ)", amt);
          else if (fId.includes("zakat")) addCategoryAmount(zakatExpenses, "মাহফিল ব্যয় (যাকাত)", amt);
          else if (fId.includes("building")) addCategoryAmount(buildingExpenses, "মাহফিল প্যান্ডেল ও মঞ্চ নির্মাণ", amt);
          else addCategoryAmount(generalExpenses, "মাহফিল পরিচালনা ও বক্তা হাদিয়া", amt);
        }
      }
    });
  });

  // Process Donor Subscriptions from Metadata
  (meta.donor_subscription_payments || []).forEach((p: any) => {
    const d = p.payment_date || p.date || (p.created_at ? toDhakaDateStringFrom(p.created_at) : "");
    const pKey = p.id || p.receipt_no;
    if (isDateInRange(d) && !trackedDonationKeys.has(pKey)) {
      const amt = Number(p.amount || 0);
      const target = classifyAuditFund(p.fund_name || p.fund_category, p.notes);
      const catLabel = p.member_type === "LIFE_MEMBER" ? "আজীবন সদস্য অনুদান" : "মাসিক চাঁদা / সদস্য অনুদান";
      if (target === "zakat") addCategoryAmount(zakatIncomes, `যাকাত সদস্য চাঁদা (${catLabel})`, amt);
      else if (target === "lillah") addCategoryAmount(lillahIncomes, `লিল্লাহ সদস্য চাঁদা (${catLabel})`, amt);
      else if (target === "building") addCategoryAmount(buildingIncomes, `উন্নয়ন সদস্য চাঁদা (${catLabel})`, amt);
      else addCategoryAmount(generalIncomes, catLabel, amt);
    }
  });

  // Process Donation Box Collections from Metadata
  (meta.donation_box_logs || []).forEach((l: any) => {
    const d = l.collection_date || l.date || (l.created_at ? toDhakaDateStringFrom(l.created_at) : "");
    const lKey = l.receipt_no || l.id;
    if (isDateInRange(d) && !trackedDonationKeys.has(lKey)) {
      const amt = Number(l.amount || 0);
      const target = classifyAuditFund(l.fund_name, l.notes);
      if (target === "zakat") addCategoryAmount(zakatIncomes, "দানবাক্স কালেকশন (যাকাত)", amt);
      else if (target === "lillah") addCategoryAmount(lillahIncomes, "দানবাক্স কালেকশন (লিল্লাহ)", amt);
      else if (target === "building") addCategoryAmount(buildingIncomes, "দানবাক্স কালেকশন (উন্নয়ন)", amt);
      else addCategoryAmount(generalIncomes, "দানবাক্স কালেকশন (সাধারণ)", amt);
    }
  });

  // Process Online Donations from Metadata
  (meta.online_donations || []).forEach((od: any) => {
    if (od.status === "COMPLETED" || od.status === "VERIFIED" || od.status === "SUCCESS") {
      const dt = od.payment_date || (od.created_at ? toDhakaDateStringFrom(od.created_at) : "");
      const dKey = od.receipt_no || od.transaction_id || od.id;
      if (isDateInRange(dt) && !trackedDonationKeys.has(dKey)) {
        const amt = Number(od.amount || 0);
        const target = classifyAuditFund(od.fund_category || od.fund_name || od.purpose, od.notes);
        if (target === "zakat") addCategoryAmount(zakatIncomes, "অনলাইন অনুদান (যাকাত)", amt);
        else if (target === "lillah") addCategoryAmount(lillahIncomes, "অনলাইন অনুদান (লিল্লাহ)", amt);
        else if (target === "building") addCategoryAmount(buildingIncomes, "অনলাইন অনুদান (উন্নয়ন)", amt);
        else addCategoryAmount(generalIncomes, "অনলাইন অনুদান (সাধারণ)", amt);
      }
    }
  });

  // Process Qurbani Leather Records from Metadata
  (meta.qurbani_leather_records || meta.leather_batches || []).forEach((lr: any) => {
    const d = lr.collection_date || lr.sale_date || lr.date || (lr.created_at ? toDhakaDateStringFrom(lr.created_at) : "");
    const rKey = lr.receipt_no || lr.id;
    if (isDateInRange(d) && !trackedDonationKeys.has(rKey)) {
      const inc = Number(lr.received_amount || lr.total_sale_price || lr.total_sale_amount || 0);
      const exp = Number(lr.transport_labour_cost || lr.transport_labor_cost || 0);
      if (inc > 0) addCategoryAmount(lillahIncomes, "কুরবানির চামড়া বিক্রয়লব্ধ তহবিল", inc);
      if (exp > 0) addCategoryAmount(lillahExpenses, "কুরবানির চামড়া পরিবহন ও শ্রমিক মজুরি", exp);
    }
  });

  // Process Expenses
  (expensesData || []).forEach((exp: any) => {
    if (isVoidedExpense(exp)) return;
    const amt = Number(exp.amount || 0);
    const explicitFundId = exp.fund_id ? String(exp.fund_id).toLowerCase() : "";
    const parsed = parseExpenseFund(exp.description);
    const fund = explicitFundId || (parsed.fundId || "").toLowerCase();
    const cat = exp.category || "অন্যান্য পরিচালনা ব্যয়";

    if (fund.includes("zakat") || fund.includes("যাকাত")) {
      addCategoryAmount(zakatExpenses, cat, amt);
    } else if (fund.includes("lillah") || fund.includes("লিল্লাহ")) {
      addCategoryAmount(lillahExpenses, cat, amt);
    } else if (fund.includes("building") || fund.includes("উন্নয়ন")) {
      addCategoryAmount(buildingExpenses, cat, amt);
    } else {
      addCategoryAmount(generalExpenses, cat, amt);
    }
  });

  // Process Bazar Expenses (Boarding Mess)
  (bazarData || []).forEach((bazar: any) => {
    const amt = Number(bazar.amount || 0);
    const details = (bazar.items_details || "").toLowerCase();
    if (details.includes("fund-zakat") || details.includes("যাকাত")) {
      addCategoryAmount(zakatExpenses, "লিল্লাহ বোর্ডিং খাদ্য সামগ্রী (বাজার)", amt);
    } else {
      addCategoryAmount(lillahExpenses, "লিল্লাহ বোর্ডিং খাদ্য সামগ্রী (বাজার)", amt);
    }
  });

  // Calculate totals for each fund
  const sumList = (list: { category: string; amount: number }[]) =>
    list.reduce((acc, curr) => acc + curr.amount, 0);

  const genTotalIn = sumList(generalIncomes);
  const genTotalEx = sumList(generalExpenses);

  const lilTotalIn = sumList(lillahIncomes);
  const lilTotalEx = sumList(lillahExpenses);

  const zakTotalIn = sumList(zakatIncomes);
  const zakTotalEx = sumList(zakatExpenses);

  const bldTotalIn = sumList(buildingIncomes);
  const bldTotalEx = sumList(buildingExpenses);

  const totalOpening = genOpening + lilOpening + zakOpening + bldOpening;
  const totalIn = genTotalIn + lilTotalIn + zakTotalIn + bldTotalIn;
  const totalEx = genTotalEx + lilTotalEx + zakTotalEx + bldTotalEx;
  const totalClosing = totalOpening + totalIn - totalEx;

  // Bank & Cash reconciliation
  const bankBalance = auditSettings.bankBalance !== undefined ? Number(auditSettings.bankBalance) : 0;
  const cashInHand = auditSettings.cashInHand !== undefined 
    ? Number(auditSettings.cashInHand) 
    : Math.max(0, totalClosing - bankBalance);

  // Breakdown percentages
  const grandIncomesAll = [
    ...generalIncomes,
    ...lillahIncomes,
    ...zakatIncomes,
    ...buildingIncomes,
  ];
  const grandExpensesAll = [
    ...generalExpenses,
    ...lillahExpenses,
    ...zakatExpenses,
    ...buildingExpenses,
  ];

  const incomeBreakdown = grandIncomesAll.map((item) => ({
    category: item.category,
    amount: item.amount,
    percentage: totalIn > 0 ? Math.round((item.amount / totalIn) * 100) : 0,
  }));

  const expenseBreakdown = grandExpensesAll.map((item) => ({
    category: item.category,
    amount: item.amount,
    percentage: totalEx > 0 ? Math.round((item.amount / totalEx) * 100) : 0,
  }));

  const hijriYear = auditSettings.hijriYear || "১৪৪৭-৪৮ হিজরি";
  const madrasaInfo = await getMadrasaInfo(madrasaId);
  const realPrincipal = auditSettings.signatories?.principalName || madrasaInfo.principal_name || meta?.principal_name || madrasa?.principal_name || "মুহতামিম";

  return {
    fiscalYear: year,
    hijriYear,
    startDate,
    endDate,
    madrasaName: madrasaInfo.name || madrasa?.name || "মাদরাসা",
    madrasaAddress: madrasaInfo.address || madrasa?.address || "",
    madrasaPhone: madrasaInfo.phone || madrasa?.contact_phone || "",
    logoUrl: madrasaInfo.logo_url || "",
    slogan: madrasaInfo.slogan || "",
    registrationNo: madrasaInfo.registration_no || madrasaInfo.reg_no || (typeof madrasa?.registration_no === "string" && !madrasa.registration_no.startsWith("{") ? madrasa.registration_no : ""),
    principalName: realPrincipal,
    signatories: {
      auditorName: auditSettings.signatories?.auditorName || "অভ্যন্তরীণ অডিট শাখা",
      directorName: auditSettings.signatories?.directorName || "শিক্ষা পরিচালক",
      principalName: realPrincipal,
      presidentName: auditSettings.signatories?.presidentName || "মজলিসে শুরা ও কার্যনির্বাহী পরিষদ",
    },
    bankDetails: {
      bankName: auditSettings.bankName || "ব্যাংক হিসাব",
      accountNumber: auditSettings.accountNumber || "",
      bankBalance,
    },
    auditConfig: auditSettings,
    funds: {
      generalFund: {
        fundId: "fund-general",
        fundName: "সাধারণ ফান্ড (General Fund)",
        fundArabicName: "الصندوق العام",
        openingBalance: genOpening,
        totalIncome: genTotalIn,
        totalExpense: genTotalEx,
        closingBalance: genOpening + genTotalIn - genTotalEx,
        incomesByCategory: generalIncomes,
        expensesByCategory: generalExpenses,
      },
      lillahFund: {
        fundId: "fund-lillah",
        fundName: "লিল্লাহ বোর্ডিং ফান্ড (Lillah Boarding Fund)",
        fundArabicName: "صندوق دار الإطعام للفقراء",
        openingBalance: lilOpening,
        totalIncome: lilTotalIn,
        totalExpense: lilTotalEx,
        closingBalance: lilOpening + lilTotalIn - lilTotalEx,
        incomesByCategory: lillahIncomes,
        expensesByCategory: lillahExpenses,
      },
      zakatFund: {
        fundId: "fund-zakat",
        fundName: "যাকাত ও ফিতরা ফান্ড (Zakat & Fitra Fund)",
        fundArabicName: "صندوق الزكاة والصدقات الواجبة",
        openingBalance: zakOpening,
        totalIncome: zakTotalIn,
        totalExpense: zakTotalEx,
        closingBalance: zakOpening + zakTotalIn - zakTotalEx,
        incomesByCategory: zakatIncomes,
        expensesByCategory: zakatExpenses,
      },
      buildingFund: {
        fundId: "fund-building",
        fundName: "উন্নয়ন ও মসজিদ নির্মাণ ফান্ড (Development Fund)",
        fundArabicName: "صندوق التعمير والتطوير",
        openingBalance: bldOpening,
        totalIncome: bldTotalIn,
        totalExpense: bldTotalEx,
        closingBalance: bldOpening + bldTotalIn - bldTotalEx,
        incomesByCategory: buildingIncomes,
        expensesByCategory: buildingExpenses,
      },
    },
    grandTotal: {
      openingBalance: totalOpening,
      totalIncome: totalIn,
      totalExpense: totalEx,
      netSurplus: totalIn - totalEx,
      closingBalance: totalClosing,
      cashInHand,
      bankBalance,
    },
    incomeBreakdown,
    expenseBreakdown,
  };
}
