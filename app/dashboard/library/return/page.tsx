import Link from "next/link";
import { ChevronRight, BookDown } from "lucide-react";
import ReturnClient from "./ReturnClient";
import { getBookIssues } from "@/app/actions/library";

export const revalidate = 0;

export default async function LibraryReturnPage() {
  const issues = await getBookIssues();

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
            <span className="text-slate-800">কিতাব ফেরত (Return)</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center">
            <BookDown className="w-6 h-6 mr-2 text-emerald-600" />
            কিতাব ফেরত (Book Return)
          </h1>
          <p className="text-slate-500 text-sm">ইস্যু করা কিতাবসমূহ ফেরত নেওয়া এবং ট্র্যাকিং</p>
        </div>
      </div>

      {/* Interactive Return Component */}
      <ReturnClient initialIssues={issues} />
    </div>
  );
}
