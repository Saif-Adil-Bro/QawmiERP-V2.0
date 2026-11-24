"use server";

import { toDhakaDateStringFrom, toDhakaDateString, getDhakaYear } from "@/lib/date-utils";
import { writeGuard } from "@/lib/action-authorization";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import {isPostingUuid as isUuid} from "@/lib/finance/collection-links";
import {journalLegs} from '@/lib/finance/journal';
import {isSalaryVoucher,salaryAccess} from "@/lib/finance/staff-access";
import {ledgerEntries,money} from "@/lib/finance/entries";
import {feePortions} from "@/lib/finance/fee-portions";
import {readBooks} from "@/lib/finance/read-books";
import {reconcilePayments} from "@/lib/portal/ledger";
import { changeVoucherStatus } from "@/lib/finance/voucher-status";
import { financeRows, fundCatalog, postingFund } from "@/lib/finance/funds";
import { collectionFund, isRestrictedFund, exactFundLabel, storedFund, bazarFund, REVIEW_FUND, type ReviewRow,type DonorFrequency, settlementIndex, unmatchedMahfil, FundItem, DonorItem, DonationItem, FundTransactionRecord, parseExpenseFund, isVoidedExpense, isVoidDonation, getExpenseVoidReason } from "@/lib/fund-utils";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import { getFeeMetadata, voidFeePayment, unvoidFeePayment } from "./fee-management";
import { getFeePaymentsForLedger } from "@/lib/fee-store";

// The number is a proposal, not a reservation; the database rejects concurrent collisions.
export async function getNextDonationReceiptNo(tenant:string,prefix="ZR") {
  if (tenant!==await getAuthMadrasaId() || !/^[A-Z]{1,12}$/.test(prefix)) throw new Error("রসিদের প্রতিষ্ঠান বা সিরিজ সঠিক নয়।");
  const db=await createAdminClient(),year=getDhakaYear();
  const rows=await financeRows(db,tenant,"donations","id,receipt_no");
  const pattern=new RegExp(`^${prefix}(?:-${year}-)?(\\d+)$`,'i');
  const seq=rows.reduce((n,r)=>Math.max(n,Number(r.receipt_no?.match(pattern)?.[1] || 0)),0)+1;
  return `${prefix}-${year}-${String(seq).padStart(4,'0')}`;
}
export async function getNextMahfilVoucherNo(tenant:string,_type:"SURPLUS"|"DEFICIT") {
  if (tenant!==await getAuthMadrasaId()) throw new Error("সমন্বয়ের প্রতিষ্ঠান মেলেনি।");
  const db=await createAdminClient(),year=getDhakaYear();
  const [income,expense]=await Promise.all([financeRows(db,tenant,"donations","id,receipt_no"),financeRows(db,tenant,"expenses","id,voucher_no,description")]);
  const pattern=new RegExp(`MHF(?:-(?:SURP|DEF|SURPLUS|DEFICIT))?-${year}-(\\d+)`,'i');
  const numbers=[...income.map(d=>d.receipt_no),...expense.map(e=>e.voucher_no || parseExpenseFund(e.description).voucherNo || e.description)];
  const seq=numbers.reduce((n,v)=>Math.max(n,Number(v?.match(pattern)?.[1] || 0)),0)+1;
  return `MHF-${year}-${String(seq).padStart(4,'0')}`;
}

// Active Madrasa Header Info for Money Receipts and Invoices
export async function getActiveMadrasaHeaderInfo() {
  try {
    const info = await getMadrasaInfo();
    return {
      name: info.name || "মাদরাসা",
      address: info.address || "",
      phone: info.phone || "",
      email: info.email || "",
      logo_url: info.logo_url || "",
      registration_no: info.registration_no || info.reg_no || "",
      signature_url: info.signature_url || "",
      principal_name: info.principal_name || "",
      slogan: info.slogan || "",
      established_year: info.established_year || "",
    };
  } catch {
    return {
      name: "মাদরাসা",
      address: "",
      phone: "",
      email: "",
      logo_url: "",
      registration_no: "",
      signature_url: "",
      principal_name: "",
      slogan: "",
      established_year: "",
    };
  }
}

