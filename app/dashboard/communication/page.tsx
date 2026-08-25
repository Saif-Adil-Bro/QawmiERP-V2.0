import Link from "next/link";
import { MessageSquare, Bell, Send } from "lucide-react";

export default function CommunicationDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">যোগাযোগ ও নোটিশ (Communication)</h1>
        <p className="text-slate-500">ছাত্র, অভিভাবক এবং শিক্ষকদের সাথে যোগাযোগ ও এসএমএস ম্যানেজমেন্ট</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/dashboard/communication/sms" className="block">
          <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:border-slate-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-blue-50 p-3 rounded-lg group-hover:bg-blue-100 transition">
                <Send className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">এসএমএস (SMS) পাঠানো</h2>
            </div>
            <p className="text-sm text-slate-600">হাজিরা, পরীক্ষার ফলাফল বা ফি বকেয়ার মেসেজ পাঠান।</p>
          </div>
        </Link>

        <Link href="/dashboard/communication/notices" className="block">
          <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:border-slate-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-amber-50 p-3 rounded-lg group-hover:bg-amber-100 transition">
                <Bell className="w-6 h-6 text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">নোটিশ বোর্ড</h2>
            </div>
            <p className="text-sm text-slate-600">ডিজিটাল নোটিশ বোর্ড ম্যানেজমেন্ট। নতুন নোটিশ যুক্ত করুন।</p>
          </div>
        </Link>

        <Link href="/dashboard/communication/logs" className="block">
          <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:border-slate-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-slate-50 p-3 rounded-lg group-hover:bg-slate-100 transition">
                <MessageSquare className="w-6 h-6 text-slate-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">এসএমএস লগস (Logs)</h2>
            </div>
            <p className="text-sm text-slate-600">আগে পাঠানো সকল এসএমএস এবং নোটিশের তালিকা দেখুন।</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
