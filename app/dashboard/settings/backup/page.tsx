import { Metadata } from "next";
import { getBackupOverviewStats } from "@/app/actions/backup";
import BackupClient from "./BackupClient";

export const metadata: Metadata = {
  title: "ডাটা ব্যাকআপ ও রিস্টোর | QawmiManager",
  description: "মাদরাসার সম্পূর্ণ ডাটাবেজ ব্যাকআপ ও রিস্টোর ব্যবস্থাপনা",
};

export default async function BackupPage() {
  const statsRes = await getBackupOverviewStats();

  const fallbackStats = {
    madrasa_name: "কওমি মাদরাসা",
    madrasa_id: "",
    total_records: 0,
    counts: {
      students: 0,
      classes: 0,
      subjects: 0,
      teachers: 0,
      exams: 0,
      exam_results: 0,
      attendance_records: 0,
      fees_and_transactions: 0,
      hifz_logs: 0,
      meals: 0,
      books: 0,
      notices: 0,
    },
    last_backup: null,
    history: [],
  };

  return <BackupClient initialStats={statsRes.data || fallbackStats} />;
}
