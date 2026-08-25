import Link from "next/link";
import { Library, BookUp, BookDown, AlertCircle, Bookmark, ChevronRight } from "lucide-react";
import { getBooks, getBookIssues } from "@/app/actions/library";
import { convertToBanglaNumber } from "@/lib/student-utils";

export const revalidate = 0;

export default async function LibraryDashboardPage() {
  const [books, issues] = await Promise.all([
    getBooks(),
    getBookIssues()
  ]);

  const todayStr = new Date().toISOString().split("T")[0];

  // Calculate stats
  const totalUniqueBooks = books.length;
  const totalCopiesCount = books.reduce((sum, book) => sum + (book.total_copies || 0), 0);
  const currentlyIssuedCount = issues.filter(i => i.status === 'Issued').length;
  const overdueCount = issues.filter(i => i.status === 'Issued' && i.due_date && i.due_date < todayStr).length;

  return (
    <div className="space-y-8">
      {/* Breadcrumb & Header */}
      <div>
        <div className="flex items-center space-x-2 text-sm text-slate-500 mb-1">
          <Link href="/dashboard" className="hover:text-slate-800 transition">ড্যাশবোর্ড</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-800">কুতুবখানা</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-800">কুতুবখানা (Library)</h1>
        <p className="text-slate-500">কিতাবসমূহের লাইভ ইনভেন্টরি, কিতাব ইস্যু এবং রিটার্ন ট্র্যাকিং</p>
      </div>

      {/* Live Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="bg-indigo-50 p-3 rounded-lg">
            <Library className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">মোট কিতাব (আইটেম)</p>
            <p className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">
              {convertToBanglaNumber(totalUniqueBooks)}টি
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="bg-blue-50 p-3 rounded-lg">
            <Bookmark className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">মোট কপি (স্টক)</p>
            <p className="text-xl font-extrabold text-slate-900 font-mono mt-0.5">
              {convertToBanglaNumber(totalCopiesCount)}টি
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="bg-amber-50 p-3 rounded-lg">
            <BookUp className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ইস্যু করা রয়েছে</p>
            <p className="text-xl font-extrabold text-amber-700 font-mono mt-0.5">
              {convertToBanglaNumber(currentlyIssuedCount)}টি
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className={`p-3 rounded-lg ${overdueCount > 0 ? "bg-rose-50" : "bg-slate-50"}`}>
            <AlertCircle className={`w-5 h-5 ${overdueCount > 0 ? "text-rose-600" : "text-slate-400"}`} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ফেরত ওভারডিউ</p>
            <p className={`text-xl font-extrabold font-mono mt-0.5 ${overdueCount > 0 ? "text-rose-600" : "text-slate-500"}`}>
              {convertToBanglaNumber(overdueCount)}টি
            </p>
          </div>
        </div>
      </div>

      {/* Main Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/dashboard/library/books" className="block">
          <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:border-slate-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-indigo-50 p-3 rounded-lg group-hover:bg-indigo-100 transition">
                <Library className="w-6 h-6 text-indigo-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">কিতাবের তালিকা</h2>
            </div>
            <p className="text-sm text-slate-600">কুতুবখানার সকল কিতাবের নাম, লেখক, এবং রিয়েল-টাইম স্টক আপডেট ও সংশোধন।</p>
            <div className="mt-4 flex items-center text-xs font-bold text-indigo-600 group-hover:underline">
              তালিকা দেখুন <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </div>
          </div>
        </Link>

        <Link href="/dashboard/library/issue" className="block">
          <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:border-slate-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-amber-50 p-3 rounded-lg group-hover:bg-amber-100 transition">
                <BookUp className="w-6 h-6 text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">কিতাব ইস্যু (Issue)</h2>
            </div>
            <p className="text-sm text-slate-600">শিক্ষার্থী বা শিক্ষকদের নতুন কিতাব ইস্যু এন্ট্রি এবং ইস্যু ট্র্যাকিং রেকর্ড।</p>
            <div className="mt-4 flex items-center text-xs font-bold text-amber-600 group-hover:underline">
              কিতাব ইস্যু করুন <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </div>
          </div>
        </Link>

        <Link href="/dashboard/library/return" className="block">
          <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:border-slate-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-emerald-50 p-3 rounded-lg group-hover:bg-emerald-100 transition">
                <BookDown className="w-6 h-6 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">কিতাব ফেরত (Return)</h2>
            </div>
            <p className="text-sm text-slate-600">ইস্যু করা কিতাবসমূহ ফেরত নেওয়ার রিসিভ পোর্টাল ও ট্র্যাকিং হিস্ট্রি।</p>
            <div className="mt-4 flex items-center text-xs font-bold text-emerald-600 group-hover:underline">
              ফেরত গ্রহণ করুন <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