// Helper to get all funds (Defaults + Relational Table zakat_funds + Custom funds) with real-time financial balances
export async function getFunds(madrasaIdParam?: string): Promise<FundItem[]> {
  return (await loadFundOverview(madrasaIdParam)).funds.filter(f => f.is_active !== false);
}
// Choices need only the tenant catalog, never the contents or balances of other ledgers.
export async function getFundChoices(includeArchived = false): Promise<FundItem[]> {
  const tenant = await getAuthMadrasaId();
  if (!tenant) return [];
  const funds = await fundCatalog(tenant,true);
  return funds.filter(f => includeArchived || f.is_active !== false)
    .map(({id,name,code,category,is_active,is_default}) => ({id,name,code,category,is_active,is_default}));
}
export async function getFundOverview() {
  const guard = await writeGuard("financeRead");
  if (!guard.allowed) return { funds: [], review: [], error: "অনুমতি নেই।" };
  return loadFundOverview(guard.madrasaId);
}
async function loadFundOverview(expectedTenant?: string): Promise<{funds: FundItem[]; review: ReviewRow[]; error?: string}> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = user && await getAuthMadrasaId(supabase,user);
    if (!finalMadrasaId || (expectedTenant && expectedTenant !== finalMadrasaId)) return {funds: [],review: [],error:"প্রতিষ্ঠানের পরিচয় মেলেনি।"};
    const books=await readBooks(finalMadrasaId,getFeeMetadata);
    const review: ReviewRow[]=[];
    const groups=new Map(books.funds.map(f=>[f.id,{income:0,expense:0,count:0,donors:new Set<string>()}]));
    for (const e of ledgerEntries(books)) {
      const g=groups.get(e.fund_id);
      if (!g || e.reason) {review.push({id:e.id,kind:e.income?'donation':e.source==='bazar'?'bazar':'expense',date:e.date,voucher:e.voucher_no,amount:e.amount,reason:(e.status==='VOID'?'বাতিল · ':'')+(e.reason || REVIEW_FUND.name)});continue;}
      if (e.status==='VOID') continue;
      if (e.income) {g.income=money(g.income+e.amount);g.count++;g.donors.add(e.donor_id || e.voucher_no || e.id);}
      else g.expense=money(g.expense+e.amount);
    }
    const movement=new Map<string,number>();
    for(const leg of journalLegs(books.journals,books.funds)) movement.set(leg.fund_id,money((movement.get(leg.fund_id)||0)+leg.delta));
    const funds=books.funds.map(f=>{
      const g=groups.get(f.id)!;
      return {...f,total_collected:g.income,total_expense:g.expense,current_balance:money(g.income-g.expense+(movement.get(f.id)||0)),donations_count:g.count,unique_donors_count:g.donors.size};
    });
    return {funds, review};
  } catch (err) {
    console.error("Error in getFunds:", err);
    return {funds: [],review: [],error: "ফান্ডের পূর্ণ হিসাব পড়া যায়নি।"};
  }
}

// Create a new custom Fund manually
export async function createFund(formData: FormData) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("zakat");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const adminClient = await createAdminClient();
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);

    const name = (formData.get("name") as string)?.trim();
    const code = (formData.get("code") as string)?.trim().toUpperCase() || "FND";
    const category = (formData.get("category") as string) || "General";
    const description = (formData.get("description") as string)?.trim() || "";
    const target_amount = parseFloat(formData.get("target_amount") as string) || 0;
    const color = (formData.get("color") as string) || "emerald";

    if (!name) {
      throw new Error("ফান্ডের নাম আবশ্যক");
    }

    const newFund: FundItem = {
      id: `fund-${crypto.randomUUID()}`,
      madrasa_id: finalMadrasaId,
      name,
      code,
      category: category as any,
      description,
      target_amount,
      color,
      is_default: false,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const { error } = await adminClient.from("zakat_funds").insert({
      id:newFund.id,madrasa_id:finalMadrasaId,name,code,category,description,target_amount,is_active:true,
    });
    if (error) return {error:error.message};

    revalidatePath("/dashboard/zakat");
    revalidatePath("/dashboard/zakat/funds");
    revalidatePath("/dashboard/zakat/collection");
    revalidatePath("/dashboard/zakat/reports");

    return { success: true, fund: newFund };
  } catch (err: any) {
    return { error: err.message || "ফান্ড তৈরি করতে সমস্যা হয়েছে" };
  }
}

