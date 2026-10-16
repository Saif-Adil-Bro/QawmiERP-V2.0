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
  if (!input || typeof input !== "string") return "সাধারণ ফান্ড (General Fund)";
  const trimmed = input.trim();
  if (!trimmed) return "সাধারণ ফান্ড (General Fund)";

  // If a list of known funds is passed, check exact or code match first
  if (customFunds && customFunds.length > 0) {
    const found = customFunds.find(
      (f) =>
        f.name === trimmed ||
        f.code?.toLowerCase() === trimmed.toLowerCase() ||
        f.id === trimmed ||
        f.name.toLowerCase() === trimmed.toLowerCase() ||
        (trimmed.length > 3 && f.name.toLowerCase().includes(trimmed.toLowerCase())) ||
        (f.name.length > 3 && trimmed.toLowerCase().includes(f.name.toLowerCase()))
    );
    if (found) return found.name;
  }

  const lower = trimmed.toLowerCase();

  // 1. Zakat Fund
  if (
    lower === "zakat" ||
    lower === "zkt" ||
    lower === "fund-zakat" ||
    trimmed.includes("যাকাত") ||
    lower.includes("zakat")
  ) {
    return "যাকাত ফান্ড (Zakat Fund)";
  }

  // 2. Lillah Boarding Fund
  if (
    lower === "lillah" ||
    lower === "lil" ||
    lower === "fund-lillah" ||
    trimmed.includes("লিল্লাহ") ||
    trimmed.includes("খোরাকি") ||
    trimmed.includes("বোর্ডিং") ||
    trimmed.includes("খাবার") ||
    trimmed.includes("খাদ্য") ||
    lower.includes("hostel") ||
    lower.includes("boarding") ||
    lower.includes("lillah")
  ) {
    return "লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)";
  }

  // 3. Fitra & Sadaqah Fund (Fitra, specific Sadaqah)
  if (
    lower === "fitra" ||
    lower === "ftr" ||
    lower === "sadaqah" ||
    lower === "sadqah" ||
    lower === "fund-fitra" ||
    trimmed.includes("ফিতরা") ||
    trimmed.includes("সদকাতুল ফিতর") ||
    trimmed.includes("সদকা") ||
    lower.includes("fitra") ||
    lower.includes("sadaqah")
  ) {
    return "ফিতরা ও সদকা ফান্ড (Fitra & Sadaqah)";
  }

  // 4. Mosque & Development Fund
  if (
    lower === "development" ||
    lower === "dev" ||
    lower === "building" ||
    lower === "fund-dev" ||
    trimmed.includes("মসজিদ ও উন্নয়ন") ||
    trimmed.includes("উন্নয়ন ও নির্মাণ") ||
    trimmed.includes("উন্নয়ন ফান্ড") ||
    trimmed.includes("মসজিদ ফান্ড") ||
    trimmed.includes("নির্মাণ") ||
    trimmed.includes("মসজিদ") ||
    lower.includes("dev") ||
    lower.includes("building") ||
    lower.includes("construction")
  ) {
    return "মসজিদ ও উন্নয়ন ফান্ড (Development Fund)";
  }

  // 5. Orphan Welfare Fund
  if (
    lower === "orphan" ||
    lower === "orp" ||
    lower === "education" ||
    lower === "fund-orphan" ||
    trimmed.includes("এতিম কল্যাণ") ||
    trimmed.includes("এতিমখানা") ||
    trimmed.includes("এতিম") ||
    lower.includes("orphan")
  ) {
    return "এতিম কল্যাণ ফান্ড (Orphan Welfare Fund)";
  }

  // 6. General Fund (Tuition, General Donation, Grant, Subscriptions, One-time, Unspecified donations)
  if (
    lower === "general" ||
    lower === "gen" ||
    lower === "fund-general" ||
    lower === "onetime" ||
    lower === "monthly" ||
    lower === "annual" ||
    lower === "donation" ||
    lower === "donations" ||
    trimmed.includes("সাধারণ") ||
    trimmed.includes("দান") ||
    trimmed.includes("অনুদান") ||
    trimmed.includes("চাঁদা") ||
    trimmed.includes("বেতন") ||
    trimmed.includes("ভর্তি") ||
    trimmed.includes("টিউশন") ||
    trimmed.includes("ফি") ||
    trimmed.includes("এককালীন") ||
    trimmed.includes("সদস্য") ||
    lower.includes("tuition") ||
    lower.includes("general") ||
    lower.includes("donation") ||
    lower.includes("fee")
  ) {
    return "সাধারণ ফান্ড (General Fund)";
  }

  // Default fallback to General Fund for any donation record
  return "সাধারণ ফান্ড (General Fund)";
}

