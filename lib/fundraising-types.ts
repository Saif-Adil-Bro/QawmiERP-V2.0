export type MahfilStatus = "UPCOMING" | "ONGOING" | "COMPLETED" | "ARCHIVED";

export interface MahfilSpeaker {
  id: string;
  name: string;
  title?: string;
  designation?: string;
  topic?: string;
  date?: string;
  time_slot?: string;
  phone?: string;
  agreed_hadia?: number;
  paid_hadia?: number;
  status?: "CONFIRMED" | "INVITED" | "DECLINED" | "COMPLETED";
  notes?: string;
}

export interface MahfilReceiptBook {
  id: string;
  // --- ১. রশিদ সংক্রান্ত ফিল্ড (Receipt Details) ---
  book_no: string;
  category: string;
  page_from: number;
  page_to: number;
  total_pages: number;
  rate_per_page?: number;
  expected_amount?: number;
  receipt_type?: string;

  // --- ২. বিতরণ সংক্রান্ত ফিল্ড (Distribution Details) ---
  is_distributed?: boolean;
  issued_to_name: string;
  issued_to_type: "উস্তাদ" | "ছাত্র" | "কমিটি সদস্য" | "মুহিব্বিন/স্বেচ্ছাসেবক" | "প্রতিনিধি";
  issued_to_phone?: string;
  issued_to_jamath?: string;
  issued_to_area?: string;
  issued_date: string;
  distributed_pages?: number;
  issued_by?: string;

  // --- ৩. জমা সংক্রান্ত ফিল্ড (Deposit Details) ---
  is_deposited?: boolean;
  return_date?: string;
  used_pages?: number;
  returned_pages?: number;
  total_collected: number;
  payment_method?: string;
  deposit_voucher_no?: string;
  received_by?: string;
  due_amount?: number;
  status: "ISSUED" | "PARTIALLY_RETURNED" | "RETURNED" | "OVERDUE";
  notes?: string;
}

export interface MahfilTransaction {
  id: string;
  mahfil_id: string;
  type: "INCOME" | "EXPENSE";
  category: string;
  amount: number;
  description: string;
  date: string;
  receipt_no?: string;
  paid_to_or_received_from?: string;
  payment_method: "Cash" | "bKash" | "Nagad" | "Bank" | "Other";
  voucher_no?: string;
}