// Update Fund
export async function updateFund(fundId: string, formData: FormData): Promise<{ success?: boolean; error?: string }> {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("zakat");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) throw new Error("Unauthorized");

    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) throw new Error("Madrasa ID not found");

    const name = (formData.get("name") as string)?.trim();
    const code = (formData.get("code") as string)?.trim().toUpperCase() || "FND";
    const category = (formData.get("category") as string) || "General";
    const description = (formData.get("description") as string)?.trim() || "";
    const target_amount = parseFloat(formData.get("target_amount") as string) || 0;

    const adminClient = await createAdminClient();
    const original = await postingFund(finalMadrasaId,fundId,"deposit");
    if (original.is_default || !name || (isRestrictedFund(original) && !isRestrictedFund({...original,name,code,category:category as FundItem["category"]}))) return {error:"সুরক্ষিত ফান্ডের পরিচয় বা বিধিনিষেধ বদলানো যাবে না।"};
    const patch = {name,code,category,description,target_amount};
    const {data,error} = await adminClient.from("zakat_funds").update(patch).eq("madrasa_id",finalMadrasaId).eq("id",fundId).select("id").maybeSingle();
    if (error) return {error:error.message};
    if (!data) {
      // Materialize this tenant's metadata-only fund; never upsert another tenant's PK.
      const insert = await adminClient.from("zakat_funds").insert({...patch,id:fundId,madrasa_id:finalMadrasaId});
      if (insert.error) return {error:insert.error.message};
    }

    revalidatePath("/dashboard/zakat/funds");
    revalidatePath("/dashboard/zakat/collection");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "আপডেট ব্যর্থ হয়েছে" };
  }
}

// Delete Fund
export async function deleteFund(fundId: string): Promise<{ success?: boolean; error?: string }> {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("zakat");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) throw new Error("Unauthorized");

    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) throw new Error("Madrasa ID not found");

    const adminClient = await createAdminClient();
    const f = await postingFund(finalMadrasaId,fundId,"deposit");
    if (f.is_default) return {error:"ডিফল্ট ফান্ড আর্কাইভ করা যাবে না।"};
    const {data,error} = await adminClient.from("zakat_funds").update({is_active:false}).eq("madrasa_id",finalMadrasaId).eq("id",fundId).select("id").maybeSingle();
    if (error) return {error:error.message};
    if (!data) {
      const insert = await adminClient.from("zakat_funds").insert({id:f.id,madrasa_id:finalMadrasaId,name:f.name,code:f.code,category:f.category,is_active:false});
      if (insert.error) return {error:insert.error.message};
    }

    revalidatePath("/dashboard/zakat/funds");
    revalidatePath("/dashboard/zakat/collection");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "মুছে ফেলা সম্ভব হয়নি" };
  }
}

// Fetch all donors with donation aggregates (Unified Master Donors)
export async function getDonors(): Promise<DonorItem[]> {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("financeRead");
    if (!__authz.allowed) throw new Error("অনুমতি নেই।");
  }

  try {
    const adminClient = await createAdminClient();
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return [];

    const [meta,dbDonors,dbDonations,funds]=await Promise.all([getMadrasaMetadata(finalMadrasaId,true),financeRows(adminClient,finalMadrasaId,'donors'),
      financeRows(adminClient,finalMadrasaId,'donations'),fundCatalog(finalMadrasaId,true)]);
    const rawDonors:any[]=meta.life_member_donors || [];
    const donorDonationMap=new Map<string,{total:number;count:number;lastDate:string}>();
    for (const e of ledgerEntries({funds,donations:dbDonations,meta,payments:[],bazar:[],expenses:[]})) {
      if (!e.income || !e.donor_id || e.status==='VOID') continue;
      const stats=donorDonationMap.get(e.donor_id) || {total:0,count:0,lastDate:''};
      stats.total=money(stats.total+e.amount);stats.count++;if (e.date>stats.lastDate) stats.lastDate=e.date;
      donorDonationMap.set(e.donor_id,stats);
    }

    // Master unified donors mapping
    const donorResultMap = new Map<string, DonorItem>();

    // Reading a report must never merge identities or rewrite historical subscription receipts.
    // First, add all DB donors
    (dbDonors || []).forEach((d: any) => {
      const stats = donorDonationMap.get(d.id) || { total: 0, count: 0, lastDate: "" };
      let pledgeAmount:number|undefined;
      let notesText = d.notes || "";
      if (d.notes && d.notes.startsWith("{")) {
        try {
          const parsed = JSON.parse(d.notes);
          pledgeAmount = parsed.pledge_amount;
          notesText = parsed.notes || "";
        } catch {}
      }

      donorResultMap.set(d.id, {
        id: d.id,
        madrasa_id: d.madrasa_id,
        name: d.name,
        phone: d.phone || "",
        email: d.email || "",
        address: d.address || "",
        donor_type: (d.donor_type as any) || "OneTime",
        pledge_amount: pledgeAmount ?? d.pledge_amount ?? 0,
        preferred_fund: d.preferred_fund || "",
        notes: notesText,
        created_at: d.created_at,
        total_donated: stats.total,
        donation_count: stats.count,
        last_donation_date: stats.lastDate,
      });
    });

    // Second, merge any metadata life_member_donors not in DB
    rawDonors.forEach((lm: any) => {
      const existing = donorResultMap.get(lm.id);
      const stats = donorDonationMap.get(lm.id) || { total: 0, count: 0, lastDate: "" };
      const dType = lm.member_type === "LIFE_MEMBER" ? "Annual" : lm.member_type === "MONTHLY_DONOR" || lm.member_type === "MONTHLY" ? "Monthly" : ["YEARLY","ANNUAL_DONOR"].includes(lm.member_type)?"Annual":"OneTime";

      if (existing) {
        existing.pledge_amount = lm.pledge_amount ?? existing.pledge_amount ?? 0;
        existing.preferred_fund = existing.preferred_fund || lm.preferred_fund || "";
        existing.total_donated = stats.total;
      } else {
        donorResultMap.set(lm.id, {
          id: lm.id,
          madrasa_id: finalMadrasaId,
          name: lm.name,
          phone: lm.phone || "",
          email: lm.email || "",
          address: lm.address || "",
          donor_type: dType as any,
          pledge_amount: Number(lm.pledge_amount ?? lm.committed_amount ?? 0),
          preferred_fund: lm.preferred_fund || "",
          notes: lm.notes || "",
          created_at: lm.created_at || new Date().toISOString(),
          total_donated: stats.total,
          donation_count: stats.count,
          last_donation_date: stats.lastDate,
        });
      }
    });

    const { getCurrentUserMaskingContext, maskDonorSensitiveFields } = await import("@/lib/data-access-guards");
    const maskingCtx = await getCurrentUserMaskingContext("zakat", "phone");
    return Array.from(donorResultMap.values()).map((d) =>
      maskDonorSensitiveFields({...d,notes:maskingCtx.allowUnmasked?d.notes:undefined}, maskingCtx.allowUnmasked)
    );
  } catch (err) {
    console.error("Error in getDonors:", err);
    throw new Error("দাতাদের পূর্ণ হিসাব পড়া যায়নি।");
  }
}

