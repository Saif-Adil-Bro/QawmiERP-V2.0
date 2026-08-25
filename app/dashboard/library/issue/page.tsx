import Link from "next/link";
import { ChevronRight, BookUp } from "lucide-react";
import IssueClient from "./IssueClient";
import { getBooks, getBookIssues } from "@/app/actions/library";
import { getStudents } from "@/app/actions/students";

export const revalidate = 0;

export default async function LibraryIssuePage() {
  const [books, students, issues] = await Promise.all([
    getBooks(),
    getStudents(),
    getBookIssues()
  ]);

  return (
    <div className="space-y-6">
      {/* Breadcrumbs & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-sm text-slate-500 mb-1">
            <Link href="/dashboard" className="hover:text-slate-800 transition">ড্যাশবোর্ড</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/dashboard/library" className="hover:text-slate-800 transition">কুতুবখানা</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-800">কিতাব ইস্যু (Issue)</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center">
            <BookUp className="w-6 h-6 mr-2 text-amber-600" />
            কিতাব ইস্যু (Book Issue)
          </h1>
          <p className="text-slate-500 text-sm">শিক্ষক বা শিক্ষার্থীদের কাছে কিতাব ইস্যু করার তথ্য ও রেকর্ড</p>
        </div>
      </div>

      {/* Interactive Issue Component */}
      <IssueClient books={books} students={students} initialIssues={issues} />
    </div>
  );
}
