import { getFees } from "@/app/actions/accounting";
import Link from "next/link";
import { ArrowLeft, Printer, FileText } from "lucide-react";
import { format } from "date-fns";

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const resolvedParams = await searchParams;
  const fees = await getFees({ month: resolvedParams.month, year: resolvedParams.year });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/accounting"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">মানি রিসিট সমূহ</h1>
            <p className="text-slate-500 text-sm">সকল ফি ও জমার রিসিট ট্র্যাকিং</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {fees.length === 0 ? (
          <div className="p-8 text-center text-slate-500">কোনো রিসিট রেকর্ড পাওয়া যায়নি।</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium">রিসিট নং</th>
                  <th className="px-6 py-4 font-medium">তারিখ</th>
                  <th className="px-6 py-4 font-medium">শিক্ষার্থীর নাম</th>
                  <th className="px-6 py-4 font-medium">খাত (ধরণ)</th>
                  <th className="px-6 py-4 font-medium text-right">পরিমাণ (৳)</th>
                  <th className="px-6 py-4 font-medium text-right">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {fees.map((fee) => (
                  <tr key={fee.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 font-mono text-slate-700 font-medium">{fee.receipt_no}</td>
                    <td className="px-6 py-4">{format(new Date(fee.payment_date), "dd MMM, yyyy")}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {fee.students?.first_name} {fee.students?.last_name}
                      <span className="block text-xs text-slate-500 font-normal mt-0.5">
                        {fee.students?.class_name || ''} {fee.students?.roll_number ? `| রোল: ${fee.students.roll_number}` : ''}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                        {fee.fee_type === 'Admission' ? 'ভর্তি ফি' : 
                         fee.fee_type === 'Monthly' ? 'মাসিক বেতন' : 
                         fee.fee_type === 'Exam' ? 'পরীক্ষার ফি' : 'অন্যান্য'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900 text-right">
                      {Number(fee.amount).toLocaleString('bn-BD')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          href={`/dashboard/accounting/fees/${fee.id}/receipt`}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 rounded-md transition font-medium"
                          title="রিসিট দেখুন বা প্রিন্ট করুন"
                        >
                          <FileText className="w-4 h-4" />
                          <span>রিসিট</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
