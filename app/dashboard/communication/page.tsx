import Link from "next/link";
import { MessageSquare, Bell, Send, Layers, Server, MessageSquarePlus, Clock, CreditCard, MessageCircle } from "lucide-react";

export default function CommunicationDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">যোগাযোগ ও নোটিশ (Communication & Transparency)</h1>
        <p className="text-slate-500">ছাত্র, অভিভাবক এবং শিক্ষকদের সাথে যোগাযোগ, স্বয়ংক্রিয় হোয়াটসঅ্যাপ ও এসএমএস ম্যানেজমেন্ট</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* NEW FEATURE: Automated WhatsApp & Instant Absence Alerts */}
        <Link href="/dashboard/communication/absence-alerts" className="block">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50/30 p-6 rounded-2xl border-2 border-emerald-300 shadow-sm hover:shadow-md hover:border-emerald-500 transition group cursor-pointer h-full relative overflow-hidden">
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
              সকাল ৮টা অ্যালার্ট
            </div>
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-emerald-600 p-3 rounded-xl text-white shadow-md shadow-emerald-700/20 group-hover:scale-105 transition">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">অনুপস্থিতি ও WhatsApp অ্যালার্ট</h2>
                <span className="text-[11px] text-emerald-700 font-semibold">ফজর/সকালের তালিম</span>
              </div>
            </div>
            <p className="text-sm text-slate-600">কোনো ছাত্র অনুপস্থিত থাকলে সকাল ৮টায় সরাসরি ১-ক্লিক হোয়াটসঅ্যাপ ও এসএমএস নোটিফিকেশন।</p>
          </div>
        </Link>

        {/* NEW FEATURE: Fee Dues & Payment Link Alerts */}
        <Link href="/dashboard/communication/fee-alerts" className="block">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50/30 p-6 rounded-2xl border-2 border-blue-300 shadow-sm hover:shadow-md hover:border-blue-500 transition group cursor-pointer h-full relative overflow-hidden">
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
              পেমেন্ট লিংক
            </div>
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-blue-600 p-3 rounded-xl text-white shadow-md shadow-blue-700/20 group-hover:scale-105 transition">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">মাসিক ফি ও পেমেন্ট অ্যালার্ট</h2>
                <span className="text-[11px] text-blue-700 font-semibold">বিকাশ/নগদ লিংক সহ</span>
              </div>
            </div>
            <p className="text-sm text-slate-600">মাসিক ফি তৈরি হলে বকেয়া বিবরণী ও সরাসরি অনলাইন পেমেন্ট লিংকসহ অভিভাবকদের বার্তা প্রেরণ।</p>
          </div>
        </Link>

        {/* NEW FEATURE: Parent Complaints, Suggestions & Appointments */}
        <Link href="/dashboard/communication/feedback" className="block">
          <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50/30 p-6 rounded-2xl border-2 border-purple-300 shadow-sm hover:shadow-md hover:border-purple-500 transition group cursor-pointer h-full relative overflow-hidden">
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-bold">
              অভিযোগ ও পরামর্শ
            </div>
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-purple-600 p-3 rounded-xl text-white shadow-md shadow-purple-700/20 group-hover:scale-105 transition">
                <MessageSquarePlus className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">অভিযোগ ও শিক্ষক সাক্ষাতকার</h2>
                <span className="text-[11px] text-purple-700 font-semibold">মুহতামিম অ্যাপয়েন্টমেন্ট</span>
              </div>
            </div>
            <p className="text-sm text-slate-600">অভিভাবকদের পরামর্শ, অভিযোগ ও শিক্ষকের সাথে সাক্ষাতকার অনুরোধ পর্যালোচনা ও সমাধান প্রদান।</p>
          </div>
        </Link>

        <Link href="/dashboard/communication/sms" className="block">
          <div className="bg-white p-6 rounded-2xl border shadow-sm hover:shadow-md hover:border-blue-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-blue-50 p-3 rounded-xl group-hover:bg-blue-100 transition">
                <Send className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">বাল্ক এসএমএস পাঠানো</h2>
            </div>
            <p className="text-sm text-slate-600">হাজিরা, পরীক্ষার ফলাফল বা সাধারণ নোটিশ এক ক্লিকে অভিভাবকদের পাঠান।</p>
          </div>
        </Link>

        <Link href="/dashboard/communication/sms" className="block">
          <div className="bg-white p-6 rounded-2xl border shadow-sm hover:shadow-md hover:border-indigo-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-indigo-50 p-3 rounded-xl group-hover:bg-indigo-100 transition">
                <Layers className="w-6 h-6 text-indigo-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">টেমপ্লেট বিল্ডার</h2>
            </div>
            <p className="text-sm text-slate-600">ডাইনামিক ভ্যারিয়েবল সহ কাস্টম এসএমএস টেমপ্লেট তৈরি ও পরিচালনা করুন।</p>
          </div>
        </Link>

        <Link href="/dashboard/communication/sms" className="block">
          <div className="bg-white p-6 rounded-2xl border shadow-sm hover:shadow-md hover:border-emerald-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-emerald-50 p-3 rounded-xl group-hover:bg-emerald-100 transition">
                <Server className="w-6 h-6 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">এসএমএস API গেটওয়ে</h2>
            </div>
            <p className="text-sm text-slate-600">Mram SMS, Greenweb, BulkSMS BD বা কাস্টম গেটওয়ে ইন্টিগ্রেশন।</p>
          </div>
        </Link>

        <Link href="/dashboard/communication/notices" className="block">
          <div className="bg-white p-6 rounded-2xl border shadow-sm hover:shadow-md hover:border-amber-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-amber-50 p-3 rounded-xl group-hover:bg-amber-100 transition">
                <Bell className="w-6 h-6 text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">নোটিশ বোর্ড</h2>
            </div>
            <p className="text-sm text-slate-600">ডিজিটাল নোটিশ বোর্ড ম্যানেজমেন্ট। নতুন নোটিশ যুক্ত করুন।</p>
          </div>
        </Link>

        <Link href="/dashboard/communication/logs" className="block">
          <div className="bg-white p-6 rounded-2xl border shadow-sm hover:shadow-md hover:border-slate-300 transition group cursor-pointer h-full">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-slate-50 p-3 rounded-xl group-hover:bg-slate-100 transition">
                <MessageSquare className="w-6 h-6 text-slate-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">এসএমএস লগস (Logs)</h2>
            </div>
            <p className="text-sm text-slate-600">আগে পাঠানো সকল এসএমএস এবং নোটিশের ডেলিভারি রিপোর্ট দেখুন।</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