// Add Donor with Frequency: Annual / Monthly / OneTime
async function saveDirectoryDonor(form:FormData,id?:string) {
  const guard=await writeGuard('zakat');if (!guard.allowed) return guard.fallback;
  const {saveLifeMemberDonor}=await import('./fundraising');
  const field=(k:string)=>String(form.get(k) || '').trim();
  const name=field('name'),type=field('donor_type') || 'OneTime',pledge=Number(field('pledge_amount'));
  if (!name || !Number.isFinite(pledge) || pledge<0) return {error:'দাতার নাম ও অঙ্ক সঠিক নয়।'};
  const res=await saveLifeMemberDonor({id,name,phone:field('phone'),address:field('address'),notes:field('notes'),preferred_fund:field('preferred_fund'),
    member_type:type==='Monthly'?'MONTHLY_DONOR':type==='Annual'?'LIFE_MEMBER':'ONETIME',pledge_amount:pledge});
  if (!res.donor || res.error) return {error:res.error || 'দাতা সংরক্ষণ হয়নি।'};
  return {success:true,donor:{...res.donor,donor_type:type as DonorFrequency,total_donated:res.donor.total_donated || 0,donation_count:0,last_donation_date:''}};
}
export async function addDonor(form:FormData) {return saveDirectoryDonor(form);}
export async function updateDonor(id:string,form:FormData) {return saveDirectoryDonor(form,id);}
export async function deleteDonor(id:string) {
  const guard=await writeGuard('zakat');if (!guard.allowed) return guard.fallback;
  return (await import('./fundraising')).deleteLifeMemberDonor(id);
}