export interface Mahfil {
  id: string;
  madrasa_id: string;
  title: string;
  year: string;
  hijri_year?: string;
  start_date: string;
  end_date: string;
  venue: string;
  president?: string;
  host?: string;
  target_budget?: number;
  speakers: MahfilSpeaker[];
  receipt_books: MahfilReceiptBook[];
  transactions: MahfilTransaction[];
  status: MahfilStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// -------------------------------------------------------------
// Donors & Life Members
// -------------------------------------------------------------
export type DonorMemberType =
  | "LIFE_MEMBER"
  | "MONTHLY_DONOR"
  | "ANNUAL_DONOR"
  | "WELL_WISHER"
  | "MONTHLY"
  | "YEARLY"
  | "ONETIME";

export interface LifeMemberDonor {
  id: string;
  madrasa_id: string;
  member_no: string;
  name: string;
  father_name?: string;
  phone: string;
  email?: string;
  address: string;
  occupation?: string;
  blood_group?: string;
  member_type: DonorMemberType;
  membership_type?: DonorMemberType;
  pledge_amount: number;
  committed_amount?: number;
  total_donated?: number;
  preferred_fund: string;
  collection_day?: number;
  payment_method?: string;
  account_or_trx_no?: string;
  join_date: string;
  joined_date?: string;
  status: "ACTIVE" | "INACTIVE";
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DonorSubscriptionPayment {
  id: string;
  donor_id: string;
  donor_name?: string;
  month: string;
  amount: number;
  payment_date?: string;
  date?: string;
  payment_method: string;
  trx_id?: string;
  receipt_no: string;
  fund_name?: string;
  fund_category?: string;
  notes?: string;
  collected_by?: string;
  collector_name?: string;
  created_at?: string;
}

// -------------------------------------------------------------
// Qurbani Leather & Collection Boxes
// -------------------------------------------------------------
export type LeatherType = "COW" | "GOAT" | "BUFFALO" | "SHEEP" | "গরু" | "ছাগল" | "মহিষ" | "ভেড়া";

export interface QurbaniLeatherRecord {
  id: string;
  madrasa_id: string;
  year: string;
  hijri_year?: string;
  leather_type: LeatherType;
  type?: LeatherType;
  quantity: number;
  area_team?: string;
  buyer_name: string;
  buyer_phone?: string;
  rate_per_unit: number;
  rate_per_piece?: number;
  total_sale_price: number;
  total_sale_amount?: number;
  received_amount: number;
  paid_amount?: number;
  due_amount: number;
  transport_labour_cost: number;
  transport_labor_cost?: number;
  net_profit: number;
  collection_date: string;
  date?: string;
  sale_date?: string;
  payment_status: "PAID" | "PARTIAL" | "DUE";
  notes?: string;
  created_at: string;
}

export interface DonationBox {
  id: string;
  madrasa_id: string;
  box_code: string;
  location_name: string;
  area: string;
  contact_person: string;
  responsible_person?: string;
  phone: string;
  responsible_phone?: string;
  install_date: string;
  installation_date?: string;
  status: "ACTIVE" | "INACTIVE";
  last_collection_date?: string;
  last_opened_date?: string;
  total_collected_lifetime: number;
  total_collected?: number;
  collection_logs?: DonationBoxCollectionLog[];
  notes?: string;
  created_at: string;
}

export interface DonationBoxCollectionLog {
  id: string;
  box_id: string;
  box_code?: string;
  location_name?: string;
  collection_date?: string;
  date?: string;
  amount: number;
  collector_name?: string;
  witness_name?: string;
  witnesses?: string;
  receipt_no?: string;
  notes?: string;
  created_at?: string;
}

// -------------------------------------------------------------
// Online Donations & Settings
// -------------------------------------------------------------
export interface OnlineDonationSettings {
  bkash_number: string;
  bkash_type: "Merchant" | "Personal" | "Agent";
  nagad_number: string;
  nagad_type: "Personal" | "Merchant";
  rocket_number: string;
  rocket_type: "Personal" | "Merchant";
  bank_name: string;
  bank_branch: string;
  bank_account_name: string;
  bank_account_no: string;
  bank_routing_no: string;
  gateway_enabled: boolean;
  gateway_provider?: string;
  instructions?: string;
  updated_at?: string;
}

export const DEFAULT_ONLINE_DONATION_SETTINGS: OnlineDonationSettings = {
  bkash_number: "01600-989555",
  bkash_type: "Merchant",
  nagad_number: "01800-000000",
  nagad_type: "Personal",
  rocket_number: "01900-000000",
  rocket_type: "Personal",
  bank_name: "ইসলামী ব্যাংক বাংলাদেশ পিএলসি",
  bank_branch: "মিরপুর শাখা, ঢাকা",
  bank_account_name: "আলহাজ্ব আবুল হোসেন হাফিজিয়া মাদ্রাসা",
  bank_account_no: "20501234567890",
  bank_routing_no: "125272654",
  gateway_enabled: true,
  gateway_provider: "SSLCOMMERZ",
  instructions: "সরাসরি মার্চেন্ট বা পার্সোনাল নম্বরে সেন্ড মানি/পেমেন্ট করে ট্রানজেকশন আইডি (TrxID) দিয়ে সাবমিট করুন। অথবা গেটওয়ের মাধ্যমে সরাসরি পরিশোধ করুন।",
};

export interface OnlineDonation {
  id: string;
  madrasa_id: string;
  donor_name: string;
  phone: string;
  donor_phone?: string;
  email?: string;
  donor_email?: string;
  country?: string;
  address?: string;
  fund_category: string;
  amount: number;
  payment_method: "bKash" | "Nagad" | "Rocket" | "Bank" | "Online Gateway" | "Other";
  trx_id: string;
  donation_date: string;
  date?: string;
  receipt_no: string;
  status: "VERIFIED" | "PENDING" | "REJECTED";
  is_gateway?: boolean;
  gateway_provider?: string;
  message?: string;
  notes?: string;
  is_anonymous?: boolean;
  verified_by?: string;
  verified_at?: string;
  created_at: string;
}

// Aliases for compatibility
export type Donor = LifeMemberDonor;
export type DonorPayment = DonorSubscriptionPayment;
export type QurbaniLeatherBatch = QurbaniLeatherRecord;
export type CollectionBox = DonationBox;
export type BoxCollectionLog = DonationBoxCollectionLog;
