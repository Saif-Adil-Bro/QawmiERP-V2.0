import Link from "next/link";
import { ChevronRight, Library } from "lucide-react";
import BookListClient from "./BookListClient";
import { getBooks } from "@/app/actions/library";

export const revalidate = 0;

export default async function BooksPage() {
  const books = await getBooks();

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-sm text-slate-500 mb-1">
            <Link href="/dashboard" className="hover:text-slate-800 transition">ড্যাশবোর্ড</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/dashboard/library" className="hover:text-slate-800 transition">কুতুবখানা</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-800">কিতাবের তালিকা</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center">
            <Library className="w-6 h-6 mr-2 text-indigo-600" />
            কিতাবের তালিকা
          </h1>
          <p className="text-slate-500 text-sm">মাদ্রাসার কুতুবখানার সকল কিতাবের এন্ট্রি ও স্টক তথ্য</p>
        </div>
      </div>

      {/* Interactive Client Component */}
      <BookListClient initialBooks={books} />
    </div>
  );
}