// Fetch all donations with fund info and donor details
export async function getDonations(filters?: {
  fund_id?: string;
  donation_type?: string;
  donor_id?: string;
  startDate?: string;
  endDate?: string;
}): Promise<DonationItem[]> {
  const tenant=await getAuthMadrasaId();
  if (!tenant) throw new Error("অনুমতি নেই।");
  const {getCurrentUserMaskingContext}=await import('@/lib/data-access-guards');
  const {allowUnmasked}=await getCurrentUserMaskingContext('zakat','phone');
  const books=await readBooks(tenant,getFeeMetadata,true);
  const fundByLabel=filters?.donation_type && filters.donation_type!=='ALL' ? exactFundLabel(books.funds,filters.donation_type)?.id || 'unknown' : null;
  return ledgerEntries(books).filter(e=>e.income && (!filters?.fund_id || e.fund_id===filters.fund_id) &&
    (!fundByLabel || e.fund_id===fundByLabel) && (!filters?.donor_id || e.donor_id===filters.donor_id) &&
    (!filters?.startDate || e.date>=filters.startDate) && (!filters?.endDate || e.date<=filters.endDate))
    .sort((a,b)=>b.date.localeCompare(a.date)).map(e=>({id:e.id,madrasa_id:tenant,donor_id:e.donor_id,amount:e.amount,
      donation_type:e.fund_name,fund_id:e.fund_id,fund_name:e.fund_name,donation_date:e.date,receipt_no:e.voucher_no,payment_method:e.payment_method,
      notes:allowUnmasked?e.notes:undefined,status:e.status,cancellation_reason:e.cancellation_reason,is_mahfil_settlement:e.is_mahfil_settlement,
      donors:{id:e.donor_id,name:e.source_or_recipient,phone:allowUnmasked?e.donor_phone:undefined,address:allowUnmasked?e.donor_address:undefined}}));
}

// Receipts use exactly the same source/fund attribution as the list (including metadata-only receipts).
export async function getDonationById(id:string):Promise<DonationItem|null> {
  if (!id) return null;
  const matches=(await getDonations()).filter(d=>d.id===id);
  return matches.length===1?matches[0]:null;
}

// Get Full Financial Ledger & Statement for a specific Fund
export async function getFundLedgerData(fundIdentifier: string): Promise<{
  fund: FundItem | null;
  transactions: FundTransactionRecord[];
  totalInflow: number;
  totalOutflow: number;
  currentBalance: number;
}> {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  const access = await writeGuard("financeRead");
  if (!access.allowed) throw new Error("অনুমতি নেই।");

  try {
    const tenant=await getAuthMadrasaId();
    const books=await readBooks(tenant,getFeeMetadata);
    const targetFund=books.funds.find(f=>f.id===fundIdentifier);
    if (!targetFund) throw new Error('অপরিচিত ফান্ড');
    const hiddenPay = salaryAccess(access, "read") ? new Set() : new Set(books.expenses.filter(isSalaryVoucher).map(e => e.id));
    // Donor-contact unmasking is independent of payroll authority. Resolve the fund
    // using the original evidence first, then remove identifying voucher text.
    const transactions=ledgerEntries(books).filter(e=>e.fund_id===fundIdentifier).map(e=>
      !e.income && hiddenPay.has(e.id) ? {...e, source_or_recipient:"বেতন ভাউচার", notes:undefined, cancellation_reason:undefined} : e);
    let totalInflow=0,totalOutflow=0;
    for (const e of transactions) if (e.status!=='VOID') {
      if (e.income) totalInflow=money(totalInflow+e.amount);else totalOutflow=money(totalOutflow+e.amount);
    }
    const legs=journalLegs(books.journals,books.funds).filter(l=>l.fund_id===fundIdentifier);
    const history: FundTransactionRecord[]=[...transactions,...legs].sort((a,b)=>b.date.localeCompare(a.date));
    const currentBalance=money(totalInflow-totalOutflow+legs.reduce((sum,l)=>sum+l.delta,0));
    const {getCurrentUserMaskingContext}=await import('@/lib/data-access-guards');
    const {allowUnmasked}=await getCurrentUserMaskingContext('zakat','phone');
    return {
      fund: targetFund,
      transactions:allowUnmasked ? history : history.map(row=>{const {notes,donor_phone,donor_address,...safe}=row as FundTransactionRecord & {donor_phone?:string;donor_address?:string};return safe;}),
      totalInflow,
      totalOutflow,
      currentBalance,
    };
  } catch (err) {
    console.error("Error in getFundLedgerData:", err);
    throw new Error("ফান্ড খতিয়ান লোড করা যায়নি। আবার চেষ্টা করুন।");
  }
}

/**
 * Void a specific transaction from Fund Ledger (Soft-Cancel with Reason & Audit Log)
 */
