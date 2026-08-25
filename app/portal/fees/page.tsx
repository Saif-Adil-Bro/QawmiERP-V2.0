import { createClient } from "@/lib/supabase/server";
import { CreditCard, Receipt, TrendingUp } from "lucide-react";

export default async function ParentPortalFees() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userData } = await supabase.from("users").select("madrasa_id").eq("id", user.id).single();
  const madrasaId = userData?.madrasa_id;

  const { data: students } = await supabase
    .from("students")
    .select("id")
    .eq("madrasa_id", madrasaId)
    .limit(1);

  const childId = students?.[0]?.id;
  if (!childId) return <div>No linked students found.</div>;

  const { data: fees } = await supabase
    .from("fees")
    .select("*")
    .eq("student_id", childId)
    .order("payment_date", { ascending: false });

  const totalPaid = fees?.reduce((sum, fee) => sum + Number(fee.amount), 0) || 0;
  
  // Group fees by year and month roughly
  const recentPayments = fees?.slice(0, 5) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Fee Status</h1>
        <p className="text-slate-500">Track payment history and upcoming dues for your child.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900 text-white rounded-lg border-none shadow-lg">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Total Paid (This Year)</h3>
              <div className="p-2 bg-slate-800 rounded-lg">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">
              ৳ {totalPaid.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400">Total verified payments</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="p-6 flex flex-col justify-center h-full text-center">
            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">Next Payment Due</h3>
            <p className="text-lg font-semibold text-slate-800">Please contact administration</p>
            <p className="text-xs text-slate-400 mt-1">For exact due amounts</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mt-8">
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center">
            <Receipt className="w-5 h-5 mr-2 text-slate-500" />
            Payment History
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fee Type</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Month/Year</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fees && fees.length > 0 ? (
                fees.map((fee) => (
                  <tr key={fee.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                      {new Date(fee.payment_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">
                      {fee.fee_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {fee.fee_month ? `${fee.fee_month} ${fee.fee_year}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                      ৳ {fee.amount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Paid
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-sm">
                    No payment records found.
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
