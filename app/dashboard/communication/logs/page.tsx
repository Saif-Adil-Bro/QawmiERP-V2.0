import { createClient } from "@/lib/supabase/server";
import { MessageSquare, CheckCircle, XCircle } from "lucide-react";

export default async function SMSLogsPage() {
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("sms_logs")
    .select("*")
    .order("sent_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">এসএমএস লগস (SMS Logs)</h1>
          <p className="text-slate-500">আগে পাঠানো সকল এসএমএস এর তালিকা এবং স্ট্যাটাস</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-4 font-semibold text-slate-700">তারিখ ও সময়</th>
                <th className="p-4 font-semibold text-slate-700">প্রাপক</th>
                <th className="p-4 font-semibold text-slate-700">মেসেজ</th>
                <th className="p-4 font-semibold text-slate-700">ধরন</th>
                <th className="p-4 font-semibold text-slate-700 text-right">স্ট্যাটাস</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs?.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="p-4 text-sm text-slate-600">
                    {new Date(log.sent_at).toLocaleString('bn-BD')}
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-slate-800">{log.recipient_name || "অজ্ঞাত"}</div>
                    <div className="text-xs text-slate-500">{log.recipient_phone}</div>
                  </td>
                  <td className="p-4 text-sm text-slate-600 max-w-xs truncate" title={log.message}>
                    {log.message}
                  </td>
                  <td className="p-4 text-sm">
                    <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                      {log.message_type}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {log.status === 'Sent' ? (
                      <span className="inline-flex items-center text-emerald-600 text-sm font-medium">
                        <CheckCircle className="w-4 h-4 mr-1" /> পাঠানো হয়েছে
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-red-600 text-sm font-medium">
                        <XCircle className="w-4 h-4 mr-1" /> ব্যর্থ
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {(!logs || logs.length === 0) && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    কোনো এসএমএস লগ পাওয়া যায়নি
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