async function changeFundTransaction(id:string,type:string,reason:string,voiding:boolean) {
  const guard = await writeGuard("zakat");
  if (!guard.allowed) return guard.fallback;
  try {
    if (!guard.madrasaId || !guard.userId) throw new Error("অনুমতি নেই।");
    if (!id || !reason?.trim()) throw new Error("ভাউচার ও কারণ উল্লেখ করুন।");
    if (type!=="INCOME" && type!=="EXPENSE") throw new Error("মাহফিল সমন্বয় মূল মাহফিল ভাউচার হতে বাতিল করুন।");
    // Allocation IDs are display IDs. Resolve only portions that actually exist
    // (including a real remainder), and never accept the caller's receipt number.
    let feeId:string|undefined;
    if (type==='INCOME') {
      const books=await readBooks(guard.madrasaId,getFeeMetadata,true);
      const matches=books.payments.filter(p=>p.id===id || feePortions(p,books.funds).some(part=>part.id===id));
      if (matches[0]?.finance_review_reason || matches.length>1 || (matches.length && ledgerEntries({...books,payments:[]}).some(e=>e.income && e.id===id))) throw new Error('একই আইডিতে একাধিক মূল রসিদ রয়েছে।');
      feeId=matches[0]?.id;
    }
    if (feeId) {
      const result=await (voiding?voidFeePayment:unvoidFeePayment)(feeId,reason.trim());
      if (result.error) return {error:result.error};
    } else if (!await changeVoucherStatus(guard.madrasaId,guard.userId,id,type==='INCOME',reason,voiding)) return {error:'সুনির্দিষ্ট মূল ভাউচার পাওয়া যায়নি।'};
    for (const path of ['zakat','zakat/funds','zakat/collection','zakat/reports','accounting','accounting/income','accounting/reports','accounting/expenses','fundraising/collections','fundraising/online-donations']) revalidatePath(`/dashboard/${path}`);
    return {success:true,message:voiding ? "ভাউচার বাতিল হয়েছে।" : "ভাউচার পুনরায় সক্রিয় হয়েছে।"};
  } catch (err:any) {return {error:err.message || "ভাউচার পরিবর্তন হয়নি।"};}
}
export async function voidFundTransaction(id:string,type:string,reason:string,_voucherNo?:string) {
  return changeFundTransaction(id,type,reason,true);
}
export async function unvoidFundTransaction(id:string,type:string,reason:string,_voucherNo?:string) {
  return changeFundTransaction(id,type,reason,false);
}

// Backwards-compatible alias that safely delegates to voidFundTransaction instead of hard deleting
export async function deleteFundTransaction(
  txnId: string,
  txnType: string,
  voucherNo?: string,
  reason: string = "ভুল এন্ট্রি বাতিল"
): Promise<{ success?: boolean; error?: string; message?: string }> {
  return voidFundTransaction(txnId, txnType, reason, voucherNo);
}

