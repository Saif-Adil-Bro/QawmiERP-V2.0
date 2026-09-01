import Link from "next/link";
import { MessageSquare, Bell, Send, Layers, Server } from "lucide-react";

export default function CommunicationDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">যোগাযোগ ও নোটিশ (Communication)</h1>
        <p className="text-slate-500">ছাত্র, অভিভাবক এবং শিক্ষকদের সাথে যোগাযোগ ও এসএমএস ম্যানেজমেন্ট</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <Link href="/dashboard/communication/sms" className="block">
          <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:border-blue-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-blue-50 p-3 rounded-lg group-hover:bg-blue-100 transition">
                <Send className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">এসএমএস পাঠানো</h2>
            </div>
            <p className="text-sm text-slate-600">হাজিরা, পরীক্ষার ফলাফল বা ফি বকেয়ার মেসেজ পাঠান।</p>
          </div>
        </Link>

        <Link href="/dashboard/communication/sms" className="block">
          <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:border-indigo-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-indigo-50 p-3 rounded-lg group-hover:bg-indigo-100 transition">
                <Layers className="w-6 h-6 text-indigo-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">টেমপ্লেট বিল্ডার</h2>
            </div>
            <p className="text-sm text-slate-600">ডাইনামিক ভ্যারিয়েবল সহ কাস্টম এসএমএস টেমপ্লেট তৈরি ও পরিচালনা করুন।</p>
          </div>
        </Link>

        <Link href="/dashboard/communication/sms" className="block">
          <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:border-emerald-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-emerald-50 p-3 rounded-lg group-hover:bg-emerald-100 transition">
                <Server className="w-6 h-6 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">এসএমএস API গেটওয়ে</h2>
            </div>
            <p className="text-sm text-slate-600">Mram SMS, Greenweb, BulkSMS BD বা কাস্টম গেটওয়ে ইন্টিগ্রেশন।</p>
          </div>
        </Link>

        <Link href="/dashboard/communication/notices" className="block">
          <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:border-amber-300 transition group cursor-pointer h-full">
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

