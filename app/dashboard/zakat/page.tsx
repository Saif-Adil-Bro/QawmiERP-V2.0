import Link from "next/link";
import { HeartHandshake, FileText, Users } from "lucide-react";

export default function ZakatDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">যাকাত ও অনুদান (Zakat & Donation)</h1>
        <p className="text-slate-500">যাকাত ফান্ড এবং দাতাদের তথ্য পরিচালনা করুন</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/dashboard/zakat/donors" className="block">
          <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:border-slate-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-blue-50 p-3 rounded-lg group-hover:bg-blue-100 transition">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">দাতাদের তালিকা</h2>
            </div>
            <p className="text-sm text-slate-600">যাকাত এবং অনুদান দাতাদের প্রোফাইল ও যোগাযোগের তথ্য।</p>
          </div>
        </Link>

        <Link href="/dashboard/zakat/collection" className="block">
          <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:border-slate-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-emerald-50 p-3 rounded-lg group-hover:bg-emerald-100 transition">
                <HeartHandshake className="w-6 h-6 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">যাকাত সংগ্রহ</h2>
            </div>
            <p className="text-sm text-slate-600">নতুন যাকাত ও অনুদান গ্রহণ এবং রসিদ প্রদান করুন।</p>
          </div>
        </Link>

        <Link href="/dashboard/zakat/reports" className="block">
          <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:border-slate-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-amber-50 p-3 rounded-lg group-hover:bg-amber-100 transition">
                <FileText className="w-6 h-6 text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">যাকাত রিপোর্ট</h2>
            </div>
            <p className="text-sm text-slate-600">যাকাত ফান্ডের আয়-ব্যয় এবং বাৎসরিক কালেকশন রিপোর্ট।</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