// Add Collection with Fund Selection and Auto Receipt Generation
export async function addDonation(prevState: any, formData: FormData) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("zakat");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const adminClient = await createAdminClient();
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);

    const fund = await postingFund(finalMadrasaId,formData.get("fund_id"),"deposit","","",formData.get("donation_type"),formData.get("fund_name"));
    const amount = Number(formData.get("amount"));
    if (!Number.isFinite(amount) || amount <= 0 || !/^\d+(?:\.\d{1,2})?$/.test(String(formData.get("amount")).trim())) return {error:"অনুদানের অঙ্ক সঠিক নয়।"};
    let donor_id = (formData.get("donor_id") as string) || null;
    const is_new_donor = formData.get("is_new_donor") === "true";
    const new_donor_name = (formData.get("new_donor_name") as string)?.trim();
    const new_donor_phone = (formData.get("new_donor_phone") as string)?.trim() || "";
    const new_donor_address = (formData.get("new_donor_address") as string)?.trim() || "";
    const new_donor_type = (formData.get("new_donor_type") as string) || "OneTime";
    const new_donor_pledge=Number(formData.get("new_donor_pledge") || 0);
    const auto_save_donor = formData.get("auto_save_donor") !== "false";

    if (is_new_donor && (!new_donor_name || donor_id || !Number.isFinite(new_donor_pledge) || new_donor_pledge<0)) return {error:'নতুন দাতার তথ্য যাচাই করুন।'};
    const newDonor=is_new_donor && auto_save_donor ? {name:new_donor_name,phone:new_donor_phone,address:new_donor_address,donor_type:new_donor_type,pledge_amount:new_donor_pledge,notes:'সংগ্রহের সময় যুক্ত'} : null;
    const donation_date = (formData.get("donation_date") as string) || toDhakaDateString();
    const payment_method = String(formData.get("payment_method") || "Unknown").trim() || "Unknown";
    const receipt_no_input = (formData.get("receipt_no") as string)?.trim();
    const userNotes = (formData.get("notes") as string)?.trim() || "";

    if (!amount || isNaN(amount) || amount <= 0) {
      return { error: "অনুগ্রহ করে সঠিক অনুদানের পরিমাণ লিখুন" };
    }

    // Auto generate sequential receipt number if not provided
    const receipt_no = receipt_no_input || (await getNextDonationReceiptNo(finalMadrasaId, "ZR"));

    // Store payment method and walk-in donor details in notes tag if not saved to directory
    let formattedNotes = userNotes;
    if (is_new_donor && new_donor_name && !newDonor) {
      formattedNotes = `[Donor: ${new_donor_name}${new_donor_phone ? `, ${new_donor_phone}` : ""}] ${formattedNotes}`.trim();
    }
    if (payment_method !== "Cash") {
      formattedNotes = `[Method: ${payment_method}] ${formattedNotes}`.trim();
    }

    // Keep legacy member identity intact instead of merging by name or shared phone.
    const finalDonorId=donor_id && isUuid(donor_id)?donor_id:null;
    let memberId:string|null=null;
    if (donor_id && !finalDonorId) {
      const meta=await getMadrasaMetadata(finalMadrasaId,true);
      if (!(meta.life_member_donors || []).some((d:any)=>d.id===donor_id)) return {error:'দাতা পাওয়া যায়নি।'};
      memberId=donor_id;
    }

    const {data:posted,error}=await adminClient.rpc('finance_receive_donation',{t:finalMadrasaId,p_operator:user?.id,p_method:payment_method,p_donor:newDonor,p_receipt:{donor_id:finalDonorId,member_id:memberId,amount,fund_id:fund.id,fund_name:fund.name,donation_date,receipt_no,notes:formattedNotes}});
    if (error || !posted?.receipt?.id) return {error:error?.message || 'মূল রসিদ নিশ্চিত হয়নি।'};
    const data=posted.receipt;
    const createdDonorObj:DonorItem|null=posted.donor ? {...posted.donor,pledge_amount:new_donor_pledge,total_donated:amount,donation_count:1,last_donation_date:donation_date} : null;

    revalidatePath("/dashboard/zakat");
    revalidatePath("/dashboard/zakat/collection");
    revalidatePath("/dashboard/zakat/donors");
    revalidatePath("/dashboard/zakat/reports");
    revalidatePath("/dashboard/zakat/funds");

    return { 
      success: true, 
      donation: {
        ...data,
        payment_method,
        notes: userNotes,
      },
      createdDonor: createdDonorObj,
      tempDonorName: (is_new_donor && new_donor_name) ? new_donor_name : undefined,
      tempDonorPhone: (is_new_donor && new_donor_phone) ? new_donor_phone : undefined,
      tempDonorAddress: (is_new_donor && new_donor_address) ? new_donor_address : undefined,
      tempDonorType: (is_new_donor && new_donor_type) ? new_donor_type : undefined,
    };
  } catch (err: any) {
    return { error: err.message || "সংগ্রহ সম্পন্ন করতে ব্যর্থ হয়েছে" };
  }
}

/**
 * Void a Donation Receipt (Soft Delete with Reason, Balance Rollback, Immutable Audit Log)
 */
export async function voidDonationReceipt(id:string,reason:string) {
  return voidFundTransaction(id,"INCOME",reason);
}
export async function unvoidDonationReceipt(id:string,reason:string) {
  return unvoidFundTransaction(id,"INCOME",reason);
}

/**
 * Backwards compatible deleteDonation alias to prevent hard deletions
 */
export async function deleteDonation(id: string, reason: string = "ভুল এন্ট্রি বাতিল") {
  return voidDonationReceipt(id, reason);
}

