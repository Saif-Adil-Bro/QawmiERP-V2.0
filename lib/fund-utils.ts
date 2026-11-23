// Fund Category, Donor and Donation types and utilities

export type DonorFrequency = "Monthly" | "Annual" | "OneTime";

export interface FundItem {
  id: string;
  madrasa_id?: string;
  name: string; // e.g. "সাধারণ ফান্ড", "লিল্লাহ বোর্ডিং ফান্ড", "যাকাত ফান্ড"
  code: string; // e.g. "GEN", "LIL", "ZKT"
  category: "General" | "Lillah" | "Zakat" | "Fitra" | "Development" | "Education" | "Other";
  description?: string;
  target_amount?: number;
  current_balance?: number;
  total_collected?: number;
  total_expense?: number;
  donations_count?: number;
  unique_donors_count?: number;
  color?: string;
  is_default?: boolean;
  is_active?: boolean;
  created_at?: string;
}

export interface DonorItem {
  id: string;
  madrasa_id?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  donor_type: DonorFrequency; // "Monthly" | "Annual" | "OneTime"
  pledge_amount?: number; // প্রতিশ্রুতিবদ্ধ পরিমাণ
  preferred_fund?: string; // পছন্দের ফান্ড ID বা নাম
  notes?: string;
  created_at?: string;
  total_donated?: number;
  donation_count?: number;
  last_donation_date?: string;
}

export interface DonationItem {
  id: string;
  madrasa_id?: string;
  donor_id?: string | null;
  amount: number;
  donation_type?: string; // "Zakat" | "Lillah" | "General" | "Fitra" | Custom Fund
  fund_id?: string;
  fund_name?: string;
  donation_date: string;
  receipt_no?: string;
  payment_method?: string; // "Cash" | "bKash" | "Nagad" | "Bank" | "Other"
  transaction_id?: string;
  notes?: string;
  status?: "COMPLETED" | "VOID";
  cancellation_reason?: string;
  voided_at?: string;
  voided_by?: string;
  created_at?: string;
  is_mahfil_settlement?: boolean;
  mahfil_title?: string;
  donors?: {
    id?: string;
    name: string;
    phone?: string;
    address?: string;
    donor_type?: string;
  } | null;
}

export interface FundTransactionRecord {
  id: string;
  type: "INCOME" | "EXPENSE" | "MAHFIL_SURPLUS" | "MAHFIL_DEFICIT";
  fund_id?: string;
  fund_name: string;
  amount: number;
  date: string;
  source_or_recipient: string;
  voucher_no: string;
  payment_method?: string;
  notes?: string;
  category?: string;
  is_mahfil_settlement?: boolean;
  status?: "COMPLETED" | "VOID";
  cancellation_reason?: string;
}

// Built-in Standard Default Funds
export const DEFAULT_FUNDS: FundItem[] = [
  {
    id: "fund-general",
    name: "সাধারণ ফান্ড (General Fund)",
    code: "GEN",
    category: "General",
    description: "মাদরাসার সাধারণ পরিচালন ও প্রশাসনিক খরচের জন্য অনুদান",
    color: "emerald",
    is_default: true,
    is_active: true,
  },
  {
    id: "fund-lillah",
    name: "লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)",
    code: "LIL",
    category: "Lillah",
    description: "দরিদ্র, এতিম ও অসচ্ছল শিক্ষার্থীদের খাবার, কিতাব ও আবাসন সহায়তা",
    color: "indigo",
    is_default: true,
    is_active: true,
  },
  {
    id: "fund-zakat",
    name: "যাকাত ফান্ড (Zakat Fund)",
    code: "ZKT",
    category: "Zakat",
    description: "শরিয়ত সম্মত খাতে ব্যবহারের জন্য প্রাপ্ত যাকাতের অর্থ",
    color: "amber",
    is_default: true,
    is_active: true,
  },
  {
    id: "fund-fitra",
    name: "ফিতরা ও সদকা ফান্ড (Fitra & Sadaqah)",
    code: "FTR",
    category: "Fitra",
    description: "সদকাতুল ফিতর ও নফল সদকা সংগ্রহের ফান্ড",
    color: "rose",
    is_default: true,
    is_active: true,
  },
  {
    id: "fund-dev",
    name: "মসজিদ ও উন্নয়ন ফান্ড (Development Fund)",
    code: "DEV",
    category: "Development",
    description: "মাদরাসা ও মসজিদ ভবন নির্মাণ, সংস্কার ও অবকাঠামো উন্নয়ন",
    color: "sky",
    is_default: true,
    is_active: true,
  },
  {
    id: "fund-orphan",
    name: "এতিম কল্যাণ ফান্ড (Orphan Welfare Fund)",
    code: "ORP",
    category: "Education",
    description: "এতিম শিক্ষার্থীদের সার্বিক ভরণপোষণ ও শিক্ষা সহায়তা",
    color: "purple",
    is_default: true,
    is_active: true,
  }
];

