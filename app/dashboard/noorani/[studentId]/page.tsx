import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getStudentNooraniProgress } from "@/app/actions/noorani";
import NooraniMakhrajTracker from "@/components/hifz/NooraniMakhrajTracker";

export const dynamic = "force-dynamic";

export default async function StudentNooraniPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return null;

  let student: any = null;
  try {
    const admin = await createAdminClient();
    const { data } = await admin
      .from("students")
      .select("id, first_name, last_name, roll_number")
      .eq("id", studentId)
      .maybeSingle();
    student = data;
  } catch {
    const { data } = await supabase
      .from("students")
      .select("id, first_name, last_name, roll_number")
      .eq("id", studentId)
      .maybeSingle();
    student = data;
  }

  if (!student) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
        শিক্ষার্থী পাওয়া যায়নি।
      </div>
    );
  }

  const nooraniProgress = await getStudentNooraniProgress(studentId);

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link
          href="/dashboard/noorani"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {student.first_name} {student.last_name} — নূরানী ও তাজবীদ ট্র্যাকার
          </h1>
          <p className="text-slate-500 text-sm">
            রোল নম্বর: {student.roll_number || "N/A"}
          </p>
        </div>
      </div>

      <NooraniMakhrajTracker
        studentId={student.id}
        studentName={`${student.first_name} ${student.last_name}`}
        initialProgress={nooraniProgress}
      />
    </div>
  );
}