// Comprehensive Fund & Zakat Report Statistics
export async function getZakatReportStats() {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return null;

    const [overviewRes, donors, donations] = await Promise.all([
      loadFundOverview(finalMadrasaId),
      getDonors(),
      getDonations(),
    ]);
    const funds = overviewRes.funds || [];

    // Calculate total collection, expense, and net balance per fund (B21)
    const fundTotals: Record<
      string,
      {
        name: string;
        total: number;
        expense: number;
        netBalance: number;
        count: number;
        category: string;
        color: string;
      }
    > = {};

    let totalExpenseAll = 0;
    let totalNetBalanceAll = 0;

    funds.forEach((f: any) => {
      const collected = Number(f.total_collected || 0);
      const expense = Number(f.total_expense || 0);
      const net = Number(
        typeof f.current_balance === "number"
          ? f.current_balance
          : collected - expense,
      );
      totalExpenseAll = money(totalExpenseAll + expense);
      totalNetBalanceAll = money(totalNetBalanceAll + net);
      fundTotals[f.id] = {
        name: f.name,
        total: collected,
        expense,
        netBalance: net,
        count: Number(f.donations_count || 0),
        category: f.category,
        color: f.color || "emerald",
      };
    });

    let grandTotal = 0;
    let monthlyDonorTotal = 0;
    let annualDonorTotal = 0;
    let oneTimeDonorTotal = 0;

    // Normalize donor type string to "Monthly" | "Annual" | "OneTime"
    const normalizeDonorType = (rawType?: string): "Monthly" | "Annual" | "OneTime" => {
      if (!rawType) return "OneTime";
      const upper = rawType.toUpperCase();
      if (upper.includes("MONTH") || upper.includes("মাসিক")) return "Monthly";
      if (upper.includes("ANNUAL") || upper.includes("LIFE") || upper.includes("বাৎসরিক") || upper.includes("আজীবন")) return "Annual";
      return "OneTime";
    };

    // Donor type map
    const donorTypeMap = new Map(donors.map(d => [d.id, normalizeDonorType(d.donor_type)]));

    // Unique donor identifiers per type for donations
    const monthlyDonorSet = new Set<string>();
    const annualDonorSet = new Set<string>();
    const oneTimeDonorSet = new Set<string>();

    donations.forEach((d: any) => {
      const isVoid = d.status === "VOID" || (d.notes && d.notes.includes("[VOID:"));
      if (isVoid) return;

      const amt = Number(d.amount || 0);
      grandTotal += amt;

      const fType = d.fund_id || REVIEW_FUND.id;
      if (!fundTotals[fType]) {
        fundTotals[fType] = {
          name: d.fund_name || REVIEW_FUND.name,
          total: amt,
          expense: 0,
          netBalance: amt,
          count: 1,
          category: "Other",
          color: "teal",
        };
      }

      // Group by donor type
      const dtype = d.donor_id ? (donorTypeMap.get(d.donor_id) || "OneTime") : "OneTime";
      const donorKey = d.donor_id || d.receipt_no || d.id;

      if (dtype === "Monthly") {
        monthlyDonorTotal += amt;
        if (donorKey) monthlyDonorSet.add(donorKey);
      } else if (dtype === "Annual") {
        annualDonorTotal += amt;
        if (donorKey) annualDonorSet.add(donorKey);
      } else {
        oneTimeDonorTotal += amt;
        if (donorKey) oneTimeDonorSet.add(donorKey);
      }
    });

    // Calculate donor counts by type combining registered profiles and active transaction donors
    const regMonthly = donors.filter(d => normalizeDonorType(d.donor_type) === "Monthly").length;
    const regAnnual = donors.filter(d => normalizeDonorType(d.donor_type) === "Annual").length;
    const regOneTime = donors.filter(d => normalizeDonorType(d.donor_type) === "OneTime").length;

    const monthlyDonorsCount = Math.max(regMonthly, monthlyDonorSet.size);
    const annualDonorsCount = Math.max(regAnnual, annualDonorSet.size);
    const oneTimeDonorsCount = Math.max(regOneTime, oneTimeDonorSet.size);

    const allUniqueDonorKeys = new Set<string>();
    monthlyDonorSet.forEach(k => allUniqueDonorKeys.add(k));
    annualDonorSet.forEach(k => allUniqueDonorKeys.add(k));
    oneTimeDonorSet.forEach(k => allUniqueDonorKeys.add(k));

    const totalUniqueDonors = Math.max(
      donors.length,
      allUniqueDonorKeys.size
    );

    const overviewTotalCollected = Object.values(fundTotals).reduce(
      (sum, f) => money(sum + f.total),
      0,
    );

    return {
      grandTotal: overviewTotalCollected || grandTotal,
      totalExpense: totalExpenseAll,
      netBalance: totalNetBalanceAll,
      totalDonors: totalUniqueDonors,
      totalCollectionsCount: donations.filter(d => !isVoidDonation(d)).length,
      fundBreakdown: Object.values(fundTotals),
      donorTypeStats: {
        monthly: { count: monthlyDonorsCount, collected: monthlyDonorTotal },
        annual: { count: annualDonorsCount, collected: annualDonorTotal },
        oneTime: { count: oneTimeDonorsCount, collected: oneTimeDonorTotal },
      },
      recentDonations: donations.slice(0, 10),
    };
  } catch (err) {
    console.error("Error in getZakatReportStats:", err);
    return null;
  }
}