export function getDonorTypeBadge(type?: string): { label: string; bg: string; text: string } {
  switch (type) {
    case "Monthly":
    case "মাসিক":
      return { label: "মাসিক দাতা", bg: "bg-blue-100", text: "text-blue-800" };
    case "Annual":
    case "Yearly":
    case "বার্ষিক":
      return { label: "বার্ষিক দাতা", bg: "bg-purple-100", text: "text-purple-800" };
    case "OneTime":
    case "General":
    case "এককালীন":
    default:
      return { label: "এককালীন দাতা", bg: "bg-slate-100", text: "text-slate-800" };
  }
}

export function getFundCategoryBadge(category?: string): { label: string; bg: string; text: string } {
  switch (category) {
    case "General":
      return { label: "সাধারণ ফান্ড", bg: "bg-emerald-100", text: "text-emerald-800" };
    case "Lillah":
      return { label: "লিল্লাহ ফান্ড", bg: "bg-indigo-100", text: "text-indigo-800" };
    case "Zakat":
      return { label: "যাকাত ফান্ড", bg: "bg-amber-100", text: "text-amber-800" };
    case "Fitra":
      return { label: "ফিতরা ও সদকা", bg: "bg-rose-100", text: "text-rose-800" };
    case "Development":
      return { label: "উন্নয়ন ফান্ড", bg: "bg-sky-100", text: "text-sky-800" };
    case "Education":
      return { label: "শিক্ষা ও এতিম", bg: "bg-purple-100", text: "text-purple-800" };
    default:
      return { label: "কাস্টম ফান্ড", bg: "bg-teal-100", text: "text-teal-800" };
  }
}

export function getPaymentMethodName(method?: string): string {
  switch (method) {
    case "Cash": return "নগদ (Cash)";
    case "bKash": return "বিকাশ (bKash)";
    case "Nagad": return "নগদ (Nagad)";
    case "Rocket": return "রকেট (Rocket)";
    case "Bank": return "ব্যাংক একাউন্ট (Bank)";
    case "Cheque": return "চেক (Cheque)";
    default: return method || "নগদ (Cash)";
  }
}

// Helper to parse fund & voucher metadata from description if stored like [FUND: fund_id | name][VOUCHER: voucher_no]
export function parseExpenseFund(rawDesc: string | null | undefined): { cleanDesc: string; fundId?: string; fundName?: string; voucherNo?: string } {
  const desc = (rawDesc || "").trim();
  let fundId = undefined;
  let fundName = undefined;
  let voucherNo = undefined;

  // Extract VOUCHER tag if present: [VOUCHER: EXP-YYMM-001]
  const vMatch = desc.match(/\[VOUCHER:\s*([^\]]+)\]/i);
  if (vMatch && vMatch[1]) {
    voucherNo = vMatch[1].trim();
  }

  // Extract FUND tag if present: [FUND: fund_id | name]
  const fMatch = desc.match(/\[FUND:\s*([^\]|]+)(?:\|\s*([^\]]+))?\]/i);
  if (fMatch) {
    fundId = fMatch[1]?.trim();
    if (fMatch[2]) {
      fundName = fMatch[2]?.trim();
    }
  }

  const cleanDesc = desc
    .replace(/\[FUND:[^\]]+\]\s*/gi, "")
    .replace(/\[VOUCHER:[^\]]+\]\s*/gi, "")
    .trim();

  return { cleanDesc, fundId, fundName, voucherNo };
}

// Canonical normalize fund names/codes/types into matching active fund names
export function normalizeFundName(input?: string | null, customFunds?: FundItem[]): string {
  return exactFundLabel(customFunds || DEFAULT_FUNDS,input)?.name || REVIEW_FUND.name;
}

