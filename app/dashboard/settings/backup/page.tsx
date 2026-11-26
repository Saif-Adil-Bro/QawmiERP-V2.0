import { Metadata } from "next";
import { getBackupOverviewStats } from "@/app/actions/backup";
import BackupClient from "./BackupClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ডাটা ব্যাকআপ ও রিস্টোর | QawmiManager",
  description: "মাদরাসার সম্পূর্ণ ডাটাবেজ ব্যাকআপ ও রিস্টোর ব্যবস্থাপনা",
};

export default async function BackupPage() {
  const statsRes = await getBackupOverviewStats();

  if (!statsRes.success || !statsRes.data)
    return <p role="alert">{statsRes.error || "ব্যাকআপের হিসাব পড়া যায়নি।"}</p>;
  return <BackupClient initialStats={statsRes.data} />;
}
