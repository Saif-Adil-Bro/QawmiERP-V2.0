import { getSubjectById } from "@/app/actions/subjects";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import EditSubjectForm from "./EditSubjectForm";

interface EditSubjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSubjectPage({ params }: EditSubjectPageProps) {
  const { id } = await params;
  const subject = await getSubjectById(id);

  if (!subject) {
    notFound();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/subjects"
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">বিষয় / কিতাব সম্পাদনা</h1>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <EditSubjectForm subject={subject} />
      </div>
    </div>
  );
}
