import { createClient } from "@/lib/supabase/server";
import {
  CreditCard,
  Receipt,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Download,
  Printer,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { toBanglaNumber, formatBanglaCurrency } from "@/lib/numberToBangla";
import { getStudentFeeProfile, getFeeMetadata } from "@/app/actions/fee-management";

export const dynamic = "force-dynamic";

export default async function ParentPortalFees({
  searchParams,
}: {
  searchParams: Promise<{ student_id?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userData } = await supabase
    .from("users")
    .select("madrasa_id")
    .eq("id", user.id)
    .single();
  const madrasaId = userData?.madrasa_id;

  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, student_id, class_name, classes(name)")
    .eq("madrasa_id", madrasaId)
    .order("roll_number", { ascending: true });

  if (!students || students.length === 0) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
        কোন শিক্ষার্থী সংযুক্ত পাওয়া যায়নি।
      </div>
    );
  }

  const selectedStudentId = params.student_id || students[0].id;
  const child = students.find((s) => s.id === selectedStudentId) || students[0];

  // Get fees from SQL table
  const { data: sqlFees } = await supabase
    .from("fees")
    .select("*")
    .eq("student_id", child.id)
    .order("payment_date", { ascending: false });

  // Also get structured student fee profile from metadata
  const feeProfile = await getStudentFeeProfile(child.id);

  // Get payments from metadata
  let metadataPayments: any[] = [];
  if (madrasaId) {
    const meta = await getFeeMetadata(madrasaId);
    metadataPayments = (meta?.payments || []).filter((p) => p.student_id === child.id && p.status !== "REVERSED");
  }

  // Combine payments
  const combinedPayments = [...metadataPayments];
  if (sqlFees) {
    sqlFees.forEach((sf) => {
      if (!combinedPayments.some((p) => p.receipt_no === sf.receipt_number || p.id === sf.id)) {
        combinedPayments.push({
          id: sf.id,
          receipt_no: sf.receipt_number || `REC-${sf.id.slice(0, 6)}`,
          total_amount_received: Number(sf.amount_paid) || Number(sf.amount) || 0,
          payment_date: sf.payment_date,
          payment_method: sf.payment_method || "Cash",
          notes: sf.notes || sf.description,
          student_name: `${child.first_name} ${child.last_name}`,
          class_name: child.class_name,
        });
      }
    });
  }

  const totalPaid = combinedPayments.reduce((sum, p) => sum + (Number(p.total_amount_received) || 0), 0);
  const totalDue = feeProfile?.total_due || 0;
  const unpaidInvoices = feeProfile?.fees?.filter((f: any) => f.due_amount > 0) || [];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">ফি ও পেমেন্ট হিস্ট্রি</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            শিক্ষার্থী: <strong className="text-slate-800">{child.first_name} {child.last_name}</strong> (রোল: {toBanglaNumber(child.roll_number || child.student_id || "-")})
          </p>
        </div>

        {students.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {students.map((s) => (
              <Link
                key={s.id}
                href={`/portal/fees?student_id=${s.id}`}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  s.id === child.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {s.first_name} {s.last_name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Financial Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">মোট পরিশোধিত ফি</h3>
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold mb-1 font-mono">
            ৳ {formatBanglaCurrency(totalPaid)}
          </div>
          <p className="text-xs text-emerald-300 font-semibold flex items-center gap-1 mt-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>সকল রসিদ ডাটাবেজে সংরক্ষিত</span>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">বর্তমান বকেয়া (Current Due)</h3>
            <Clock className={`w-4 h-4 ${totalDue > 0 ? "text-red-500" : "text-emerald-600"}`} />
          </div>
          <div>
            <p className={`text-xl sm:text-2xl font-black font-mono ${totalDue > 0 ? "text-red-700" : "text-emerald-700"}`}>
              ৳ {formatBanglaCurrency(totalDue)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {totalDue > 0 ? `বকেয়া ইনভয়েস: ${toBanglaNumber(unpaidInvoices.length)} টি` : "কোন বকেয়া নেই (পরিশোধিত)"}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">সর্বশেষ রসিদ নম্বর</h3>
            <Receipt className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-lg sm:text-xl font-bold font-mono text-slate-800">
              {combinedPayments[0]?.receipt_no || "-"}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              তারিখ: {combinedPayments[0]?.payment_date || "হালনাগাদ"}
            </p>
          </div>
        </div>
      </div>

      {/* Payment History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">পরিশোধিত ফি ও রসিদ তালিকা</h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">রসিদ সংগ্রাহক: হিসাব বিভাগ</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3.5">রশিদ নম্বর</th>
                <th className="px-4 py-3.5">ফি-এর ধরন ও বিবরণ</th>
                <th className="px-4 py-3.5">পরিশোধের তারিখ</th>
                <th className="px-4 py-3.5">পরিশোধের মাধ্যম</th>
                <th className="px-4 py-3.5 text-right">টাকার পরিমাণ</th>
                <th className="px-4 py-3.5 text-center">স্ট্যাটাস</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {combinedPayments.length > 0 ? (
                combinedPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-800">
                      {p.receipt_no}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800 text-xs sm:text-sm">
                        {p.allocations && p.allocations.length > 0
                          ? p.allocations.map((a: any) => a.fee_type_name).join(", ")
                          : p.notes || "মাসিক বেতন ও ফি"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {p.payment_date || "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-medium">
                        {p.payment_method || "ক্যাশ (নগদ)"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-800 text-right text-sm">
                      ৳ {formatBanglaCurrency(p.total_amount_received)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>পরিশোধিত</span>
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 text-sm">
                    কোন পরিশোধিত ফির তথ্য পাওয়া যায়নি।
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
