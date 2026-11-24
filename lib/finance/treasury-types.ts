export interface Head {
  id: string;
  name: string;
  policy: string;
  active: boolean;
}
export interface Choice {
  id: string;
  name: string;
}
export interface Cashbook {
  day: string;
  operator: string;
  operatorName: string;
  opening: number | null;
  collected: number;
  expenses: number;
  handedIn: number;
  handedOut: number;
  deposited: number;
  expected: number | null;
  counted: number | null;
  variance: number | null;
  note: string | null;
  closed: boolean;
  recipients: Choice[];
  rows: {
    source: string;
    id: string;
    reference: string | null;
    amount: number;
    incoming: boolean;
  }[];
  moves: {
    id: string;
    sender: string;
    recipient: string | null;
    reference: string;
    amount: number;
    cancelled_at: string | null;
    accepted_at: string | null;
  }[];
}
export interface ActionResult {
  ok?: boolean;
  message: string;
}
export const policies: Record<string, string> = {
  Food: "খাবার",
  Utility: "ইউটিলিটি",
  Maintenance: "রক্ষণাবেক্ষণ",
  Salary: "বেতন",
  Other: "অন্যান্য",
};
export const tenders: Record<string, string> = {
  Cash: "হাতে নগদ",
  Bank: "ব্যাংক",
  bKash: "বিকাশ",
  Nagad: "নগদ ওয়ালেট",
  Rocket: "রকেট",
  Cheque: "চেক",
  Online: "অনলাইন গেটওয়ে",
  Other: "অন্যান্য (নগদ নয়)",
};
