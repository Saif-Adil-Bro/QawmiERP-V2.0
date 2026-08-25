import Link from "next/link";
import { Utensils, CalendarDays, Receipt } from "lucide-react";

export default function BoardingDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">বোর্ডিং ও মিল (Boarding & Meals)</h1>
        <p className="text-slate-500">বোর্ডিংয়ের ছাত্রদের মিল, হিসাব ও ব্যবস্থাপনা</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/dashboard/boarding/meals" className="block">
          <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:border-slate-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-orange-50 p-3 rounded-lg group-hover:bg-orange-100 transition">
                <Utensils className="w-6 h-6 text-orange-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">দৈনিক মিল এন্ট্রি</h2>
            </div>
            <p className="text-sm text-slate-600">ছাত্রদের দৈনিক খাবার বা মিলের হিসাব রাখুন (চালু/বন্ধ)।</p>
          </div>
        </Link>

        <Link href="/dashboard/boarding/bazar" className="block">
          <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:border-slate-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-emerald-50 p-3 rounded-lg group-hover:bg-emerald-100 transition">
                <Receipt className="w-6 h-6 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">বাজার খরচ (Bazar)</h2>
            </div>
            <p className="text-sm text-slate-600">বোর্ডিংয়ের জন্য প্রতিদিনের বাজার খরচের হিসাব।</p>
          </div>
        </Link>

        <Link href="/dashboard/boarding/reports" className="block">
          <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:border-slate-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-blue-50 p-3 rounded-lg group-hover:bg-blue-100 transition">
                <CalendarDays className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">মাসিক মিল বিল</h2>
            </div>
            <p className="text-sm text-slate-600">মাস শেষে মোট মিল এবং খরচের ভিত্তিতে ছাত্রদের বিল প্রস্তুত।</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