// Exact IDs are the posting identity. Labels below are ONLY for reading old rows and
// picking a unique catalog entry in name-based legacy forms; never guess from free text.
const legacyLabels: Record<string, string[]> = {
  "fund-general": ["General", "সাধারণ", "সাধারণ ফান্ড", "সাধারণ তহবিল"],
  "fund-zakat": ["Zakat", "যাকাত", "যাকাত ফান্ড", "জাকাত ফান্ড"],
  "fund-lillah": ["Lillah", "লিল্লাহ", "লিল্লাহ ফান্ড", "লিল্লাহ বোর্ডিং ফান্ড", "লিল্লাহ বোর্ডিং ফান্ড (Lillah Boarding Fund)"],
  "fund-dev": ["Development", "fund-building", "উন্নয়ন ফান্ড", "মসজিদ ও নির্মাণ ফান্ড", "উন্নয়ন ও মেরামত ফান্ড", "মসজিদ ও উন্নয়ন ফান্ড"],
  "fund-fitra": ["Fitra", "ফিতরা", "ফিতরা ও সদকা ফান্ড"],
  "fund-orphan": ["Orphan", "এতিম কল্যাণ ফান্ড"],
};
export function exactFundLabel(funds: FundItem[], label?: string | null) {
  const key = label?.trim().toLowerCase();
  if (!key) return undefined;
  const matches = funds.filter(f => [f.name, f.code, f.id, ...(legacyLabels[f.id] || [])].some(s => s?.toLowerCase() === key));
  return matches.length === 1 ? matches[0] : undefined;
}
export function isRestrictedFund(f?: Pick<FundItem, "id" | "category" | "name" | "code">) {
  return !!f && /\bzkt\b|zakat|zakah|g[hou]+r[ao]ba|যাকাত|জাকাত|যাকাহ|গোরাবা|গুরাবা|গরাবা|গোরবা|গুরবা/i.test([f.id,f.name,f.code,f.category].join(" "));
}
export const REVIEW_FUND = {id: "__review__", name: "ফান্ড যাচাই প্রয়োজন", code: "—", category: "Other", is_active: false} satisfies FundItem;
export interface StoredFundFields {
  fund_id?: string | null; fund_name?: string | null; donation_type?: string | null;
  description?: string | null; notes?: string | null; items_details?: string | null;
}
export function storedFund(funds: FundItem[], row: StoredFundFields): FundItem | undefined {
  const tag = parseExpenseFund(row.description || row.notes);
  const bazarId = row.items_details?.match(/\bFUND:\s*([^|\]]+)/i)?.[1]?.trim();
  const ids = [...new Set([row.fund_id, tag.fundId, bazarId].filter(Boolean))];
  const labels = [row.fund_name, row.donation_type, tag.fundName, row.items_details?.match(/\bFUND_NAME:\s*([^|\]]+)/i)?.[1]?.trim()].filter(Boolean);
  const chosen = ids.length ? funds.find(f => f.id === ids[0]) : undefined;
  if (ids.length && (!chosen || ids.length !== 1)) return undefined;
  const labelled = labels.map(label => chosen && [chosen.name,chosen.code,chosen.id].includes(label!) ? chosen : exactFundLabel(funds, label));
  if (chosen) {
    // In particular, the old SQL default 'fund-general' is not proof that a
    // Zakat-labelled donation was General. Keep conflicting rows for review.
    if (labelled.some(f => !f || f.id !== chosen.id)) return undefined;
    if (!isRestrictedFund(chosen) && labels.some(name=>isRestrictedFund({id:'',category:'Other',code:'',name:name!}))) return undefined;
    if (chosen.id === "fund-general" && (labelled.some(f => !f) || (!labels.length && !tag.fundId && !bazarId))) return undefined;
    return chosen;
  }
  return labelled.length && labelled.every(f => f && f.id === labelled[0]?.id) ? labelled[0] : undefined;
}
export function isTransactionInFund(fund: FundItem, id?: string | null, name?: string | null, funds = DEFAULT_FUNDS): boolean {
  return (id ? funds.find(f => f.id === id) : exactFundLabel(funds, name))?.id === fund?.id;
}

// Fund fields in metadata-only collection streams predate relational posting.
export function collectionFund(funds: FundItem[], row: {fund_id?: string; fund_category?: string; fund_name?: string; target_fund?: string; purpose?: string}) {
  return storedFund(funds,{fund_id:row.fund_id, fund_name:row.fund_name || row.target_fund, donation_type:row.fund_category || row.purpose});
}
export type ReviewRow = { id: string; kind: "donation" | "expense" | "bazar"; voucher: string; date: string; amount: number; reason: string };
type SettlementRef = { id?: string; accounting_record_id?: string; accounting_voucher_no?: string;
  mahfil_txn_id?: string; fund_id?: string; amount?: number; settlement_type?: string };