// Robust helper to check if a donation or transaction belongs to a given fund
export function isTransactionInFund(
  fund: FundItem,
  itemFundId?: string | null,
  itemFundName?: string | null,
  allFunds?: FundItem[]
): boolean {
  if (!fund) return false;
  const fId = (fund.id || "").toLowerCase().trim();
  const fName = (fund.name || "").toLowerCase().trim();
  const fCode = (fund.code || "").toLowerCase().trim();
  const fCategory = (fund.category || "").toLowerCase().trim();

  const candidateId = (itemFundId || "").toLowerCase().trim();
  const candidateName = (itemFundName || "").toLowerCase().trim();

  // ONLY truly general funds are marked as General Fund (never Zakat, Lillah, etc. even if is_default is true)
  const isGeneralFund =
    fId === "fund-general" ||
    fId === "gen" ||
    fCategory === "general" ||
    (fName.includes("সাধারণ") &&
      !fName.includes("যাকাত") &&
      !fName.includes("লিল্লাহ") &&
      !fName.includes("ফিতরা") &&
      !fName.includes("উন্নয়ন") &&
      !fName.includes("মসজিদ") &&
      !fName.includes("এতিম"));

  // If candidate has no fund specified at all, it belongs strictly to General Fund
  if (!candidateId && !candidateName) {
    return isGeneralFund;
  }

  // Exact ID match
  if (fId && candidateId && fId === candidateId) return true;

  // Exact Name or Code match
  if (fName && candidateName && fName === candidateName) return true;
  if (fCode && candidateName && fCode === candidateName) return true;
  if (fCode && candidateId && fCode === candidateId) return true;

  // Specific Fund Keywords Identification
  const isCandidateZakat =
    candidateId.includes("zakat") ||
    candidateId === "zkt" ||
    candidateName.includes("যাকাত") ||
    candidateName.includes("zakat");

  const isCandidateLillah =
    candidateId.includes("lillah") ||
    candidateId === "lil" ||
    candidateName.includes("লিল্লাহ") ||
    candidateName.includes("খোরাকি") ||
    candidateName.includes("বোর্ডিং") ||
    candidateName.includes("খাবার") ||
    candidateName.includes("lillah") ||
    candidateName.includes("hostel");

  const isCandidateFitra =
    candidateId.includes("fitra") ||
    candidateId === "ftr" ||
    candidateName.includes("ফিতরা") ||
    candidateName.includes("সদকা") ||
    candidateName.includes("fitra") ||
    candidateName.includes("sadaqah");

  const isCandidateDev =
    candidateId.includes("dev") ||
    candidateName.includes("উন্নয়ন") ||
    candidateName.includes("মসজিদ") ||
    candidateName.includes("নির্মাণ") ||
    candidateName.includes("development") ||
    candidateName.includes("building");

  const isCandidateOrphan =
    candidateId.includes("orphan") ||
    candidateId === "orp" ||
    candidateName.includes("এতিম") ||
    candidateName.includes("orphan");

  const isFundZakat =
    fId.includes("zakat") ||
    fCode === "zkt" ||
    fCategory === "zakat" ||
    fName.includes("যাকাত");

  const isFundLillah =
    fId.includes("lillah") ||
    fCode === "lil" ||
    fCategory === "lillah" ||
    fName.includes("লিল্লাহ") ||
    fName.includes("বোর্ডিং");

  const isFundFitra =
    fId.includes("fitra") ||
    fCode === "ftr" ||
    fCategory === "fitra" ||
    fName.includes("ফিতরা");

  const isFundDev =
    fId.includes("dev") ||
    fCategory === "development" ||
    fName.includes("উন্নয়ন") ||
    fName.includes("মসজিদ");

  const isFundOrphan =
    fId.includes("orphan") ||
    fCode === "orp" ||
    fCategory === "education" ||
    fName.includes("এতিম");

  // Check specific targeted fund matches
  if (isFundZakat) return isCandidateZakat;
  if (isFundLillah) return isCandidateLillah;
  if (isFundFitra) return isCandidateFitra;
  if (isFundDev) return isCandidateDev;
  if (isFundOrphan) return isCandidateOrphan;

  // If this fund is General Fund
  if (isGeneralFund) {
    // If candidate belongs to any other specific fund (Zakat, Lillah, Fitra, Dev, Orphan),
    // it MUST NOT be included in General Fund!
    if (isCandidateZakat || isCandidateLillah || isCandidateFitra || isCandidateDev || isCandidateOrphan) {
      return false;
    }
    return true;
  }

  // Custom funds (user created)
  const fundsList = allFunds || DEFAULT_FUNDS;
  const canonA = normalizeFundName(fund.name, fundsList).toLowerCase().trim();
  const canonB = normalizeFundName(candidateName || candidateId, fundsList).toLowerCase().trim();

  if (canonA && canonB && canonA === canonB) return true;

  if (fName && candidateName) {
    const cleanFName = fName.replace(/\(.*?\)/g, "").replace(/ফান্ড/g, "").trim();
    const cleanCName = candidateName.replace(/\(.*?\)/g, "").replace(/ফান্ড/g, "").trim();
    if (cleanFName.length >= 3 && cleanCName.length >= 3) {
      if (cleanFName.includes(cleanCName) || cleanCName.includes(cleanFName)) {
        return true;
      }
    }
  }

  return false;
}


