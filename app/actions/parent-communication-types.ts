export interface ParentFeedbackItem {
  id: string;
  madrasa_id: string;
  action_type: "COMPLAINT" | "SUGGESTION" | "APPOINTMENT" | "GENERAL";
  type_bangla: string; // অভিযোগ, পরামর্শ, অ্যাপয়েন্টমেন্ট, সাধারণ
  category: string; // পড়াশোনা, হিফজ, বোর্ডিং ও খাবার, স্বাস্থ্য ও আচরণ, ফি ও হিসাব, অন্যান্য
  subject: string;
  description: string;
  student_id?: string;
  student_name?: string;
  student_roll?: string;
  class_name?: string;
  guardian_name: string;
  guardian_phone: string;
  urgency: "Normal" | "Important" | "Urgent"; // সাধারণ, জরুরি, অতি জরুরি
  urgency_bangla: string;
  preferred_date?: string; // For appointments
  preferred_time?: string; // For appointments
  target_person?: string; // e.g., মুহতামিম সাহেব, শ্রেণি শিক্ষক, হিফজ শিক্ষক, হিসাবরক্ষক
  status: "PENDING" | "IN_REVIEW" | "RESOLVED" | "CLOSED";
  status_bangla: string;
  official_response?: string;
  responded_by?: string;
  responded_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface AbsentStudentInfo {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  roll_number: string;
  class_name: string;
  class_id?: string;
  father_name?: string;
  parent_phone: string;
  status: string;
  date: string;
  customMessage: string;
  whatsappUrl?: string;
  // Granular absence tracking metrics
  consecutiveDays: number;
  monthlyAbsenceCount: number;
  isThresholdMet: boolean;
  thresholdReason?: string;
}

export interface AbsenceAlertSettings {
  isAutoEnabled: boolean;
  scheduleTime: string; // e.g. "08:00"
  preferredChannel: "sms" | "whatsapp" | "both";
  template: string;
  fajrTalimOnly: boolean;
  // Granular Alert Controls
  absenceThresholdDays: number; // e.g. 1, 2, 3, or more days/instances
  triggerType: "daily" | "consecutive" | "total_in_month"; // daily, consecutive days, total in month
  autoSendWhatsApp: boolean;
  whatsappNotificationMode: "all" | "threshold_only"; // all absent vs only threshold met
  consecutiveTemplate?: string; // special alert when consecutive threshold reached
  excludeExcusedLeaves: boolean;
}

export interface FeeAlertStudentInfo {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  roll_number: string;
  class_name: string;
  class_id?: string;
  parent_phone: string;
  father_name: string;
  total_due: number;
  unpaid_invoices_count: number;
  period_name: string;
  payment_url: string;
  custom_message: string;
  whatsapp_url: string;
}

export const DEFAULT_ABSENCE_SETTINGS: AbsenceAlertSettings = {
  isAutoEnabled: true,
  scheduleTime: "08:00",
  preferredChannel: "both",
  fajrTalimOnly: false,
  template:
    "আসসালামু আলাইকুম। সম্মানিত অভিভাবক, আপনার সন্তান [ছাত্রের নাম] (রোল: [রোল], জামাত: [জামাত]) আজকের সকালের তালিম/ক্লাসে উপস্থিত হয়নি। বিষয়টি জরুরিভাবে অবগত হোন। - [মাদরাসা]",
  absenceThresholdDays: 1,
  triggerType: "daily",
  autoSendWhatsApp: true,
  whatsappNotificationMode: "all",
  consecutiveTemplate:
    "আসসালামু আলাইকুম। সম্মানিত অভিভাবক, আপনার সন্তান [ছাত্রের নাম] (রোল: [রোল], জামাত: [জামাত]) টানা [অনুপস্থিতির দিন] দিন যাবৎ মাদরাসায় অনুপস্থিত রয়েছে। জরুরি ভিত্তিতে মাদরাসা অফিসে যোগাযোগ করার জন্য বিশেষভাবে অনুরোধ করা হচ্ছে। - [মাদরাসা]",
  excludeExcusedLeaves: true,
};

export const DEFAULT_FEE_ALERT_TEMPLATE =
  "আসসালামু আলাইকুম। সম্মানিত অভিভাবক, আপনার সন্তান [ছাত্রের নাম] (রোল: [রোল])-এর চলতি মাসের মাদরাসা ফি বাবদ বকেয়া [বকেয়া টাকা] ৳। অনুগ্রহ করে দ্রুত পরিশোধ করুন। অনলাইন পেমেন্ট লিংক: [পেমেন্ট লিংক] - [মাদরাসা]";
