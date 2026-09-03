export type AssetCategory =
  | "BOARDING"
  | "ELECTRICAL"
  | "FURNITURE"
  | "AUDIO_OFFICE"
  | "KITCHEN"
  | "GENERAL";

export interface AssetItem {
  id: string;
  asset_code: string; // e.g. AST-BDG-001
  name: string;
  category: AssetCategory;
  category_name: string;
  total_qty: number;
  in_stock_qty: number;
  allocated_qty: number;
  damaged_qty: number;
  condition: "EXCELLENT" | "GOOD" | "NEEDS_REPAIR" | "DAMAGED";
  purchase_date: string;
  purchase_price_per_unit: number;
  total_value: number;
  vendor_or_donor?: string;
  voucher_no?: string;
  room_location?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  is_archived?: boolean;
}

export interface AssetAllocation {
  id: string;
  asset_id: string;
  asset_name: string;
  asset_code: string;
  location_or_room: string; // e.g. "বোর্ডিং রুম ১০১ (দারুল ইক্বামাহ)"
  assigned_to_person?: string; // e.g. "মাওলানা নুরুল হক (হোস্টেল সুপার)"
  quantity: number;
  allocation_date: string;
  return_date?: string;
  status: "ACTIVE" | "RETURNED" | "DAMAGED";
  remarks?: string;
}

export interface MaintenanceRecord {
  id: string;
  asset_id: string;
  asset_name: string;
  asset_code: string;
  maintenance_date: string;
  issue_description: string;
  work_done: string;
  cost: number;
  technician_or_shop: string;
  voucher_no?: string;
  fund_name: string;
  auto_add_to_expense?: boolean;
  created_at: string;
}

export const ASSET_CATEGORIES: { id: AssetCategory; name: string; icon: string }[] = [
  { id: "BOARDING", name: "বোর্ডিং ও ছাত্রাবাস (খাট-তোশক)", icon: "Bed" },
  { id: "ELECTRICAL", name: "বৈদ্যুতিক ও ফ্যান-লাইট", icon: "Zap" },
  { id: "FURNITURE", name: "আসবাবপত্র (বেঞ্চ, রেহাল, টেবিল)", icon: "Armchair" },
  { id: "AUDIO_OFFICE", name: "মাইক ও অফিস সরঞ্জাম", icon: "Speaker" },
  { id: "KITCHEN", name: "রান্নাঘর ও ডাইনিং তৈজসপত্র", icon: "Utensils" },
  { id: "GENERAL", name: "অন্যান্য স্থায়ী সম্পদ", icon: "Box" },
];

export function generateAssetCode(category: AssetCategory, seq: number): string {
  const prefixMap: Record<AssetCategory, string> = {
    BOARDING: "BDG",
    ELECTRICAL: "ELE",
    FURNITURE: "FRN",
    AUDIO_OFFICE: "AUD",
    KITCHEN: "KIT",
    GENERAL: "GEN",
  };
  const prefix = prefixMap[category] || "AST";
  return `AST-${prefix}-${String(seq).padStart(3, "0")}`;
}

