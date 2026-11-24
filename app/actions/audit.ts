"use server";
import {reconcilePayments} from "@/lib/portal/ledger";

import { getDhakaYear } from "@/lib/date-utils";
import { writeGuard } from "@/lib/action-authorization";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";
import { financeRows,fundCatalog } from "@/lib/finance/funds";
import { periodLines,auditLines,type FundLine } from "@/lib/finance/statement";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import { getFeeMetadata } from "./fee-management";
import { saveStructuredMadrasaSetting, getStructuredMadrasaSetting } from "@/lib/structured-config";

export type FundAuditSummary = FundLine;

export interface AuditSettings {
  openingBalances?: {
    general?: number;
    lillah?: number;
    zakat?: number;
    building?: number;
  };
  bankName?: string;
  accountNumber?: string;
  bankBalance?: number | null;
  cashInHand?: number | null;
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
    bankBalance: number | null;
  };
  auditConfig?: AuditSettings;
  funds: {
    generalFund: FundAuditSummary;
    lillahFund: FundAuditSummary;
    zakatFund: FundAuditSummary;
    buildingFund: FundAuditSummary;
  };
  fundLines: FundAuditSummary[];
  grandTotal: {
    openingBalance: number;
    totalIncome: number;
    totalExpense: number;
    netSurplus: number;
    closingBalance: number;
    cashInHand: number | null;
    bankBalance: number | null;
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
  const __authz = await writeGuard("finance");
  if (!__authz.allowed) return __authz.fallback;

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { success: false, error: "অননুমোদিত ব্যবহারকারী" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { success: false, error: "মাদরাসা আইডি পাওয়া যায়নি" };

    const prevSetting = await getStructuredMadrasaSetting<AuditSettings>(madrasaId, "audit_settings", year);
    const meta: any = await getMadrasaMetadata(madrasaId);
    const prevValue = (prevSetting.found && prevSetting.value) || meta?.audit_settings?.[year] || {};
    const mergedSettings = {
      ...prevValue,
      ...settings,
    };

    // Save to structured madrasa_settings table first
    const sqlRes = await saveStructuredMadrasaSetting(
      madrasaId,
      "audit_settings",
      year,
      mergedSettings,
      user.id
    );

    if (!sqlRes.ok) {
      if (!meta.audit_settings) meta.audit_settings = {};
      meta.audit_settings[year] = mergedSettings;
      const saved = await saveMadrasaMetadata(madrasaId, meta);
      if (!saved) {
        return { success: false, error: "সেটিংস সংরক্ষণ করা যায়নি" };
      }
    }

    await __authz.logAudit({
      module: "settings",
      action: "AUDIT_SETTINGS_UPDATED",
      entityType: "madrasa_settings",
      entityId: `audit_settings:${year}`,
      entityLabel: `বার্ষিক অডিট কনফিগ (${year})`,
      summary: `${year} অর্থবছরের বার্ষিক অডিট সেটিংস হালনাগাদ করা হয়েছে।`,
      oldValue: prevValue,
      newValue: mergedSettings,
      metadata: { storage: sqlRes.storage },
      severity: "INFO",
    });

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

  const [meta, feeMeta, structuredAuditSetting] = await Promise.all([
    getMadrasaMetadata(madrasaId,true),
    getFeeMetadata(madrasaId),
    getStructuredMadrasaSetting<AuditSettings>(madrasaId, "audit_settings", year),
  ]);
  const auditSettings: AuditSettings =
    (structuredAuditSetting.found && structuredAuditSetting.value) ||
    (meta as any).audit_settings?.[year] ||
    {};

  const [catalog,donations,expenses,bazar,legacyFees,journals] = await Promise.all([
    fundCatalog(madrasaId,true),financeRows(adminClient,madrasaId,"donations","*",endDate),financeRows(adminClient,madrasaId,"expenses","*",endDate),financeRows(adminClient,madrasaId,"bazar_expenses","*",endDate),financeRows(adminClient,madrasaId,"fees","*",endDate),financeRows(adminClient,madrasaId,"treasury_journals","*",endDate),
  ]);
  const fundLines = auditLines(periodLines({journals,funds:catalog,start:startDate,end:endDate,donations,expenses,bazar,meta,payments:reconcilePayments(feeMeta.payments || [],legacyFees,true)}),auditSettings.openingBalances || {});
  const [generalFund,lillahFund,zakatFund,buildingFund] = fundLines;
  const totalOpening = fundLines.reduce((a,l)=>a+l.openingBalance,0);
  const totalIn = fundLines.reduce((a,l)=>a+l.totalIncome,0), totalEx = fundLines.reduce((a,l)=>a+l.totalExpense,0);
  const totalClosing = fundLines.reduce((sum,line)=>sum+line.closingBalance,0);

  // Bank & Cash reconciliation
  // A computed closing balance is not a cash count or a bank statement.
  const recorded=(n:unknown)=>typeof n==='number' && Number.isFinite(n)?n:null;
  const bankBalance=recorded(auditSettings.bankBalance),cashInHand=recorded(auditSettings.cashInHand);

  // Breakdown percentages
  const grandIncomesAll = fundLines.flatMap(f => f.incomesByCategory);
  const grandExpensesAll = fundLines.flatMap(f => f.expensesByCategory);

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
    funds: {generalFund,lillahFund,zakatFund,buildingFund}, fundLines,
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