export function settlementIndex(events: {settlements?: SettlementRef[]; settlement?: SettlementRef;transactions?:{id?:string;amount?:number;type?:string}[]}[] = []) {
  const index = new Map<string, (SettlementRef & {eventMatches:boolean})[]>();
  for (const event of events) {
    // Some old documents have only the singular field, others store a copy of the last entry in both.
    const entries = [...(event.settlements || [])];
    if (event.settlement && !entries.some(s => s.accounting_record_id===event.settlement?.accounting_record_id && s.accounting_voucher_no===event.settlement?.accounting_voucher_no && s.mahfil_txn_id===event.settlement?.mahfil_txn_id && s.amount===event.settlement?.amount && s.fund_id===event.settlement?.fund_id && s.settlement_type===event.settlement?.settlement_type)) entries.push(event.settlement);
    for (const s of entries) {
      const tx=(event.transactions || []).filter(t=>t.id && t.id===s.mahfil_txn_id);
      const eventMatches=tx.length===1 && Number(tx[0].amount)===Number(s.amount) && tx[0].type===(s.settlement_type==='SURPLUS_DEPOSIT'?'EXPENSE':s.settlement_type==='DEFICIT_COVER'?'INCOME':'');
      const ref={...s,eventMatches};
      for(const key of new Set([s.accounting_record_id,s.accounting_voucher_no,s.mahfil_txn_id]))if(key)index.set(key,[...(index.get(key)||[]),ref]);
    }
  }
  return index;
}
export function unmatchedMahfil(row: {id?: string; receipt_no?: string; voucher_no?: string; notes?: string; description?: string; fund_id?: string; amount?: number}, index: ReturnType<typeof settlementIndex>) {
  const voucher = row.receipt_no || row.voucher_no || parseExpenseFund(row.description).voucherNo || "";
  const candidates = [...new Set([...(index.get(row.id || '') || []),...(index.get(voucher) || [])])];
  if (!candidates.length) return /^(MHF-|EXP-MHF)/i.test(voucher) || /মাহফিল/.test(row.notes || row.description || '');
  // A colliding receipt number must not rescue a different ID, amount or fund.
  if (candidates.length !== 1) return true;
  const [s] = candidates;
  return !s.eventMatches || !s.accounting_record_id || s.accounting_record_id!==row.id || !voucher || voucher!==s.accounting_voucher_no ||
    !s.fund_id || s.fund_id!==row.fund_id || Number(s.amount)!==Number(row.amount) || (row.receipt_no?'SURPLUS_DEPOSIT':'DEFICIT_COVER')!==s.settlement_type;
}
export function bazarFund(funds: FundItem[], row: StoredFundFields) {
  // Before bazar introduced fund selection its own untagged records were Lillah.
  return !row.fund_id && !row.fund_name && !/\bFUND(?:_NAME)?:/i.test(row.items_details || "")
    ? funds.find(f => f.id === "fund-lillah") : storedFund(funds, row);
}

/**
 * খরচের রেকর্ড VOID (বাতিল) কি না তা নির্ধারণ করে।
 *
 * HI-5 ফিক্সের অংশ: আগে খরচ মুছে ফেলার একমাত্র উপায় ছিল হার্ড ডিলিট (কোনো চিহ্ন ছাড়াই)।
 * এখন `deleteExpense` soft-void করে — `status = 'VOID'` এবং description-এ
 * `[VOID: কারণ | BY: ... | AT: ...]` ট্যাগ। পুরোনো স্কিমায় `status` কলাম না থাকলেও
 * ট্যাগটি কাজ করে, তাই সব রিপোর্ট দুই ক্ষেত্রেই বাতিল খরচ বাদ দিতে পারে।
 */
export function isVoidedExpense(exp: any): boolean {
  if (!exp) return false;
  if (String(exp.status || "").toUpperCase() === "VOID") return true;
  return /\[VOID:/i.test(exp.description || exp.items_details || "");
}

/** খরচের description থেকে void-এর কারণ বের করে (রিপোর্টে দেখানোর জন্য)। */
export function getExpenseVoidReason(exp: any): string {
  const desc = typeof exp?.description === "string" ? exp.description : "";
  const m = desc.match(/\[VOID:\s*([^\]|]+)/i);
  return m?.[1]?.trim() || "";
}

/**
 * অনুদান/রসিদ বাতিল (VOID) কি না।
 *
 * গুরুত্বপূর্ণ: `donations.status` কলামটি বেস স্কিমায় নেই — তাই বাতিল অবস্থা নির্ভরযোগ্যভাবে
 * `notes`-এর `[VOID: ...]` ট্যাগ দিয়েই নির্ধারণ করা হয় (status থাকলে সেটিও বিবেচনায় নেওয়া হয়)।
 * আগে শুধু `status` দেখে চেক করা হতো, যা কলাম না থাকলে কখনো সত্য হতো না — ফলে বাতিল করা
 * অনুদান আয় হিসেবে গোনা হয়ে যেত।
 */
export function isVoidDonation(donation: any): boolean {
  if (!donation) return false;
  if (String(donation.status || "").toUpperCase() === "VOID") return true;
  const notes = typeof donation.notes === "string" ? donation.notes : "";
  return notes.includes("[VOID:");
}
