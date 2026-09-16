import { Metadata } from "next";
import { getBackupOverviewStats, BackupOverviewStats } from "@/app/actions/backup";
import BackupClient from "./BackupClient";

export const metadata: Metadata = {
  title: "ডাটা ব্যাকআপ ও রিস্টোর | QawmiManager",
  description: "মাদরাসার সম্পূর্ণ ডাটাবেজ ব্যাকআপ ও রিস্টোর ব্যবস্থাপনা",
};

export default async function BackupPage() {
  const statsRes = await getBackupOverviewStats();

  const fallbackStats: BackupOverviewStats = {
    madrasa_name: "কওমি মাদরাসা",
    madrasa_id: "",
    total_records: 0,
    counts: {
      students: 0,
      admissions: 0,
      classes: 0,
      subjects: 0,
      routines: 0,
      hifz_kitab: 0,
      attendance_records: 0,
      leaves: 0,
      exams: 0,
      exam_results: 0,
      question_bank: 0,
      fees: 0,
      finance_transactions: 0,
      expenses: 0,
      zakat_donations: 0,
      donors_funds: 0,
      fundraising_special: 0,
      payment_gateway: 0,
      id_cards: 0,
      certificates: 0,
      alumni: 0,
      parent_feedbacks: 0,
      boarding_meals: 0,
      library_books: 0,
      inventory_items: 0,
      teachers_staff: 0,
      notices_sms: 0,
      sessions_settings: 0,
      audit_logs: 0,
      fees_and_transactions: 0,
      fundraising_records: 0,
      id_and_certificates: 0,
      leaves_and_alumni: 0,
      dynamic_extensions: 0,
    },
    last_backup: null,
    history: [],
  };

  return <BackupClient initialStats={statsRes.data || fallbackStats} />;
}