export function getDefaultInventorySeed(madrasaId: string): {
  items: AssetItem[];
  allocations: AssetAllocation[];
  maintenance: MaintenanceRecord[];
} {
  const now = new Date().toISOString();
  const today = now.split("T")[0];

  const items: AssetItem[] = [
    {
      id: `ast_${madrasaId.substring(0, 6)}_01`,
      asset_code: "AST-BDG-001",
      name: "লোহার দোতলা বাংক বেড (Double Decker Bed)",
      category: "BOARDING",
      category_name: "বোর্ডিং ও ছাত্রাবাস (খাট-তোশক)",
      total_qty: 40,
      allocated_qty: 36,
      in_stock_qty: 4,
      damaged_qty: 0,
      condition: "GOOD",
      purchase_date: "2024-03-15",
      purchase_price_per_unit: 8500,
      total_value: 340000,
      vendor_or_donor: "আল-আমিন স্টিল ওয়ার্কশপ",
      voucher_no: "VR-2024-102",
      room_location: "দারুল ইক্বামাহ বোর্ডিং ভবন",
      description: "মজবুত লোহার অ্যাঙ্গেল দিয়ে তৈরি দোতলা খাট",
      created_at: now,
      updated_at: now,
    },
    {
      id: `ast_${madrasaId.substring(0, 6)}_02`,
      asset_code: "AST-BDG-002",
      name: "তুলা ও ফোমের আরামদায়ক তোশক (Mattress)",
      category: "BOARDING",
      category_name: "বোর্ডিং ও ছাত্রাবাস (খাট-তোশক)",
      total_qty: 80,
      allocated_qty: 72,
      in_stock_qty: 6,
      damaged_qty: 2,
      condition: "GOOD",
      purchase_date: "2024-03-20",
      purchase_price_per_unit: 1600,
      total_value: 128000,
      vendor_or_donor: "হাফেজ স্টোর বেডিং",
      voucher_no: "VR-2024-118",
      room_location: "বোর্ডিং স্টোর রুম",
      description: "ছাত্রাবাসের খাট সাইজের স্ট্যান্ডার্ড তোশক",
      created_at: now,
      updated_at: now,
    },
    {
      id: `ast_${madrasaId.substring(0, 6)}_03`,
      asset_code: "AST-ELE-001",
      name: "পাকপাখা ৫৬ ইঞ্চি সিলিং ফ্যান (Ceiling Fan)",
      category: "ELECTRICAL",
      category_name: "বৈদ্যুতিক ও ফ্যান-লাইট",
      total_qty: 35,
      allocated_qty: 32,
      in_stock_qty: 2,
      damaged_qty: 1,
      condition: "EXCELLENT",
      purchase_date: "2023-05-10",
      purchase_price_per_unit: 3400,
      total_value: 119000,
      vendor_or_donor: "মদিনা ইলেকট্রিক অ্যান্ড ফ্যান",
      voucher_no: "VR-2023-45",
      room_location: "বিভিন্ন ক্লাসরুম ও বোর্ডিং",
      description: "১০০% কপার তারের এনার্জি সেভিং ফ্যান",
      created_at: now,
      updated_at: now,
    },
    {
      id: `ast_${madrasaId.substring(0, 6)}_04`,
      asset_code: "AST-ELE-002",
      name: "২০ ওয়াট এনার্জি এলইডি টিউব লাইট (LED Light)",
      category: "ELECTRICAL",
      category_name: "বৈদ্যুতিক ও ফ্যান-লাইট",
      total_qty: 60,
      allocated_qty: 54,
      in_stock_qty: 6,
      damaged_qty: 0,
      condition: "GOOD",
      purchase_date: "2025-01-12",
      purchase_price_per_unit: 350,
      total_value: 21000,
      vendor_or_donor: "সুফিয়া ইলেকট্রনিক্স",
      voucher_no: "VR-2025-08",
      room_location: "সেন্ট্রাল ইলেকট্রিক স্টোর",
      description: "ডে-লাইট এলইডি ফিলিপস টিউব",
      created_at: now,
      updated_at: now,
    },
    {
      id: `ast_${madrasaId.substring(0, 6)}_05`,
      asset_code: "AST-FRN-001",
      name: "হিফজখানা কাঠের রেহাল (Quran Stand/Rehal)",
      category: "FURNITURE",
      category_name: "আসবাবপত্র (বেঞ্চ, রেহাল, টেবিল)",
      total_qty: 70,
      allocated_qty: 65,
      in_stock_qty: 5,
      damaged_qty: 0,
      condition: "EXCELLENT",
      purchase_date: "2024-08-01",
      purchase_price_per_unit: 550,
      total_value: 38500,
      vendor_or_donor: "হাজী শামসুল হক (দাতা অনুদান)",
      voucher_no: "DON-FRN-04",
      room_location: "হিফজুল কুরআন বিভাগ",
      description: "মেহগনি কাঠের তৈরি মজবুত রেহাল",
      created_at: now,
      updated_at: now,
    },
    {
      id: `ast_${madrasaId.substring(0, 6)}_06`,
      asset_code: "AST-AUD-001",
      name: "আহুজা সাউন্ড সিস্টেম ও ৩টি আউটডোর মাইক",
      category: "AUDIO_OFFICE",
      category_name: "মাইক ও অফিস সরঞ্জাম",
      total_qty: 3,
      allocated_qty: 3,
      in_stock_qty: 0,
      damaged_qty: 0,
      condition: "GOOD",
      purchase_date: "2023-11-20",
      purchase_price_per_unit: 38000,
      total_value: 114000,
      vendor_or_donor: "সাউন্ড ভিশন ঢাকা",
      voucher_no: "VR-2023-99",
      room_location: "জামে মসজিদ মিনার ও অডিটোরিয়াম",
      description: "২৫০ ওয়াট এমপ্লিফায়ার, ইউনিট ও ওয়্যারলেস মাইক সেট",
      created_at: now,
      updated_at: now,
    },
    {
      id: `ast_${madrasaId.substring(0, 6)}_07`,
      asset_code: "AST-AUD-002",
      name: "ডেল কোর আই-৫ অফিস কম্পিউটার ও প্রিন্টার",
      category: "AUDIO_OFFICE",
      category_name: "মাইক ও অফিস সরঞ্জাম",
      total_qty: 2,
      allocated_qty: 2,
      in_stock_qty: 0,
      damaged_qty: 0,
      condition: "EXCELLENT",
      purchase_date: "2024-02-10",
      purchase_price_per_unit: 52000,
      total_value: 104000,
      vendor_or_donor: "স্টার টেক কম্পিউটার",
      voucher_no: "VR-2024-34",
      room_location: "প্রধান মুহতামিম ও হিসাব শাখা",
      description: "প্রশাসনিক কাজ, মার্কশিট ও ভর্তি ডেটা এন্ট্রির জন্য",
      created_at: now,
      updated_at: now,
    },
    {
      id: `ast_${madrasaId.substring(0, 6)}_08`,
      asset_code: "AST-KIT-001",
      name: "বোর্ডিং বড় রান্নার ডেকচি ও ঢাকনা (১০০ কেজি ক্যাপাসিটি)",
      category: "KITCHEN",
      category_name: "রান্নাঘর ও ডাইনিং তৈজসপত্র",
      total_qty: 6,
      allocated_qty: 5,
      in_stock_qty: 1,
      damaged_qty: 0,
      condition: "GOOD",
      purchase_date: "2023-01-15",
      purchase_price_per_unit: 14500,
      total_value: 87000,
      vendor_or_donor: "চকবাজার এ্যালুমিনিয়াম ভান্ডার",
      voucher_no: "VR-2023-12",
      room_location: "লিল্লাহ বোর্ডিং পাকশালা",
      description: "খাবারের চাল ও ডাল রান্নার জন্য ভারী এ্যালুমিনিয়াম ডেকচি",
      created_at: now,
      updated_at: now,
    },
  ];

  const allocations: AssetAllocation[] = [
    {
      id: `alc_${madrasaId.substring(0, 6)}_01`,
      asset_id: items[0].id,
      asset_name: items[0].name,
      asset_code: items[0].asset_code,
      location_or_room: "বোর্ডিং রুম ১০১ (দারুল ইক্বামাহ)",
      assigned_to_person: "মাওলানা নুরুল হক (হোস্টেল সুপার)",
      quantity: 10,
      allocation_date: "2024-04-01",
      status: "ACTIVE",
      remarks: "১০টি খাট বরাদ্দ, ২০ জন ছাত্রের আবাসন",
    },
    {
      id: `alc_${madrasaId.substring(0, 6)}_02`,
      asset_id: items[1].id,
      asset_name: items[1].name,
      asset_code: items[1].asset_code,
      location_or_room: "বোর্ডিং রুম ১০১ (দারুল ইক্বামাহ)",
      assigned_to_person: "মাওলানা নুরুল হক (হোস্টেল সুপার)",
      quantity: 20,
      allocation_date: "2024-04-01",
      status: "ACTIVE",
      remarks: "২০টি তোশক",
    },
    {
      id: `alc_${madrasaId.substring(0, 6)}_03`,
      asset_id: items[2].id,
      asset_name: items[2].name,
      asset_code: items[2].asset_code,
      location_or_room: "হেফজখানা প্রধান হলরুম",
      assigned_to_person: "হাফেজ ক্বারী ইলিয়াস",
      quantity: 6,
      allocation_date: "2024-04-05",
      status: "ACTIVE",
      remarks: "হলরুমে ৬টি সিলিং ফ্যান সচল",
    },
    {
      id: `alc_${madrasaId.substring(0, 6)}_04`,
      asset_id: items[4].id,
      asset_name: items[4].name,
      asset_code: items[4].asset_code,
      location_or_room: "হেফজখানা প্রধান হলরুম",
      assigned_to_person: "হাফেজ ক্বারী ইলিয়াস",
      quantity: 45,
      allocation_date: "2024-08-02",
      status: "ACTIVE",
      remarks: "তিলাওয়াতের জন্য রেহাল",
    },
  ];

  const maintenance: MaintenanceRecord[] = [
    {
      id: `mnt_${madrasaId.substring(0, 6)}_01`,
      asset_id: items[2].id,
      asset_name: items[2].name,
      asset_code: items[2].asset_code,
      maintenance_date: "2025-05-12",
      issue_description: "বোর্ডিং রুম ১০২ এর ফ্যানের কয়েল পুড়ে যাওয়া ও বিয়ারিং জ্যাম",
      work_done: "নতুন তামা দিয়ে কয়েল রিওয়াইন্ডিং ও নতুন বিয়ারিং লাগানো",
      cost: 850,
      technician_or_shop: "ভাই ভাই ইলেকট্রিক ওয়ার্কস",
      voucher_no: "MNT-2025-03",
      fund_name: "সাধারণ ফান্ড",
      auto_add_to_expense: true,
      created_at: now,
    },
    {
      id: `mnt_${madrasaId.substring(0, 6)}_02`,
      asset_id: items[0].id,
      asset_name: items[0].name,
      asset_code: items[0].asset_code,
      maintenance_date: "2025-08-20",
      issue_description: "রুম ১০৩ এর খাটের সাইড অ্যাঙ্গেল ঝালাই ভেঙে যাওয়া",
      work_done: "গ্যাস ওয়েল্ডিং ও নতুন সাপোর্ট রড লাগানো",
      cost: 500,
      technician_or_shop: "বিসমিল্লাহ ইঞ্জিনিয়ারিং",
      voucher_no: "MNT-2025-11",
      fund_name: "উন্নয়ন ফান্ড",
      auto_add_to_expense: true,
      created_at: now,
    },
    {
      id: `mnt_${madrasaId.substring(0, 6)}_03`,
      asset_id: items[6].id,
      asset_name: items[6].name,
      asset_code: items[6].asset_code,
      maintenance_date: "2026-01-10",
      issue_description: "অফিস এইচপি লেজারজেট প্রিন্টারের টোনার রিফিল ও ড্রাম পরিবর্তন",
      work_done: "ড্রাম বদলানো এবং ১২এ ব্ল্যাক টোনার ফুল রিফিল",
      cost: 1200,
      technician_or_shop: "আইটি সল্যুশন মতিঝিল",
      voucher_no: "MNT-2026-02",
      fund_name: "সাধারণ ফান্ড",
      auto_add_to_expense: true,
      created_at: now,
    },
  ];

  return { items, allocations, maintenance };
}
