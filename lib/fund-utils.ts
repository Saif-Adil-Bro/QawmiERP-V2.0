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
  created_at?: string;
  donors?: {
    id?: string;
    name: string;
    phone?: string;
    address?: string;
    donor_type?: string;
  } | null;
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
