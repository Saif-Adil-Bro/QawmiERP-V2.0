"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";
import { parseExpenseFund } from "@/lib/fund-utils";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";

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
  year: string = new Date().getFullYear().toString(),
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

  const meta: any = await getMadrasaMetadata(madrasaId);
  const auditSettings: AuditSettings = meta.audit_settings?.[year] || {};

  // 2. Fetch all student fees (Income: General Fund / Hostel)
  const { data: feesData } = await adminClient
    .from("fees")
    .select("*")
    .eq("madrasa_id", madrasaId)
    .gte("payment_date", startDate)
    .lte("payment_date", endDate);

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
    const [priorFeesRes, priorDonationsRes, priorExpRes, priorBazarRes] = await Promise.all([
      adminClient.from("fees").select("amount, fee_type, notes").eq("madrasa_id", madrasaId).lt("payment_date", startDate),
      adminClient.from("donations").select("*").eq("madrasa_id", madrasaId).lt("donation_date", startDate),
      adminClient.from("expenses").select("amount, description, category").eq("madrasa_id", madrasaId).lt("expense_date", startDate),
      adminClient.from("bazar_expenses").select("amount, items_details").eq("madrasa_id", madrasaId).lt("expense_date", startDate),
    ]);

    let pGenIn = 0, pLilIn = 0, pZakIn = 0, pBldIn = 0;
    let pGenEx = 0, pLilEx = 0, pZakEx = 0, pBldEx = 0;

    (priorFeesRes.data || []).forEach((f: any) => {
      const amt = Number(f.amount || 0);
      const notes = (f.notes || "").toLowerCase();
      if (notes.includes("বোর্ডিং") || notes.includes("খাবার") || (f.fee_type || "").toLowerCase().includes("hostel")) {
        pLilIn += amt;
      } else {
        pGenIn += amt;
      }
    });

    (priorDonationsRes.data || []).forEach((d: any) => {
      const amt = Number(d.amount || 0);
      const type = ((d.donation_type || "") + " " + (d.notes || "")).toLowerCase();
      if (type.includes("zakat") || type.includes("যাকাত")) pZakIn += amt;
      else if (type.includes("lillah") || type.includes("লিল্লাহ")) pLilIn += amt;
      else if (type.includes("building") || type.includes("উন্নয়ন") || type.includes("মসজিদ") || type.includes("নির্মাণ")) pBldIn += amt;
      else pGenIn += amt;
    });

    (priorExpRes.data || []).forEach((e: any) => {
      const amt = Number(e.amount || 0);
      const parsed = parseExpenseFund(e.description);
      const fund = (parsed.fundId || "").toLowerCase();
      if (fund.includes("zakat") || fund.includes("যাকাত")) pZakEx += amt;
      else if (fund.includes("lillah") || fund.includes("লিল্লাহ")) pLilEx += amt;
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

  // Process Fees
  (feesData || []).forEach((fee: any) => {
    const amt = Number(fee.amount || 0);
    const notes = (fee.notes || "").toLowerCase();
    const feeType = fee.fee_type || "মাসিক বেতন ও ভর্তি ফি";

    if (notes.includes("বোর্ডিং") || notes.includes("খাবার") || feeType.toLowerCase().includes("hostel")) {
      addCategoryAmount(lillahIncomes, "ছাত্র বোর্ডিং ও খাবার ফি", amt);
    } else {
      addCategoryAmount(generalIncomes, feeType, amt);
    }
  });

  // Process Donations
  (donationsData || []).forEach((don: any) => {
    const amt = Number(don.amount || 0);
    const type = ((don.donation_type || "") + " " + (don.notes || "")).toLowerCase();
    const label = don.donation_type || "দান / অনুদান";

    if (type.includes("zakat") || type.includes("যাকাত")) {
      addCategoryAmount(zakatIncomes, label.includes("যাকাত") ? label : `যাকাত তহবিল (${label})`, amt);
    } else if (type.includes("lillah") || type.includes("লিল্লাহ")) {
      addCategoryAmount(lillahIncomes, label.includes("লিল্লাহ") ? label : `লিল্লাহ তহবিল (${label})`, amt);
    } else if (type.includes("building") || type.includes("উন্নয়ন") || type.includes("মসজিদ") || type.includes("নির্মাণ")) {
      addCategoryAmount(buildingIncomes, label.includes("উন্নয়ন") || label.includes("নির্মাণ") ? label : `উন্নয়ন ও নির্মাণ (${label})`, amt);
    } else {
      addCategoryAmount(generalIncomes, label, amt);
    }
  });

  // Process Expenses
  (expensesData || []).forEach((exp: any) => {
    const amt = Number(exp.amount || 0);
    const parsed = parseExpenseFund(exp.description);
    const fund = (parsed.fundId || "").toLowerCase();
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
  const realPrincipal = auditSettings.signatories?.principalName || meta?.principal_name || madrasa?.principal_name || "মুহতামিম";

  return {
    fiscalYear: year,
    hijriYear,
    startDate,
    endDate,
    madrasaName: madrasa?.name || "মাদ্রাসাতুল মুসলিমীন",
    madrasaAddress: madrasa?.address || "মাদরাসা কমপ্লেক্স",
    registrationNo: madrasa?.registration_no?.substring(0, 15),
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
