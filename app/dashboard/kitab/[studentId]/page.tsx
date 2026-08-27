import { createClient } from "@/lib/supabase/server";
import { getKitabLogs } from "@/app/actions/kitab";
import StudentKitabLogsClient from "@/components/kitab/StudentKitabLogsClient";

export default async function StudentKitabLogsPage({ params }: { params: Promise<{ studentId: string }> }) {
  const resolvedParams = await params;
  const studentId = resolvedParams.studentId;
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("*, classes(*)")
    .eq("id", studentId)
    .single();

  if (!student) {
    return <div className="p-8 text-center text-red-500 font-bold">শিক্ষার্থী পাওয়া যায়নি।</div>;
  }

  const logs = await getKitabLogs(studentId, 50);

  return (
    <StudentKitabLogsClient
      student={student}
      logs={logs}
    />
  );
}

