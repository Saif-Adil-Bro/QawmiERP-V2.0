import { getSubjects } from "@/app/actions/subjects";
import Link from "next/link";
import { Plus } from "lucide-react";
import SubjectActions from "./SubjectActions";

export default async function SubjectsPage() {
  const subjects = await getSubjects();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Subjects (কিতাব/বিষয়)</h1>
        <Link
          href="/dashboard/subjects/new"
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Subject
        </Link>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="p-4 font-medium text-slate-600 text-sm">Name</th>
                <th className="p-4 font-medium text-slate-600 text-sm">Code</th>
                <th className="p-4 font-medium text-slate-600 text-sm">Description</th>
                <th className="p-4 font-medium text-slate-600 text-sm text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {subjects?.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">
                    No subjects found. Add your first subject.
                  </td>
                </tr>
              ) : (
                subjects?.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-slate-800 font-medium">{sub.name}</td>
                    <td className="p-4 text-slate-600 font-mono text-sm">{sub.code || "-"}</td>
                    <td className="p-4 text-slate-600">{sub.description || "-"}</td>
                    <td className="p-4 text-right">
                      <SubjectActions subjectId={sub.id} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
