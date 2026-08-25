import { getExpenses } from "@/app/actions/accounting";
import Link from "next/link";
import { Plus, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { ExpenseDeleteButton } from "@/components/accounting/fee-actions";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const resolvedParams = await searchParams;
  const expenses = await getExpenses({ month: resolvedParams.month, year: resolvedParams.year });

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
            <h1 className="text-2xl font-bold text-slate-800">খরচ (Expenses)</h1>
            <p className="text-slate-500 text-sm">মাদরাসার দৈনন্দিন খরচ ও ব্যয়</p>
          </div>
        </div>
        <Link
          href="/dashboard/accounting/expenses/new"
          className="bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800 transition flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>নতুন খরচ এন্ট্রি</span>
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {expenses.length === 0 ? (
          <div className="p-8 text-center text-slate-500">কোনো খরচের রেকর্ড পাওয়া যায়নি।</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium">তারিখ</th>
                  <th className="px-6 py-4 font-medium">খাত (Category)</th>
                  <th className="px-6 py-4 font-medium">বিবরণ</th>
                  <th className="px-6 py-4 font-medium text-right">পরিমাণ (৳)</th>
                  <th className="px-6 py-4 font-medium text-right">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">{format(new Date(expense.expense_date), "dd MMM, yyyy")}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                        {expense.category === 'Salary' ? 'বেতন (Salary)' :
                         expense.category === 'Utility' ? 'ইউটিলিটি বিল' :
                         expense.category === 'Food' ? 'খাবার (Food)' :
                         expense.category === 'Maintenance' ? 'রক্ষণাবেক্ষণ' : 'অন্যান্য'}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate" title={expense.description}>
                      {expense.description || '-'}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900 text-right">
                      {Number(expense.amount).toLocaleString('bn-BD')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ExpenseDeleteButton expenseId={expense.id} />
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
