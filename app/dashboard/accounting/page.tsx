import Link from "next/link";
import { Wallet, Receipt, FileBarChart, CreditCard } from "lucide-react";

export default function AccountingDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">হিসাবরক্ষণ (Accounting)</h1>
        <p className="text-slate-500">মাদরাসার ফি আদায়, খরচ এবং আয়-ব্যয়ের রিপোর্ট</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/dashboard/accounting/fees" className="block">
          <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:border-slate-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-emerald-50 p-3 rounded-lg group-hover:bg-emerald-100 transition">
                <CreditCard className="w-6 h-6 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">ফি আদায় (Income)</h2>
            </div>
            <p className="text-sm text-slate-600">শিক্ষার্থীদের মাসিক বেতন, ভর্তি ফি এবং অন্যান্য ফি আদায় করুন।</p>
          </div>
        </Link>

        <Link href="/dashboard/accounting/expenses" className="block">
          <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:border-slate-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-red-50 p-3 rounded-lg group-hover:bg-red-100 transition">
                <Receipt className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">খরচ (Expense)</h2>
            </div>
            <p className="text-sm text-slate-600">মাদরাসার দৈনন্দিন খরচ, বেতন এবং অন্যান্য ব্যয়ের এন্ট্রি করুন।</p>
          </div>
        </Link>

        <Link href="/dashboard/accounting/reports" className="block">
          <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:border-slate-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-blue-50 p-3 rounded-lg group-hover:bg-blue-100 transition">
                <FileBarChart className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">আয়-ব্যয়ের রিপোর্ট</h2>
            </div>
            <p className="text-sm text-slate-600">মাসিক ও বাৎসরিক আয়-ব্যয়ের রিপোর্ট দেখুন এবং প্রিন্ট করুন।</p>
          </div>
        </Link>
      
        <Link href="/dashboard/accounting/receipts" className="block">
          <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:border-slate-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-amber-50 p-3 rounded-lg group-hover:bg-amber-100 transition">
                <Receipt className="w-6 h-6 text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">সকল মানি রিসিট</h2>
            </div>
            <p className="text-sm text-slate-600">সকল প্রদানকৃত ফি ও অনুদানের রিসিট ট্র্যাক করুন এবং পুনরায় প্রিন্ট করুন।</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
