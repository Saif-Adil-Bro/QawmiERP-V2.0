import { getKitabStudents, getAllRecentKitabLogs } from "@/app/actions/kitab";
import { getClasses } from "@/app/actions/students";
import KitabDashboardClient from "@/components/kitab/KitabDashboardClient";

export default async function KitabPage() {
  const [students, logs, classes] = await Promise.all([
    getKitabStudents(),
    getAllRecentKitabLogs(100),
    getClasses(),
  ]);

  return (
    <KitabDashboardClient
      students={students}
      logs={logs}
      classes={classes}
    />
  );
}

